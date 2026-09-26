---
name: gtme-leadflow-intake
description: Turn a client's lead-gen request into an approved, buildable flow spec. Creates a client intake form with the Typeform connector (every question needed to design the flow), turns the answers into a spec, then walks Evan through the Apify budget (per-run cap, cadence, monthly ceiling) before anything is built. Use when Evan has a new client or lead-gen flow to scope — e.g. "new client wants leads", "describe the lead gen flow I want", "scope/intake for <client>", "set up a lead flow for <client>".
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

## Step 1 — Quick context from Evan (chat, ≤ 5 questions)

Ask only what the form needs to be tailored; skip anything Evan already said:
client name and website, what they sell (one line), where leads should land (Clay / Attio /
sheet / client CRM), deadline, anything already agreed on the call.

## Step 2 — Create the intake form (Typeform connector)

1. Check the Typeform connector is loaded (ToolSearch `typeform`). If it is missing, tell Evan
   to add it at claude.ai/customize/connectors (custom connector URL `https://api.typeform.com/mcp`,
   OAuth — Typeform labels it beta) and start a new session. Offer Tally (already connected)
   as a fallback, but only switch if Evan says so.
2. Build `<Client> — Lead gen intake` from `references/question-bank.md`:
   - Keep it to ~20 questions; prefer multiple choice; use logic jumps to skip sections that
     don't apply (e.g. skip EU questions if they don't sell into the EU).
   - Mark a question required only if the flow can't be designed without it.
   - Budget questions are **not** in the client form unless Evan asks for them (Step 5 is
     Evan-only).
3. Reply with the share link and the edit link. Record the form ID in the spec (Step 4).

## Step 3 — Read the answers

When Evan says the client has replied, pull the responses through the connector. List any
missing required answers for Evan to chase — don't guess them.

## Step 4 — Draft the flow spec

Write `data/clients/<client-slug>/flow-spec.md` using `references/spec-template.md`. For each
source, find 1–3 candidate Apify Actors with `search-actors`, then `fetch-actor-details`
(pricing, monthly users, last modified, deprecation). Prefer maintained, widely used Actors.
Put open questions at the bottom instead of inventing answers.

## Step 5 — Apify budget with Evan (always, before any build)

Ask Evan, in one message:
1. Monthly Apify ceiling for this client, and whose Apify account pays (Evan's or client's)?
2. Cadence — propose one from the client's volume target (daily / weekly / monthly).
3. Hard cap per run — becomes `maxTotalChargeUsd` on every run call, no exceptions.
4. Paid add-ons allowed? (full profiles, emails, comments/reactions, extra pages)

Then show a small table from live pricing: events per run × price = cost per run; runs per
month; worst case per month = cap × runs. If the volume target doesn't fit the ceiling, say so
and offer trade-offs (fewer items per run, cheaper Actor, lower cadence, narrower query).
Write the agreed numbers into the spec's Budget section.

## Step 6 — Hand-off

Summarise the spec and budget in chat and ask Evan to approve. On a yes, offer to build it the
repo way: n8n workflow with the Apify cap in the run URL, the `GTME – failure alerts` error
workflow set, dedupe before scoring, a published version, and `workflows/<slug>/README.md` with
the setup and test checklist. Don't start building without that yes.
