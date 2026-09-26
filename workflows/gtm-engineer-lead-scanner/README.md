# GTM Engineer Lead Scanner (n8n)

Daily LinkedIn post search via Apify → AI relevance score → leads scoring ≥ 6 go to the
**GTME Leads** Google Sheet (`Linkedin` tab) and to a **Clay** webhook table.

- Lives in n8n cloud as workflow `kyXDOp0XR4R1Lyul` ("GTM Engineer Lead Scanner").
- This file is the setup checklist; the workflow itself is edited and published in n8n.
- No lead data belongs in this repo — leads stay in the sheet and in Clay.

## Flow

```
Every day 08:00 Europe/Dublin
  → Read Linkedin tab (for dedupe)
  → Apify post search  (harvestapi/linkedin-post-search, "gtm engineers", 45 posts, last month)
  → Dedupe authors → Normalize (clean /in/<handle> URL) → Dedupe vs sheet
  → Score (gpt-5-mini via n8n AI credits) → Build row → Score ≥ 6?
      ├─ Append to Linkedin tab   (Google Sheets)
      └─ Send to Clay             (POST to Clay webhook table, 5 req/s, 3 retries)
```

A second trigger, `Clay export webhook` (`/webhook/clay-gtm-leads`), scores leads pushed
*from* Clay into the sheet's `Clay` tab. Do not point the new Clay table back at it — that
would loop leads Clay → n8n → Clay.

## Cost guardrails

| Item | Setting | Worst case per run |
|---|---|---|
| Apify run | `?maxTotalChargeUsd=0.1` on the run-sync call (hard cap, enforced by Apify) | $0.10 |
| Apify volume | `maxPosts: 45`, `profileScraperMode: short`, no reactions/comments | 45 × $0.002 + start fee ≈ $0.09 |
| Scoring | one gpt-5-mini call per new author (≤ 45) | n8n AI credits |
| Clay | webhook rows only; no enrichment columns run automatically unless added in Clay | 0 Clay credits |

Pricing verified 2026-09-26 from the actor's Apify listing (pay-per-event, FREE tier:
$0.002/post). Cap parameter: [Apify API — run Actor synchronously](https://docs.apify.com/api/v2/actor-run-sync-get-dataset-items-post).

## Setup checklist

- [ ] n8n credential **Apify API** (`httpTemplatedCustomAuth`) attached to `Apify post search`.
- [ ] n8n credential **Google Sheets account** attached to all four Sheets nodes.
- [ ] Sheet `GTME Leads` has tabs named exactly `Linkedin` and `Clay` (case-sensitive —
      a `LinkedIn` mismatch broke the 2026-09-26 08:00 run).
- [ ] Clay: table created via *Import data from Webhook*; its URL is set in `Send to Clay`.
      Webhook limits: 50,000 submissions per webhook, 10 records/s
      ([Clay docs](https://university.clay.com/docs/webhook-integration-guide)).
      If the Clay plan caps rows per table, the sync will start failing once full.
- [ ] Workflow is **published** (draft edits don't run on the schedule).

## Test steps

1. In n8n, run the workflow once from `Every day` (production mode). Expect ~90 s.
2. Execution shows `Apify post search` ≤ 45 items and no red nodes.
3. New rows appear in the `Linkedin` tab with clean `https://www.linkedin.com/in/<handle>` URLs.
4. The same rows appear in the Clay table; `Send to Clay` items all return `OK`.
5. In Apify Console → Runs, the run cost is ≤ $0.10.

## Known limitations

- Scoring uses the LinkedIn headline only; job-ad posts and recruiters can score ≥ 6.
- `company`, `location`, `email` are blank (short profile mode) — enrich in Clay.
- No error-workflow alerting yet; failures are visible only in n8n's execution list.

## Change log

- 2026-09-26 — Fixed tab name (`LinkedIn` → `Linkedin`); published the Apify credential that
  was only in the draft; added $0.10 Apify hard cap and 45-post limit; strip `?miniProfileUrn`
  from profile URLs (existing 15 rows cleaned once); added `Send to Clay` branch and backfilled
  the first 15 leads to Clay.
