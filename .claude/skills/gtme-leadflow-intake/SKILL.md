---
name: gtme-leadflow-intake
description: Turn a client's lead-gen request into an approved, buildable flow spec. Creates a client intake form with the Tally connector covering every question needed to design the flow, including an Apify budget page (monthly ceiling, who pays, cadence, per-run cap, paid extras). Turns the answers into a spec before anything is built. Use when Evan has a new client or lead-gen flow to scope — e.g. "new client wants leads", "describe the lead gen flow I want", "scope/intake for <client>", "set up a lead flow for <client>".
---

# gtme-leadflow-intake

Goal: go from "client X wants leads" to an approved flow spec plus an Apify budget, without
Evan writing requirements by hand. Building the flow is a separate, later step.

## Guardrails (from CLAUDE.md — always apply)

- Never send the form or any email to the client. Give Evan the share link; he sends it.
- Never run a paid Apify Actor during intake. Pricing lookups (`fetch-actor-details`) are free.
- Verify every tool/Actor claim live (Apify connector or web search) and cite it; mark anything
  unverified as **unverified**.
- Flag sources that may breach a site's terms or GDPR (LinkedIn scraping, EU personal data) and
  get Evan's explicit OK before they go into the spec.
- The spec holds criteria only — no prospect names, emails or lead lists in the repo.

## Step 1 — Research the client, ask Evan as little as possible

- **Research, don't ask:** work out what the client sells, which markets and roles they serve,
  and their deal model from their website and a web search (cite the sources). Never ask Evan
  what the client sells.
- **Never ask about deadlines.**
- **Default destination:** a new tab named after the client in Evan's GTME Leads Google Sheet
  (Drive). Create the tab with the `gtme-n8n-oneoff` skill (Google Sheets "create sheet").
  Only ask about the destination if Evan names a different one.
- **Ask Evan only for what's missing (≤ 2 questions):** client name/website, and anything
  already agreed on the call (target countries, company size, titles, off-limits sources).
  Whatever he's already said is settled — leave it out of the client form.

## Step 2 — Create the intake form (Tally connector)

`create_new_form` creates a draft form straight away. Every edit after that is saved as an
unpublished change. Nothing goes live until you call `publish_form`.

1. Check the Tally tools are loaded (ToolSearch `tally`). If not, tell Evan to enable the Tally
   connector for this chat — don't switch to another form tool.
2. `list_workspaces` → use the personal workspace if there is one, otherwise ask Evan.
3. `create_new_form` with title `<Client> — Lead gen intake` and submit text "Send".
4. `create_blocks` from `references/question-bank.md`, one page per section (`PAGE_BREAK`
   with a page name). Block mapping:
   - multi-select → `TITLE` + `CHECKBOX` options; single choice → `MULTIPLE_CHOICE_OPTION`
     (or `DROPDOWN_OPTION` for long lists); yes/no → two `MULTIPLE_CHOICE_OPTION`s
   - short text → `INPUT_TEXT`; long text → `TEXTAREA`; website → `INPUT_LINK`;
     number → `INPUT_NUMBER`; exclusion or suppression lists → `FILE_UPLOAD`
   - "+ Other" in the bank means `isOtherOption: true` on a last option.
   Start with a short intro `TEXT` block stating what's already agreed (e.g. target region and
   company size) so the client only confirms it instead of answering it again.
   Keep it to ~25 questions, including the Budget page. Tally makes every question required by default — use
   `configure_blocks` to make the non-(req) ones optional.
5. `apply_logic` for skips, e.g. hide the Compliance page unless they contact people in the
   EU/UK (use the uuids from the form ledger).
6. Always include the **Budget** page (section J of the question bank) as the last page before
   submit. Use `INPUT_NUMBER` for the USD amounts. Add no calculated fields, totals or cost
   estimates: Evan does the calculations himself from the answers.
7. Give Evan the edit link (`https://tally.so/forms/<id>/edit`) to review. Only after he says
   it's good, call `publish_form` and hand him the share URL to send. Record the form ID in
   the spec (Step 4).

## Step 3 — Read the answers

When Evan says the client has replied, `fetch_submissions` with the form ID (status
`completed`). List any missing required answers for Evan to chase — don't guess them. Answers
stay in Tally; the spec summarises criteria only.

## Step 4 — Draft the flow spec

Write `data/clients/<client-slug>/flow-spec.md` using `references/spec-template.md`. For each
source, find 1–3 candidate Apify Actors with `search-actors`, then `fetch-actor-details`
(pricing, monthly users, last modified, deprecation). Prefer maintained, widely used Actors.
Put open questions at the bottom instead of inventing answers.

## Step 5 — Budget from the form (always, before any build)

Copy the Budget page answers into the spec's Budget section as given: monthly ceiling, who
pays, cadence, per-run cap and paid extras. Don't calculate costs or build cost tables. Evan
does that himself from Tally. The per-run cap becomes `maxTotalChargeUsd` on every run call,
with no exceptions. If a budget answer is missing, list it for Evan to chase.

## Step 6 — Hand-off

Summarise the spec and budget in chat and ask Evan to approve. On a yes, offer to build it the
repo way: n8n workflow with the Apify cap in the run URL, the `GTME – failure alerts` error
workflow set, dedupe before scoring, a published version, and `workflows/<slug>/README.md` with
the setup and test checklist. Don't start building without that yes.
