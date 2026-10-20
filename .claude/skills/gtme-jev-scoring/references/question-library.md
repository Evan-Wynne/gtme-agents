# Jev question library for lead scoring

Questions marked **tested** ran in the Staffviser pipeline (n8n `Staffviser – 2 Qualify with
Jev`, 325 US job ads, 2026-10-14 to 2026-10-19, `jev-1.13.0`). The templates at the end were
only smoke-tested on a few made-up examples: run them through Step 3 of the skill on real rows
before using them.

Copy the JSON into the workflow's `QUESTIONS` object and adapt the examples to the client.

## Job-ad questions (state: one job ad)

State shape that worked:

```json
{ "job": { "title": "...", "company": "...", "location": "...", "industry": "...",
           "employment_type": "...", "seniority": "...", "salary": "... or 'not listed'",
           "description": "the full ad text" } }
```

Full LinkedIn ads fit comfortably inside Jev's 32k-token per-question limit. Measured cost:
37 ads × 7 questions = $0.0025 (2026-10-15).

### offshorable (Noul, tested, gate at 0.8)

```json
{ "type": "noul",
  "instructions": "Could the day-to-day tasks of this job be done entirely on a computer and phone by someone working from another country? Judge the tasks themselves. Ignore the employer's office, hybrid or on-site attendance policy, and ignore occasional travel or client meetings.",
  "criteria": {
    "true": "The tasks are computer or phone work, for example customer success or support, account management, sales development, sales or revenue operations, admin or executive assistance, bookkeeping, payroll, finance, HR administration, recruiting, design, video editing, marketing, QA, software or data work.",
    "false": "The tasks need the person physically present: handling goods, stock or equipment, driving or field visits, serving customers face to face in a store, branch or clinic, hands-on repair or IT hardware work, lab or medical work, or regular in-person selling at client sites." } }
```

History: v1 asked "work done on a computer or phone, not physically present". Jev answered
from the office policy: on-site ads averaged 0.66, remote ads 0.92, so only 1 to 3 of 15
customer success roles and 0 to 1 of 15 executive assistants passed. Adding "judge the tasks,
ignore the office policy" fixed it (14/15 and 9/15). IT support still fails, as it should when it's hands-on. 58 ads
sat between 0.70 and 0.79, so the gate threshold matters: test 0.7 against 0.8 on the sample.

### company_fit (Choice, tested, passing option last)

```json
{ "type": "choice",
  "instructions": "What kind of organisation is the employer in this job advert? Judge the organisation the person would actually work for, using its name, industry and the advert text. Ignore company size; it is checked separately.",
  "criteria": {
    "government_or_public": "A government department, public body, council, public health service, police, military, state school or public university.",
    "charity_or_nonprofit": "A charity, non-profit, foundation, NGO, association or membership organisation.",
    "recruiter_or_staffing": "A recruitment agency, staffing agency, headhunter or job board advertising a role on behalf of a client, including adverts that say 'our client'. Examples: Michael Page, Hays, Randstad, Robert Half, Adecco.",
    "outsourcing_eor_bpo": "An Employer of Record, PEO, offshore staffing provider, outsourcing or BPO company, or call-centre provider that supplies staff or services to other companies. Examples: Deel, Remote, Oyster, Concentrix, Teleperformance, TaskUs.",
    "freelance_platform": "A freelance marketplace, or a business whose work is done entirely by freelancers or gig workers.",
    "fit": "A business hiring for its own team, for example a software, e-commerce, agency, fintech, healthtech, consumer brand or services company. Not a recruiter, outsourcer, freelance platform, public body or non-profit." } }
```

Code: reject unless `choice == "fit"`, then require `probabilities.fit >= 0.7`. Its `fit_p`
was almost always 1, so this question only removes recruiters, outsourcers, public bodies and
non-profits. Size was a separate question earlier and Jev guessed it badly from the ad; size
now comes from a LinkedIn lookup (see the signal catalogue in `gtme-signal-pipeline`).

### large_enterprise (Noul, tested, pre-screen before paid lookups)

```json
{ "type": "noul",
  "instructions": "Is the employer in this job advert a large, well-known enterprise or a listed public company, or part of one? For example a household-name brand, a multinational, a large bank or insurer, a Fortune 1000 company, or a company describing itself as having thousands of employees." }
```

Skip the paid size lookup at ≥ 0.8. It saves money; the lookup still decides size.

### industry (Choice, tested, `other` first)

Build the options in code from the client's ICP industries tab. Put `other` first with a
description that lists what falls outside the ICP, then one option per ICP industry with a
one-line description (for example "A technology company building health, wellness or medical
software (not a hospital, clinic or care provider)"). Industry points come from the chosen
option in code.

### Smaller tested Nouls (all phrased so yes is high, flagged in code at ≥ 0.7)

| id | instructions |
|---|---|
| part_time_or_temporary | Is this job part-time, temporary, seasonal, freelance or a fixed-term contract, rather than a permanent full-time role? |
| needs_local_licence | Does this job require a local professional licence or certification (for example CPA, chartered accountant, attorney, nurse or physician), a security clearance, or a specific citizenship? Ignore standard statements about the right to work. |
| needs_french | Does this job require the person to speak or write French? (criteria: true = required, work done in French, or ad written in French; false = not mentioned or nice-to-have) |
| growth_signals | Does the advert describe the company hiring several people for this team, building a new team, or growing or expanding? |
| urgent_language | Does the advert stress that the role must be filled urgently or offer an immediate start? |
| remote_or_hybrid | Is this job advertised as remote or hybrid, rather than fully in the office? |
| works_with_offshore_freelancers | Does the advert say the company already works with freelancers, contractors or team members based in other countries, for example in Latin America, Asia or Eastern Europe? |
| unhappy_with_outsourcing | Does the advert say the company is bringing work back in-house from an outsourcing provider, BPO or agency, or is unhappy with one? |

The last two almost never fired on job ads. Rare signals are fine as bonus points, but don't
build the score around them.

Kept in code, not Jev: urgency from days open, reposts and applicant counts; the outreach angle;
the talent pool. Jev is weak at numbers and dates.

## Company questions (state: one company profile)

State shape that worked: name, LinkedIn industry, description (≤ 1,500 characters), age as a
bucket ("founded 5 to 10 years ago"), LinkedIn size band, website, and up to 5 open job titles.

### startup_or_scaleup (Noul, tested, reject below 0.5)

```json
{ "type": "noul",
  "instructions": "Is this company a startup or scale-up: a growth-focused company building a product, brand or digital service, typically funded by investors, rather than a long-established traditional business?",
  "criteria": {
    "true": "For example a software, AI, fintech, healthtech or adtech company, an e-commerce or D2C brand, or a fast-growing digital or performance agency, usually founded in the last 15 years.",
    "false": "For example a law firm, accounting firm, consultancy, manufacturer, distributor, insurer, hospital or clinic, construction, architecture or real-estate business, a family-owned company, a media personality business, or a long-established brand." } }
```

Agencies were exempted in code (`startup_check_skip_industries`), which let a few tiny studios
through. One VC-backed fintech scored 0.42 and was missed: check misses near the threshold.

### part_of_larger_group (Noul, tested, reject at 0.7)

```json
{ "type": "noul",
  "instructions": "Is this company a division, subsidiary, brand or regional arm of a larger company or holding group? For example a media network owned by a retailer, an agency owned by an advertising holding company, or a business unit named after its parent." }
```

Catches subsidiaries that pass a headcount check on their own LinkedIn page.

### mentions_investors (Noul, tested as a signal)

```json
{ "type": "noul",
  "instructions": "Does the company profile mention venture capital, investors, a funding round or being backed by investors?" }
```

Absence proves nothing: most profiles don't mention funding. Use it for points, and get the
real VC flag from a data source (GetLeads `financing_profile.status`) when it matters.

## Templates (smoke-tested only)

### LinkedIn post: buying intent (Score)

State: `{ "post": { "author_headline": "...", "text": "..." }, "we_sell": "one line" }`

```json
{ "type": "score",
  "instructions": "How clearly does the author of `post` show that their company needs what `we_sell` describes, right now?",
  "criteria": [
    "Unrelated to this need, or the author is selling something similar themselves",
    "Talks about the topic in general, with no sign their own company needs it",
    "Describes a problem at their own company that this would solve",
    "Says they are looking for, evaluating or asking for recommendations for this kind of solution" ] }
```

Pair it with a Noul `is_vendor_or_recruiter` ("Is the author selling a product or service, or
recruiting for a client, rather than describing their own company's needs?") and reject at
0.7. Vendors and recruiters dominate most keyword post searches.

Smoke test 2026-10-20 (3 made-up posts): asking for recommendations 3.00, describing the pain
2.00, a vendor's own pitch 0.01; vendor Noul 0.10 / 0.22 / 0.97.

### Contact: persona match (Choice)

State: `{ "contact": { "title": "...", "headline": "..." }, "company_size_bucket": "..." }`.
Options from the client's personas tab, with `not_a_target` first and a description that lists
the titles to avoid (for example "talent acquisition or recruiting staff, interns, assistants").
Pick the best contact per company in code from the persona priority, not from Jev.

### Email: personalisation is grounded (Noul)

State: `{ "source_text": "the page the detail came from", "email_first_line": "..." }`

```json
{ "type": "noul",
  "instructions": "Is every factual claim about the prospect's company in `email_first_line` directly stated in `source_text`?" }
```

Rewrite any first line below 0.7. Smoke test 2026-10-20: a faithful paraphrase scored 0.85,
an invented number 0.03, an invented office opening 0.05. A bar of 0.8 would sit too close to
faithful paraphrases; re-check the threshold on real drafts.

### Funding or news item: relevant trigger (Noul)

State: `{ "item": { "headline": "...", "summary": "..." }, "company": "..." }`

```json
{ "type": "noul",
  "instructions": "Does `item` report that `company` itself raised money, launched a product, opened in a new market or announced hiring plans in the last few months?" }
```

Check the date in code, not with Jev.
