---
name: gtme-signal-pipeline
description: Design and build a signal-based lead pipeline in Evan's n8n. A buying signal (job ads, funding, new exec hires, LinkedIn post intent, website visitors) is scraped with a hard Apify cap, deduped, qualified with Jev, enriched only when it passes, scored and tiered in code, matched to contacts and written to the client's Google Sheet, with failure alerts. Use when Evan wants a new signal workflow for a client, to add a signal source or a stage (contacts, copy, staleness) to an existing pipeline, or says "build the signal pipeline", "add funding signals", "hiring signal for this client", "next workflow".
---

# gtme-signal-pipeline

A signal pipeline answers "who should we contact this week, and why now?". The pattern below
is the one that worked for Staffviser (n8n workflows `aaD3ohyRMXz9xG6I` and `9I7AQXQqqqz3al0j`).
Reuse it rather than inventing a new shape for each client.

## Step 0: Check the inputs exist

- An approved flow spec (`data/clients/<slug>/flow-spec.md`) with the signals, destination,
  volume and Apify budget. If there isn't one, offer `gtme-leadflow-intake` first.
- A scoring design. If the Jev questions aren't tested yet, do `gtme-jev-scoring` Steps 1 to 3
  before building the qualify stage. Building first and testing later wastes paid lookups.
- Evan's yes to the Apify cap per run and per month. Every paid call carries
  `maxTotalChargeUsd`.

## Step 1: Pick the signal and check the source live

Choose from `references/signal-catalogue.md`. For each source, re-check price and limits with
the Apify connector (`fetch-actor-details`) or the GetLeads tools before quoting: prices in the
catalogue have dates. Note the data quirks (wrong field names, missing headcount) in the plan.
Flag LinkedIn scraping and EU/UK personal data to Evan (CLAUDE.md guardrail).

## Step 2: Lay out the stages

One workflow per stage, each reading the previous stage's status column:

```
A  Scrape signal      schedule → read config → source (capped) → normalise → dedupe → raw tab (status pending)
B  Qualify            pending rows → Jev (all questions, one call per item) → gate in code
                      → cached company lookup only for passes (capped) → company Jev check
                      → score + tier in code → companies tab / rejects tab
C  Contacts           qualified companies without contacts → suppression check → contact finder (capped)
                      → persona pick in code → leads tab (status test_review)
D  Copy               leads → Claude writes from the signal + proof points → leads tab (status copy_ready)
E  Staleness (weekly) re-check open signals, age out old ones, re-score
F  Errors             every production workflow points errorWorkflow at GTME – failure alerts (MrGJ9sB98EIiZz55)
```

Why separate stages: qualification can be re-run on stored raw rows after a question or
threshold change without paying to scrape again. That's what made the Staffviser v1 → v2
tuning cost almost nothing. Stage A never calls Jev; stage B never scrapes.

The node-by-node skeleton with the proven code is in `references/blueprint.md`.

## Step 3: Set up the client sheet

One Google Sheet per client in the client's Drive folder, created through `gtme-n8n-oneoff`
(the Drive connector can't write cells). Tabs:

| Tab | Holds | Key |
|---|---|---|
| `config` | technical limits: max items, caps, model, recheck days | `setting` |
| `<signal>_raw` | one row per signal item, with `jev_status` and reason | source ID (`job_id`) |
| `company_cache` | paid lookups (size band, members, HQ, founded, description) with `checked_at` | `company_key` |
| `companies` | qualified and held companies: tier, score, signals, probabilities, `send_status` | `company_key` |
| `rejects` | rejected items with the reason and probabilities | source ID |
| `leads` | contacts with status, never sent from here | clean LinkedIn URL or email |
| `outcomes` | replies, meetings, wins, for later calibration | lead key |

Business rules (sizes, countries, industries and points, roles, personas, disqualifiers, proof
points) go in the client's ICP sheet, so Evan or the client can change them without touching
n8n. `company_key` is the LinkedIn company slug from the source data. Never guess a slug.

## Step 4: Build

- New workflows: the n8n connector (`get_workflow_sdk_reference`, `get_node_types`,
  `validate_workflow`, `create_workflow_from_code`). Name them `<Client> – <n> <stage>`.
- Changing a big existing workflow: GET it through the public API, edit the JSON in a
  scratchpad script, PUT it back. Keep `nodeGroups` in sync if the workflow has them, keep node
  descriptions under 155 characters, and expect HTTP 423 if Evan has it open in the editor.
- Every external call: retries (3 tries, 3 s), batching, and for Apify the run-sync URL with
  `maxTotalChargeUsd`. The Apify free plan allows 5 concurrent runs, so loop in batches of 4.
- Every run caps its own volume from `config` (`max_items_per_run`, `max_lookups_per_run`) and
  works oldest-first, so a cap delays work instead of dropping it.
- Write with `appendOrUpdate` on the key column, never by row position.
- Leave it unpublished. Set `errorWorkflow` now so it's ready.

## Step 5: Test

1. Run each stage manually with small caps (20 to 50 items, Apify cap $0.50 to $2 agreed
   with Evan). Read the tabs back and check counts node by node.
2. Run `gtme-score-review` on the result before anything is published or any contact is
   pulled at volume.
3. Report the real spend per stage (Apify console or run stats, plus Jev tokens).

## Step 6: Hand off

- `workflows/<client>-signals/README.md` with the flow, IDs, config rows, cost table, setup
  checklist and test steps, in the same style as the other workflow READMEs.
- Only publish (turn the schedule on) after Evan says so. Never send email, push to the
  client's CRM or sequencer, or add to a campaign from this skill.

## Watch out for

- Apify field names don't always mean what they say (job scraper: industry is in `workType`).
  Map fields from a real sample, not the docs.
- LinkedIn size bands lag growth. Use the member count when it's above the band.
- Duplicate signals inflate counts: the same job in two cities, "future opening" posts. Count
  distinct titles per company.
- A missing HQ is unknown, not "in the target country". Hold it.
- Jev answers vary slightly between runs near a threshold. Store probabilities, not just pass
  or fail, so borderline rows can be found later.
