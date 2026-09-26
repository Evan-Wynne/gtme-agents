# Handoff — GTME lead pipeline + Staffviser intake

> **For the session reading this:** you're picking up work that another session started.
> 1. Read this whole file.
> 2. Check that the connectors under "Tools needed" are available to you.
> 3. Give Evan a status in ≤ 5 lines, plus the next step you'd take.
> 4. Wait for his go.
>
> CLAUDE.md applies: sending email, spending money, bulk-writing to the CRM or scraping all
> need his OK first.

- Written: 2026-09-26 from cloud session https://claude.ai/code/session_017w4ZnqM9B3xuSUvmxv2dZ4
- Branch: `claude/apify-clay-leads-connector-p8bljm` (see the commit that adds this file)
- Status: paused by Evan. He's polishing his overall offering before he sends Staffviser's
  CEO the intake form.

## Goal
Two things:
1. A weekly, capped lead feed: Apify LinkedIn posts → n8n scoring → the GTME Leads sheet
   and Clay.
2. A repeatable client-intake flow: Tally form → spec → Apify budget → build. Staffviser is
   the first client.

## Done (verified 2026-09-26)
- **Lead Scanner** (n8n) is published and runs Mondays at 08:00, Europe/Dublin:
  - pulls LinkedIn posts via Apify `harvestapi/linkedin-post-search`, 45 posts, run URL
    capped at `maxTotalChargeUsd=0.1`
  - cleans the LinkedIn URLs and removes duplicates
  - scores leads with gpt-5-mini; score ≥ 6 goes to the `Linkedin` tab and to Clay (5/s,
    3 retries)
- **Failure alerts** (n8n) is published and set as the Lead Scanner's error workflow. A test
  alert email was delivered.
- **Clay** webhook table in the "GTM-E leads" workbook, backfilled with the first run's 15
  leads.
- **Repo:** PRs #1–#3 are merged to `main`. They added:
  - the skills `gtme-leadflow-intake` (Tally) and `gtme-n8n-oneoff`
  - `.claude/settings.json`, which asks Evan before any `gtme-` skill runs
- **Staffviser:**
  - spec draft written
  - Tally intake form saved as a DRAFT
  - `Staffviser` tab created in GTME Leads (still empty)

## Open
- **Paused:** the Staffviser intake. The form stays a DRAFT until Evan says his offer is
  ready. Then publish it and give him the share URL; he sends it himself.
- **Next:** Evan reviews the form (https://tally.so/forms/4450xk/edit) → publish → the client
  replies → `gtme-leadflow-intake` step 3 onwards. Needs Evan's OK: yes, at the publish step
  and at the budget step.
- **Next:** check the first scheduled scanner run (Mon 2026-09-28, 08:00 Dublin) with
  `search_workflow_executions`. Needs Evan's OK: no, it's read-only.
- **Unverified:** that the `Skill(skill:gtme-*)` approve prompt actually appears, and whether
  typing `/gtme-…` directly skips it.
- **Unverified:** whether a local session can call api.apify.com and api.clay.com directly.
  The cloud sandbox blocks both.

## Where things live
| What | Where | Name / ID |
|---|---|---|
| Lead scanner | n8n; repo `workflows/gtm-engineer-lead-scanner/` | "GTM Engineer Lead Scanner", `kyXDOp0XR4R1Lyul` |
| Failure alerts | n8n; repo `workflows/gtme-failure-alerts/` | "GTME – failure alerts", `MrGJ9sB98EIiZz55` |
| Leads | Google Drive (find by name) | sheet "GTME Leads", tabs `Linkedin`, `Clay`, `Staffviser` |
| Clay webhook URL | n8n node "Send to Clay" in the scanner | not in the repo on purpose |
| Staffviser intake | Tally, Evan's personal workspace | form `4450xk` (draft) |
| Staffviser spec | repo | `data/clients/staffviser/flow-spec.md` |

## Decisions from this session
- Staffviser ICP agreed with Evan: US first (other markets welcome), ~300–1,000 employees,
  with some flexibility. This is already in the spec.
- Evan wants short, direct answers.

## Gotchas
- The cloud sandbox can't reach Apify, Clay or client websites. Do those calls through a
  TEMP n8n workflow (`gtme-n8n-oneoff`).
- The Apify connector only lists runs and datasets when its URL ends in
  `?tools=actors,docs,runs,storage`.
- Sheet tab names are case-sensitive: `Linkedin`, not `LinkedIn`.
- The Clay connector can't write rows; use the webhook table. The Drive connector can't edit
  cells; write through n8n.
- Tally sometimes drops page breaks. Re-insert them with `insertAfterBlockUuid`.

## Tools needed
- Connectors: n8n, Tally, Google Drive. Apify for live pricing at the budget step. Clay is
  optional.
- Skills: `gtme-leadflow-intake` (steps 2–6), `gtme-n8n-oneoff`.

## Questions for Evan
- None blocking. He decides when the Staffviser form goes out.
