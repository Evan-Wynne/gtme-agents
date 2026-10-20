# Pipeline blueprint (node by node)

Condensed from Staffviser Workflow A (`aaD3ohyRMXz9xG6I`) and Workflow 2 (`9I7AQXQqqqz3al0j`),
which ran on 2026-10-19. The live workflows are the reference if anything here is unclear:
GET them through the n8n API and read the Code nodes.

Reusable credentials (names to pass to `newCredential`): `Google Sheets account`,
`Apify API (evanwynne) (evanwynne)` (HTTP templated custom auth), `TypeSafe Jev`
(HTTP bearer), `Anthropic`, `Gmail account`.

## Shared helper: read a setting

Every Code node that needs a tunable reads it from a settings tab, with a fallback:

```javascript
const cfg = $('Read config').all().map(i => i.json);
const setting = (key, fallback) => {
  const row = cfg.find(r => String(r.setting || '').trim() === key);
  const v = row ? String(row.value ?? '').trim() : '';
  if (v === '') return fallback;
  if (typeof fallback !== 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
```

## Stage A: scrape the signal

```
Schedule (07:00 Dublin) + Manual trigger
→ Read config, Read ICP tabs (roles, locations)
→ Code: build one search per role family × country (keyword, titleInclude, location)
→ Split in batches (4)                      # Apify free plan: 5 concurrent runs
   → HTTP: Apify run-sync-get-dataset-items?maxTotalChargeUsd=<cap>
   → back to Split in batches
→ Code: normalise (clean URLs, company_key from /company/<slug>, ISO dates, drop part-time/intern)
→ Read raw tab → Code: drop IDs already stored, and company+title already seen this run
→ Sheets appendOrUpdate on job_id, jev_status = pending
```

Apify call (HTTP Request node):

```json
{
  "method": "POST",
  "url": "=https://api.apify.com/v2/acts/<ACTOR_ID>/run-sync-get-dataset-items?maxTotalChargeUsd={{ $json.max_charge_usd }}&fields=<comma-separated fields you use>",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpTemplatedCustomAuth",
  "sendBody": true, "contentType": "json", "specifyBody": "json",
  "jsonBody": "={{ JSON.stringify($json.actor_input) }}",
  "options": { "timeout": 300000 }
}
```

`fields=` keeps the response small. The cap is enforced by Apify, so a bad input can't run up
a bill. Split the per-run cap across the batches.

## Stage B: qualify

```
Schedule (08:00) + Manual trigger
→ Read config, Read ICP tabs, Read raw tab
→ Code "Build Jev requests": pending rows, oldest first, capped at jev_max_items_per_run;
     each item gets { row, jev_body: { model, state, questions } }
→ HTTP "Jev – judge" (5/s, 3 retries)                          # see gtme-jev-scoring references/api.md
→ Code "Gate": throw if answers are missing; reasons[] from thresholds; keep probabilities
→ Read company_cache → Code "Find lookups": passes not in cache (or stale), minus Jev
     large_enterprise ≥ 0.8, capped at max_lookups_per_run → IF any
     → HTTP Apify company lookup (capped) → Code: map to cache rows → Sheets appendOrUpdate company_key
→ Code "Company facts": companies passing the exact rules → jev_body for company questions
→ HTTP "Jev – judge company"
→ Code "Score + decide": exact rules (size, type, HQ market), company Jev gates, points, tier
→ Filter rejected → Sheets append rejects
→ Set status fields → Sheets update raw tab on job_id (jev_status, reason, checked_at)
→ Filter qualified → Read companies → Code "Roll up by company" → Sheets appendOrUpdate company_key
```

Run the same company rules in "Find lookups", "Company facts" and "Score + decide" (copy the
block between `// ---- Company rules` markers) so a company can't pass in one node and fail in
another.

Lookup selection, the part that saves money:

```javascript
const want = new Map();
for (const { json: j } of $('Gate').all()) {
  if (j.gate !== 'pass') continue;
  if (!/[/]company[/]/i.test(String(j.company_url || ''))) continue;   // no slug, no lookup
  if (cache.has(j.company_key)) continue;                              // fresh cached row
  if (j.large_enterprise_p >= setting('jev_large_enterprise_max', 0.8)) continue;
  want.set(j.company_key, 'https://www.linkedin.com/company/' + j.company_key);
}
const urls = [...want.values()].slice(0, setting('max_lookups_per_run', 100));
return [{ json: { urls, lookups: urls.length, max_charge_usd: setting('apify_lookup_max_usd_per_run', 0.5) } }];
```

Size rule with the band-lag fix:

```javascript
const num = v => (v === '' || v == null ? NaN : Number(v));
const sizeOf = r => {
  const lo = num(r.size_min);
  const hi = Number.isFinite(num(r.size_max)) ? num(r.size_max) : Infinity;
  const members = num(r.linkedin_members);
  // LinkedIn bands lag growth: if more people list the company than the band allows, trust the count
  return Number.isFinite(members) && members > hi ? { lo: members, hi: members } : { lo, hi };
};
const inRange = r => { const s = sizeOf(r); return s.hi >= sizeMin && s.lo <= sizeMax; };
```

Roll-up rules that held up in review:
- Score the company on its best item, plus a bonus for 2+ distinct real roles. Strip
  "future opening", "talent pool" and "general application" titles and normalise titles before
  counting.
- Merge with the existing company row (IDs, titles, signals) instead of overwriting it, and
  never touch a company whose status is contacted, replied, meeting, client or do_not_contact.
- `send_status` = `send` only for markets that send now; other ICP markets are scored and
  stored as `hold`; unknown HQ is `hold`.

## Stage C: contacts

```
Schedule + Manual trigger
→ Read companies (qualified, send_status = send, no contacts yet, best tier first, capped)
→ Read suppression (client CRM export, previous sends, do-not-contact) → Code: drop suppressed
→ Loop one company at a time
   → HTTP Apify contacts (title filter from the personas tab, capped per company)
   → Code: pick by persona priority (founder/CEO, then COO/Head of Ops, then Head of People;
     never a recruiter first), clean LinkedIn URL, lowercase email
→ Sheets appendOrUpdate leads on linkedin_url, status = test_review
```

Verify emails before anything is sent (Hunter in the Flux store, or the provider's own
status). Contacts never go to a sequencer from this stage.

## Stage D: copy

Claude (n8n Anthropic credential) writes from the company row only: the signal, the angle, one
proof point from the ICP sheet, the persona. Then a Jev Noul checks that every claim in the
first line is in the source fields (question library: "personalisation is grounded"). Rows
below 0.7 get status `copy_review`. Show Evan 5 examples before any volume run.

## Stage E: staleness (weekly)

Re-check raw items older than N days (closed job, reposted, new applicants), recompute urgency
and the company score, and age out companies with no live signal. Without this, the companies
tab fills with last month's reasons.

## Every workflow

- `errorWorkflow` = `MrGJ9sB98EIiZz55` (GTME – failure alerts). It only fires on production runs.
- Sticky notes per section saying what it does in one line.
- A run summary at the end (counts per status, lookups, spend) so a quick look at the last
  execution tells Evan whether it worked.
