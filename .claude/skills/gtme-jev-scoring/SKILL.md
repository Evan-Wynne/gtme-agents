---
name: gtme-jev-scoring
description: Design, test and tune the Jev (TypeSafe) questions that qualify and score leads, companies, job ads or LinkedIn posts against a client's ICP, plus the weights, thresholds and tiers that live in code. Tests every question set on a labelled sample before it goes into a workflow, and can run it once over a list. Use when Evan wants to score or qualify with Jev, write or fix Jev questions, check a list for ICP fit or buying intent, or says "score these with Jev", "jev gate", "qualify this list", "why did Jev pass this", "build the scoring".
---

# gtme-jev-scoring

Jev answers narrow questions about text with probabilities. It does not reason, count, do
maths or compare dates. The skill is to split an ICP into judgments Jev is good at and rules
code is good at, then prove the split on real examples before anything runs at volume.

Before starting, skim the live docs index (https://docs.typesafe.ai/llms.txt) for anything
newer than `references/api.md`: model aliases move.

## Step 1: Sort the ICP into four buckets

Read the client's ICP: the ICP sheet or doc, `data/clients/<slug>/flow-spec.md`, or what
Evan says. Put every criterion in one bucket, in a short table in chat:

| Bucket | Examples | Where it runs |
|---|---|---|
| Exact rule | headcount band, country, founded year, days open, applicant count, funding date | Code, on data from a source or a lookup |
| Jev gate | business vs recruiter, work doable remotely, part-time, needs a licence | Noul or Choice, threshold in code |
| Jev signal (points) | growth language, urgency, industry tier, buying intent in a post | Noul/Score, weighted in code |
| Not in this source | VC-backed when the source is a job ad, real headcount | A later step with an enrichment or lookup |

If a criterion needs a number or a date, it is never a Jev question. Turn it into a bucket in
code first ("founded 5 to 10 years ago", "under 25 applicants") and send the bucket as state
only if a judgment needs it.

## Step 2: Write the questions

Pick the primitive by what the answer means:

- **Noul**: does one condition hold? Phrase it so yes is high. Add `criteria.true/false`
  with examples when the boundary is subtle.
- **Choice**: exactly one of a set (company type, industry, persona). Include a no-match
  option.
- **Score**: a degree on 3 to 10 ordered levels. Each level describes a concrete situation and
  must make sense on its own (the model never sees level numbers or neighbours).

Rules learnt the hard way (details and wording in `references/question-library.md`):

1. **One question per thing.** Never "remote and growing". Ask two, combine in code.
2. **Jev reads literally.** Ask about the property you care about, not a proxy. "Could this be
   done from another country" was answered from the office-attendance line until it said
   "judge the tasks, ignore the office policy".
3. **Don't name the client's solution.** Naming Philippines/Tunisia made Jev hedge at 0.7 to
   0.8. Ask the underlying property instead.
4. **Choice order matters.** Jev leans to the first option. Put the safe/no-points option first
   (`other` first for industry) and the passing option last (`fit` last). Test with `--swap`.
5. **Send only what the question needs.** Named JSON fields, descriptions trimmed (about 1,500
   characters), no raw HTML. Irrelevant state costs accuracy.
6. **Ask every question for an item in one request.** They run in parallel at no extra latency.
   Speculative questions (only used on one branch) are fine; code ignores the rest.
7. **Question ids are not sent to the model.** The instruction must carry the full meaning.

## Step 3: Test on a labelled sample (always, before wiring)

1. Build 20 to 40 test cases from real rows in the client's sheet or raw tab, as
   `cases.jsonl` in the scratchpad (never in the repo): `{"id", "state", "expect"}`. Include
   the tricky ones: recruiters posing as companies, on-site ads for remote-doable work,
   subsidiaries, near-miss industries.
2. Expected answers: take Evan's where he's given them. Otherwise label them yourself, say they
   are Claude's labels, and ask Evan to check the 5 to 10 that matter most.
3. Run the exact `questions` object the workflow will send:

   ```bash
   python3 <this skill>/scripts/jev_eval.py questions.json cases.jsonl --swap \
     --threshold offshorable=0.8 --model jev-1.13.0
   ```

   It needs `TYPESAFE_API_KEY` in the environment. If that's missing (for example in a
   claude.ai chat), run the same body through a TEMP n8n workflow with the `TypeSafe Jev`
   credential (`gtme-n8n-oneoff`), or for a quick check of a few items use the `jev` MCP tools.
4. Read the output: agreement per question, borderline Nouls (0.3 to 0.7), Choice flips when
   options are reversed, tokens and cost. For each miss, decide which it is: wording,
   missing state, wrong expectation, or genuinely ambiguous (goes to a review band, not a
   rewording loop).
5. Change one thing at a time and re-run the same cases. Show Evan a before/after table.
   Stop when gates agree on about 90% or more and the rest are honestly ambiguous.

## Step 4: Put the policy in code

- **Gates:** threshold each Noul by the cost of a mistake. Raise it when a false pass wastes
  paid lookups or a send, lower it when missing a good lead is worse. Values in between can
  go to a `hold` status for a human instead of either path.
- **Choice:** act on `choice` only when its probability (or `confidence`) clears a bar; use
  the probability of the passing option as `<name>_p` for audits.
- **Points:** normalise each Score by `len(criteria) - 1`, weight in code, add exact-rule
  points (size sweet spot, role, industry tier) and keep the formula readable. Watch that
  static points don't drown the signals (Staffviser v1: 69% of the score was static).
- **Tiers:** from exact rules plus the score, in code.
- All thresholds, weights and tier bands live in the client's config/ICP sheet, so they can
  change without editing the workflow.
- Every scored row keeps the raw probabilities, the reject reason and the `model` the response
  reports. Without them, `gtme-score-review` can't audit the run.
- Pin the versioned model (`jev-1.13.0`) once thresholds are tuned. `jev-latest` moves.

## Step 5: Write the scoring spec

Write `data/clients/<slug>/scoring-spec.md` from `references/scoring-spec-template.md`:
buckets, the questions JSON, thresholds, weights, tiers, and the test result (date, model,
agreement per question, cost). Criteria and aggregates only, no lead names or emails.
Commit it on a branch with the workflow change it belongs to.

## Step 6 (optional): Run once over a list

For "score this list" requests with an agreed question set:

- Estimate cost first: tokens ≈ characters ÷ 4 per request (state plus questions), times
  rows, at $0.042 per million input tokens. It's usually cents; say the number anyway.
- Up to a few hundred rows, read in chat: the eval script without `expect`, `--out` to a
  scratchpad file. Bigger lists, or results that must land in a Google Sheet: a TEMP n8n
  workflow (Sheets read → Code builds `jev_body` → HTTP Request → Code parses → Sheets append
  to a new tab), via `gtme-n8n-oneoff`. The HTTP node and parse code are in
  `references/api.md`.
- Never overwrite the source tab. Write results to a new tab named `jev <date>`.

## Guardrails

- Leads, emails and test cases stay in Sheets or the scratchpad, never in the repo.
- A Jev answer is a signal, not proof. Anything that triggers spend or a send needs a gate that
  was tested in Step 3.
- If a fix changes what the ICP means (not just how a question is worded), it's Evan's call,
  and maybe the client's.
