# Flux prospects store

One place for every Flux GTM outbound prospect, so nobody is emailed twice or emailed after
they opt out. It all lives in your n8n cloud: no external database, nothing to host.

## What's where

| Thing | Where | What it's for |
|---|---|---|
| `flux_prospects` | n8n → Overview → **Data tables** | Everyone you might email, one row per email address (always lowercase) |
| `flux_suppression` | n8n → Overview → **Data tables** | Never contact: unsubscribes, bounces, competitors, clients and existing leads, your own domains |
| **Flux - add prospects** | n8n workflow `jd3bLRq4OnDppFb9` | Puts a new list into `flux_prospects` |
| **Flux - verify new prospects** | n8n workflow `X6xFr8B85LTiBbsr` | Checks new emails with Hunter |
| **Flux - export send batch** | n8n workflow `mzEedCa9X0bvIY7M` | Gives you a ready-to-import list in Google Sheets |
| **Flux - mark contacted** | n8n workflow `nkQ2KqTdbUGBl8qE` | After you send: marks a batch (or pasted emails) as contacted |
| **Flux Prospects** sheet | Google Drive → Flux GTM | One tab per export: "Send batch <date> <time>" |

None of the workflows is published. You run each one by hand with **Execute workflow**. All
three send their failures to **GTME – failure alerts**, but n8n only fires that email for
published (production) runs, not for runs you start by hand.

`flux_suppression` starts with: staffviser.com, otel.ai, yonder.app, agnt.ie (existing
clients and leads) and fluxgtm.com, gtmflux.com (your own domains).

## The life of a prospect (the `status` column)

```
new ──verify──► verified ──export──► queued ──mark contacted──► contacted ► replied ► meeting ► client
  │               
  └──verify──► invalid        catch-all: stays new, note "catch-all, low priority"

do_not_contact: set by you, any time
```

- **Add** sets `new`.
- **Verify** sets `verified` or `invalid`. A catch-all stays `new` with a note, and is never
  checked again, so it doesn't eat credits.
- **Export** sets `queued`.
- **Mark contacted** sets `contacted`, plus `last_contacted_at`, after you've sent.
- You set the rest by hand for now: `replied`, `meeting`, `client` and `do_not_contact`.

## What each workflow does

### 1. Flux - add prospects
You give it a list as CSV or JSON. For each person it:

1. Cleans up the data: lowercases the email, turns "https://www.acme.com/about" into
   "acme.com", and strips tracking bits off LinkedIn URLs.
2. **Skips** them if their email is already in `flux_prospects`, including a duplicate inside
   the same list.
3. **Skips** them if their email, email domain or company domain is in `flux_suppression`.
   Subdomains count too: `sub.staffviser.com` is blocked.
4. **Skips** rows with a missing or broken email.
5. Saves everyone else with status `new`.

At the end it shows a summary: `added`, `skipped_duplicate`, `skipped_suppressed`,
`skipped_invalid`, plus who was skipped and why.

### 2. Flux - verify new prospects
Run it after adding a list. It:

1. Reads your Hunter balance (free) and never asks for more checks than you have left.
2. Takes up to **max_to_verify** prospects with status `new` (set to 10 for the first live test; can go up to 50) that haven't been checked yet, oldest first.
3. Checks each one with Hunter Email Verifier, about 4 per second. Hunter's limit is 10 per
   second and 300 per minute.
4. Sets the result:
   - **verified:** Hunter says valid and the score is 80 or more.
   - **stays new**, with note "catch-all, low priority": Hunter says accept-all (catch-all).
   - **invalid:** any other answer from Hunter, including "unknown" and "webmail".
     `verify_result` shows which, so you can find them later.
   - **left alone and tried next run:** Hunter didn't answer (still checking, rate limit, or
     credits ran out).
5. Shows a summary: `checked`, `verified`, `invalid`, `catch_all_kept_as_new`,
   `not_checked_retry_next_run`, `stopped_because_credits_ran_out`, `credits_left_before_run`.

With 0 credits left it stops before calling Hunter and tells you the reset date. You can
change the 50 and the 80 in the **Settings** node.

### 3. Flux - export send batch
Run it when you want people to email. It:

1. Takes `verified` prospects, oldest first.
2. Leaves out anyone contacted in the last 90 days (`last_contacted_at`), and anyone whose
   email or domain is in `flux_suppression`. So someone who unsubscribes after being verified
   is still never exported.
3. Takes up to **batch_size** people (default 50; change it in **Settings**).
4. Creates a new tab "Send batch 2026-10-01 0930" (Dublin time) in the **Flux Prospects**
   sheet with: email, first name, last name, company, domain, title, LinkedIn URL, list name,
   source and verify score.
5. Marks each exported person `queued`, only after the sheet write worked. Queued people are
   never exported again.

If nobody is ready, it says so and creates no empty tab. **Nothing is ever sent.** You import
the tab into whichever sender you pick.

## How to add a list

**By hand (easiest):**
1. Open **Flux - add prospects** in n8n.
2. Double-click **Paste your list here**.
3. In `data`, paste your list with its header row. CSV straight from Apollo, Clay, Hunter or a
   Google Sheet works (comma, semicolon or tab separated), and so does a JSON list.
4. Set `source`: one of apify, hunter, apollo, clay, website, manual. Anything else is saved
   as `manual`, with the original written in `notes`.
5. Set `list_name` to anything that helps you remember the batch, e.g. "Oct SaaS founders".
6. Click **Execute workflow**, then open **Summary** to see what happened.

Column names it recognises (capitals and spaces don't matter):
- **email** (required)
- **first_name** / "First Name"
- **last_name** / "Last Name"
- **company** / "Company Name"
- **domain** / "Website"
- **title** / "Job Title"
- **linkedin_url** / "LinkedIn"
- **source**
- **list_name**
- **notes**

Other columns are ignored.

**By webhook (after you publish the workflow):** POST to
`https://evanwynne.app.n8n.cloud/webhook/flux-add-prospects` with either of these, and the
summary comes back as the reply:

```json
{"source": "apollo", "list_name": "Oct SaaS founders",
 "prospects": [{"email": "jane@acme.com", "first_name": "Jane", "company": "Acme"}]}
```

```json
{"source": "clay", "csv": "email,first_name\njane@acme.com,Jane"}
```

The webhook has no password. Keep the URL to yourself, or ask Claude to add a header key,
which needs a new credential.

## How to mark someone do_not_contact

Do both of these:

1. **Block them:** n8n → Overview → Data tables → `flux_suppression` → add a row.
   - Put their email in `email` to block one person, or put the company in `domain` (e.g.
     `acme.com`) to block the whole company.
   - Set `reason`: unsubscribe, bounce, competitor, client or lead.
   - Set `added_at`: today.

   This is what the workflows check. From then on the person can't be added again and can't
   be exported, even if they're already verified.
2. **Keep your records right:** n8n → Data tables → `flux_prospects` → find their row → set
   `status` to `do_not_contact`, and add a line in `notes` if useful.

## After you send a batch: Flux - mark contacted
Run **Flux - mark contacted** (n8n workflow `nkQ2KqTdbUGBl8qE`):
1. Double-click **What did you send?** and fill in either:
   - `send_batch_tab`: the tab name from Flux Prospects, e.g. `Send batch 2026-09-30 2046`; or
   - `emails`: paste emails, one per line or comma separated.

   You can fill in both.
2. Optionally fill in `sequence_name` (which campaign) and `contacted_on` (defaults to today;
   format 2026-10-01).
3. Click **Execute workflow**.

Each person found gets `status` = `contacted`, `last_contacted_at` = the send date, and your
`sequence_name`. The export's 90-day rule reads `last_contacted_at`.

People already at `replied`, `meeting`, `client` or `do_not_contact` are **left alone**, so a
later campaign never downgrades them. The summary lists them, plus any emails that aren't in
`flux_prospects`.

Tested 2026-09-30 (run #44, fake rows, deleted afterwards): 2 emails came from the tab and 2
were pasted. 1 `queued` row was marked contacted, the `replied` and `do_not_contact` rows were
left alone, and 1 unknown email was reported as not in the store.

## Setup checklist

- [x] Data tables `flux_prospects` (`t5vVklaYxGRMXJFZ`) and `flux_suppression`
      (`Qc3gr8AHZk1eJ0qM`) created. Suppression list seeded with 6 domains.
- [x] **Flux Prospects** sheet created in Drive → Flux GTM. Its ID stays out of the repo; the
      export workflow file uses `REPLACE_WITH_FLUX_PROSPECTS_SHEET_ID`.
- [x] Error workflow set on all three: GTME – failure alerts (`MrGJ9sB98EIiZz55`).
- [x] Google Sheets credential: reuses "Google Sheets account".
- [x] **Hunter credential** (created 2026-09-30, type Simplified Custom Auth, currently
      named "Simplified Custom Auth account"; rename to "Hunter API (evanwynne)" if you like).
      Auth template `{"qs": {"api_key": "{{api_key}}"}}`. Both Hunter steps use it: **Check
      Hunter credits** and **Hunter email verifier**. Checked with a free account call: Free
      plan, 84 verifications left. The credential's own "Test URL" check shows "not bound to
      its service origin"; ignore it, the workflow call works.
      Make sure no Hunter step ever uses the Apify credential: n8n pre-selects it because it
      is the same credential type.
- [ ] Publish **Flux - add prospects** only if you want the webhook live.

Files in this folder: `*.workflow.ts` is the n8n Workflow SDK source for each workflow. To
rebuild one, ask Claude to create it from the file with the n8n connector. For a plain JSON
copy, use n8n → workflow → ⋯ → Download.

## Tested 2026-09-30 with fake data (all deleted afterwards)

| Run | What was tested | Result |
|---|---|---|
| add #33 (webhook input) | `Dupe.Test@Example.org` (already in table, different case), `fake.person@agnt.ie` (suppressed domain), `test@example.com` (new) | added 1, skipped_duplicate 1, skipped_suppressed 1; email lowercased, domain and LinkedIn cleaned |
| add #34 (pasted CSV) | quoted comma in a field, "First Name"-style headers, `ceo@sub.staffviser.com`, `not-an-email` | added 0, duplicate 1, suppressed 1 (subdomain), invalid 1 |
| verify #35 (Hunter pinned, 0 credits) | out of credits | stopped cleanly with the reset date; nothing changed |
| verify #36 (Hunter pinned) | catch-all / valid 95 / invalid 12 | new + note / verified / invalid; 0 Hunter credits spent |
| export #37 (real sheet write) | 1 verified prospect | tab created with a header row and 1 row; prospect marked queued |
| export #38 | verified-then-unsubscribed prospect; already-queued prospect | skipped_suppressed 1, no re-export, no empty tab |

First live run, 2026-09-30: 10 real prospects (Irish recruitment founders) added with add run
#41 (added 10). Verify run #42 checked all 10 with Hunter: 10 verified (scores 89–100), 0
invalid, 0 catch-all.

Not tested live: Hunter's real responses for "rate limit" (403), "out of credits" mid-run
(429) and "still checking" (202). The code leaves those rows alone either way. Which error
code Hunter uses for "out of credits" is **unverified**.

## Notes
- Hunter costs seen on 2026-09-30: 10 Domain Searches through the Hunter connector (limit 1,
  executive seniority) used 10 search credits **and 20 verifications**. The Hunter tool
  description only mentions search credits, and the reason for the extra verifications is
  **unverified**. Check the balance before and after any Hunter search batch.
- The first live verify run (2026-09-30, 10 real prospects) used 10 verifications **and 5
  search credits**, so each check apparently also counts as half a search credit (observed, not
  documented). Budget for both counters.
- You're in the EU. These tables hold personal data (names, work emails), so keep your
  lawful-basis note for outreach handy and honour opt-outs through `flux_suppression`. Never
  commit real lead lists to this repo.
- Your Hunter Free plan had 84 verifications left on 2026-09-30, resetting 2026-10-05.
