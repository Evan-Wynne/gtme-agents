---
name: gtme-cold-batch-writer
description: Turn a Send batch tab from the Flux Prospects Google Sheet into personalised, compliant 3-touch cold emails. Email 1 for each prospect is saved as a Gmail draft for Evan to review, never sent; emails 2 and 3 go in a Google Doc. Use when Evan says "write the batch", "draft emails for the send batch", or names a Send batch tab.
---

# gtme-cold-batch-writer (Flux GTM)

Use when Evan says "write the batch", "draft emails for the send batch", or names a Send batch tab.

## Inputs
- Google Drive: sheet "Flux Prospects" (folder "Flux GTM"). Use the newest tab named `Send batch YYYY-MM-DD HHMM` unless Evan names one.
- Columns: email, first_name, last_name, company, domain, title, linkedin_url, list_name, source, verify_score.
- Offer context: Notion page "Offerings" under "Flux GTM (fluxgtm.com)". Brand voice: Google Doc "FluxGTM brand guide".

## Steps
1. Read the tab. Skip any row where verify_score < 80, email is blank, or the email domain differs from `domain` — list skipped rows with the reason.
2. For each remaining row, do ONE light research pass (company website homepage via web fetch; LinkedIn URL only as a label, don't scrape it). Pull one specific, verifiable detail (a niche they recruit for, a recent post/news item, team size). If nothing specific is found, use the role/niche from `title` — never invent facts.
3. Write 3 emails per prospect:
   - **Email 1 (day 0):** ≤90 words. Subject ≤5 words, lowercase, no clickbait. Line 1 = the specific detail. Then the problem (recruiters spend hours on BD instead of placing), the offer in one line (Flux runs outbound to hiring managers so their consultants only take booked calls), one soft CTA question ("worth a 15-min look?"). No links, no images, no attachments in email 1.
   - **Email 2 (day 3):** ≤50 words, reply in same thread, one new angle (e.g. pilot terms / what the first 21 days look like).
   - **Email 3 (day 7):** ≤35 words, polite breakup, offer to send a 1-page plan instead.
4. Every email ends with this footer (Irish ePrivacy rules: sender identity must be clear and an opt-out offered in every B2B marketing email):
   `Evan Wynne · Flux GTM · fluxgtm.com`
   `Not relevant? Reply "no" and I won't email again.`
5. Plain text only. No spam-trigger words (free, guarantee, 100%, act now), no exclamation marks, max one question mark per email.
6. Save **only Email 1** for each prospect as a Gmail draft from evan@fluxgtm.com (Gmail `create_draft`). Never send. Put emails 2 and 3 in a new Google Doc "Follow-ups <tab name>" in the Flux GTM folder, grouped by prospect, with the send-on date.
7. Reply to Evan with: number of drafts created, skipped rows + reasons, and the reminder: "After sending, run n8n *Flux - mark contacted* with this tab name. Anyone who replies 'no' → add to flux_suppression."

## Guardrails
- Max 20 drafts per run (protects the fluxgtm.com primary domain until a separate sending domain + warmed inboxes exist).
- Never email anyone already marked contacted/replied/do_not_contact in the prospects store.
- Never claim results, clients or case studies Flux doesn't have.