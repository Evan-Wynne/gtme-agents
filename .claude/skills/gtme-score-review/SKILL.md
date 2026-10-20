---
name: gtme-score-review
description: Audit a lead-scoring run (Jev answers plus code rules) against what a human would decide, find the failure patterns, fix them and prove the fix by re-running on the same stored items, without paying to scrape again. Use after any test or production run of a signal pipeline, before pulling contacts at volume, or when Evan says "review the run", "are these leads any good", "why did this company pass or fail", "too many rejects", "tune the scoring", "check the qualified list".
---

# gtme-score-review

A run that "worked" can still qualify the wrong companies. This skill grades a run like a
sharp SDR would, explains every pattern of mistakes, and fixes them in the right place:
question wording, a code rule, a threshold, missing data, or the ICP itself.

## Step 1: Collect the run

- Rows: the client sheet's companies, rejects and raw tabs (Drive connector
  `download_file_content` as CSV, or `read_file_content`). Or the execution itself:
  n8n `search_workflow_executions` → `get_workflow_execution`.
- Context: execution IDs, the `jev_model` on the rows, current config and ICP values, and the
  scoring spec (`data/clients/<slug>/scoring-spec.md`) if one exists.
- Counts per stage: items in, Jev passes, lookups made (and how many landed outside the target),
  qualified, held, rejected by reason, spend.

## Step 2: Sample

- Qualified: all of them up to 50, otherwise a random 40.
- Rejected: 20, spread across the reject reasons.
- Borderline: every item within 0.1 of a gate threshold, either side.

## Step 3: Grade each sampled row

Judge from the row's own fields first, then a quick look at the company website when the
row isn't enough. Grade: **clean fit**, **maybe** or **no**, with one line of why in ICP
terms ("law firm, not a startup", "subsidiary of a listed group").

These are Claude's grades: say so. Pick the 5 to 10 grades that would change a fix and ask
Evan to confirm them before acting on them.

## Step 4: Measure

Show these as small tables in chat:

- Precision of qualified: clean / maybe / no counts.
- False rejects: how many sampled rejects should have passed, by reason.
- Per question: distribution of probabilities, and the same split by a variable that should
  not matter (for example `offshorable` for remote vs on-site ads). A big gap is a confounded
  question.
- Score make-up: share of points from static rules (role, industry) vs live signals. If the
  static share is high, the score is mostly a role list.
- Waste: paid lookups that came back outside the target, and their cost.
- Stability, if suspect: re-ask 10 borderline items and see how many cross the threshold.

## Step 5: Name the patterns

For each pattern: what it is, how many rows, two examples (in chat only), and the cause:

| Cause | Fix belongs in |
|---|---|
| Question answers a proxy, not the property | Question wording (`gtme-jev-scoring` Step 3) |
| Data the question needs isn't in state | The state built in code, or a lookup |
| Rule missing or wrong | Code rule plus a config row |
| Threshold in the wrong place | Config value, tested on the borderline set |
| Source data wrong or duplicated | Normalise or dedupe step |
| ICP is ambiguous | Evan (and maybe the client) decides; no code change until then |

Check the list in `references/known-patterns.md` first; most runs repeat one of them.

## Step 6: Propose fixes

A numbered list, highest impact first: change, where, expected effect, cost. Mark anything
that changes what the ICP means as needing Evan's yes, and the client's when it contradicts
their ICP doc. Make the fixes Evan approves.

## Step 7: Re-run on the same items and compare

- Reset only the reviewed items to pending (a TEMP workflow via `gtme-n8n-oneoff`, matched on
  the item key), then run the qualify stage manually. No new scrape; cached lookups mean no new
  lookup spend except for companies that newly pass.
- Before/after table: qualified count, clean / maybe / no, good leads lost (regressions, list
  them), new false passes, lookups and spend.
- If a fix loses more good leads than it removes bad ones, roll it back.

## Step 8: Record

- Add a dated changelog entry to the client's scoring spec: patterns, fixes, before → after.
  Aggregate numbers and pattern descriptions only. No lead lists or contact data in the repo.
- If test contacts were pulled for companies that are now rejected, list them for Evan to clear
  from the leads tab.

## Later: calibrate on outcomes

Once the outcomes tab has around 30 or more positive replies or meetings, compare them with the
stored probabilities and scores: which signals actually predict a meeting? Re-weight in code
from that, not from opinion. Until then, grades from Step 3 are the best evidence.
