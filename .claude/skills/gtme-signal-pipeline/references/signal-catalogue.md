# Signal catalogue

Sources Evan has actually used, with prices and quirks. Apify prices are the FREE-tier prices
from `fetch-actor-details` on 2026-10-20. Re-check before quoting a budget. GetLeads facts are
from Evan's own tests (dates given) and its MCP tool list.

## Hiring: open roles (LinkedIn job ads)

- **Actor:** `valig/linkedin-jobs-scraper` (ID `RIGGeqD6RqKmlVoQU`), about 5,900 monthly users,
  updated 2026-09-26.
- **Price:** $0.0004 per job + $0.001 per run start. 330 jobs ≈ $0.13.
- **Call:** run-sync-get-dataset-items with `maxTotalChargeUsd`. One keyword per role family ×
  target countries, `titleInclude` = the family's title phrases; drop part-time, contract and
  intern roles in code.
- **Quirks:** industry comes back in `workType` and employment type in `contractType`;
  `sector` is empty. No company headcount. `postedDate` is ISO. Free Apify plan: 5 concurrent
  runs, so loop in batches of 4.
- **Why now:** the company is hiring for a role the client can fill, cheaper or faster. Days
  open, reposts and low applicant counts (code) mean they're struggling to fill it.
- **Jev judges:** remote-doable tasks, employer type (not a recruiter or outsourcer), part-time,
  local licence, growth and urgency language, industry. See `gtme-jev-scoring`
  question library.
- **Fits:** staffing, EOR, offshore teams, recruiting, and tools for the function that's hiring.
- **Watch:** the same job in several cities and "future opening" posts inflate role counts.

## Company facts: size, HQ, age, description

- **Actor:** `harvestapi/linkedin-company` (ID `UwSdACBp7ymaGUJjS`), about 6,700 monthly users.
- **Price:** $0.004 per company + $0.00005 start.
- **Input:** `companies` = LinkedIn company URLs, copied from the source data (never guessed).
- **Returns:** `employeeCountRange` (the band the company chose), `employeeCount` (people listing
  it as employer; undercounts companies with many frontline staff), description, founded year,
  HQ, company type.
- **Use:** only for items that passed the Jev gate, cached in `company_cache` with a recheck
  period (180 days for Staffviser). Reject `Public Company` types. When members exceed the band,
  use the member count.
- **Lesson:** on Staffviser, 96 of 148 lookups were outside the target size. A Jev
  `large_enterprise` pre-screen at ≥ 0.8 skips the obvious ones before paying.

## Contacts at a qualified company

- **Actor:** `harvestapi/linkedin-company-employees` (ID `Vb6LZkh4EqRlR0Ka9`), about 5,700
  monthly users.
- **Price:** $0.02 per run start + per profile: $0.003 basic, $0.008 full, $0.012 full with
  email search. Run one company at a time when filtering by title, so budget the start fee
  per company.
- **Result on Staffviser (2026-10-19):** 10 companies → 9 contact rows; 3 companies returned
  nobody. The whole test day (scrape, size lookups and contacts) cost about $1.20 on Apify.
- **Also exposes:** `company.fundingData`, worth testing as a VC flag (untested).
- **Alternative:** GetLeads `search_contacts` / `lookup_decision_makers` on plan credits (see
  below), which also gives verified-email status.

## LinkedIn posts: topic or buying intent

- **Actor:** `harvestapi/linkedin-post-search` (ID `buIWk2uOUzTmcLsuB`), about 9,500 monthly
  users.
- **Price:** $0.002 per post; optional author profile $0.002 (main) or $0.004 (full);
  reactions and comments $0.002 each; $0.001 per query with no results; $0.00005 start.
- **Used in:** GTM Engineer Lead Scanner (`kyXDOp0XR4R1Lyul`): 45 posts a week, short profile
  mode, $0.10 cap.
- **Jev judges:** buying intent as a Score, and "is the author a vendor or recruiter" as a Noul
  (untested templates in the question library). Most keyword searches return vendors and
  recruiters, so expect a high reject rate.
- **Watch:** short profile mode has no company, location or email. Enrich only the passes.

## GetLeads signals (MCP tools, plan credits unless noted)

Evan is on the free plan (1,000 one-off credits, about 726 left on 2026-10-20). Check
`get_fair_use` and the balance before a pull. Wallet cash (separate, $1 on 2026-10-01) only
pays for the paid scrapes marked below.

| Signal | Tool | Notes |
|---|---|---|
| Funding rounds | `list_funding_signals` | Recent raises. Pair with a Jev relevance check if the summary is vague. |
| Acquisitions | `list_acquisition_signals` | Change of owner, new budgets, integration work. |
| New exec in seat | `search_contacts` with a `job_start_date` filter | 398 new COO/CFO/Head of People in Staffviser's US ICP since 2026-04-20. New leaders buy in their first months. |
| Website visitors | pixel: `start_website_visitor_tracking` → `configure_website_pixel` → `complete_website_pixel_setup` | Wallet-paid, needs auto top-up. |
| Post engagers on watched profiles | `add_monitored_profile`, `list_profile_monitoring_leads` | Wallet-paid. |
| Competitor followers | `lookup_company_linkedin_followers` | Wallet-paid, checkout link. |

GetLeads quirks (2026-10-20 tests):
- `search_companies` errors on `funding_types`; contact search with a size band and
  `funding_types` works.
- `total_funding_max: 0` only matches explicit zeros. Use `where_sql`
  `total_funding_amount IS NULL` for missing funding.
- A VC flag hides in `company_business_data_json.financing_profile.status`
  ("Venture Capital-Backed") even when the funding amount is null; `is_shut_down` and
  `is_acquired` are there too. Filter them.
- Always filter `require_email` and `founded_year_min`, and post-filter the last funding date:
  an unfiltered 50-row export had 3 emails and mostly stale funding.
- No job-ad data (role counts are deprecated), so hiring signals stay on Apify. No mobile
  numbers at the moment.
- No suppression against earlier exports: dedupe on `contact_id` yourself.

## Picking signals for a new client

Ask what changes at a company right before it buys the client's product:
- hires for the function the product replaces or supports → hiring signal
- money arrives → funding
- a new leader arrives → new exec in seat
- it's researching → post intent, website visitors
- a known pain gets louder → reviews, complaints, outsourcing exits (Jev on ad or post text)

Stack two signals where possible (a fresh raise plus open roles beats either alone) and give
the combination points in code.

## GDPR and terms

LinkedIn scraping, and any EU/UK person's data, needs Evan's explicit OK and a lawful-basis
note in the flow spec. US-only sending (Staffviser) keeps most contacts outside GDPR, but EU
companies stored for later still count.
