# TOOLS.md

Maintained by SCOUT. Every entry must be verified by a web search on the date listed — no entries from memory.

Columns: tool · last release/changelog date · pricing & free tier · API/webhooks · native integrations (n8n, Clay, Attio) · verdict · docs link · verified on

## Enrichment
_TBD_

## Sequencing
_TBD_

## Scraping
- **Apify `valig/linkedin-jobs-scraper`** (hiring signals) · updated 2026-09-26 · $0.0004/job + $0.001/run start (FREE tier) · Apify API run-sync with `maxTotalChargeUsd` · n8n HTTP Request (tested) · **use**: industry arrives in `workType`, no headcount · https://apify.com/valig/linkedin-jobs-scraper · verified 2026-10-20
- **Apify `harvestapi/linkedin-company`** (size, HQ, age, description) · updated 2026-10-07 · $0.004/company + $0.00005 start · same · same · **use** for gate passes only, cached · https://apify.com/harvestapi/linkedin-company · verified 2026-10-20
- **Apify `harvestapi/linkedin-company-employees`** (contacts) · updated 2026-10-07 · $0.02/run start + $0.003 basic / $0.008 full / $0.012 full+email per profile · same · same · **use**, one company per run when filtering titles · https://apify.com/harvestapi/linkedin-company-employees · verified 2026-10-20
- **Apify `harvestapi/linkedin-post-search`** (post intent) · updated 2026-09-25 · $0.002/post, profile add-ons $0.002–0.004, $0.001 per empty query · same · same · **use** with a vendor/recruiter filter · https://apify.com/harvestapi/linkedin-post-search · verified 2026-10-20

## Orchestration
_TBD_

## CRM
_TBD_

## Intent signals
_TBD_

## Judgment / scoring
- **Jev (TypeSafe)** · Jev 1.14 released 2026-10-14 (`jev-preview`); `jev-latest` = 1.13 · $0.042 per 1M input tokens, output free · REST `POST /v1/systemone`, Python/JS SDKs · n8n HTTP Request with a bearer credential (tested in Staffviser Workflow 2) · **use** for gates, classification and scored signals; not for maths, dates or text generation · https://docs.typesafe.ai/models · verified 2026-10-20

## New tools worth a look
_TBD_
