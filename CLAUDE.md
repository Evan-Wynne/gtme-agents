# GTM engineering repo — rules for Claude

This repo supports Evan's go-to-market work (lead sourcing, enrichment, outreach, pipeline in Attio).

## Guardrails (always)
- Ask Evan before: sending any email, spending money, bulk-writing to the CRM, or scraping in ways that may breach a site's terms or GDPR (Evan is in the EU).
- Never invent data, contacts, or tool features. Mark anything unverified as unverified.
- Research tools with a live web search before recommending them; cite the current docs link.
- Never commit personal data (lead lists, emails) — only schemas, specs, workflows, and aggregate reports.

## Conventions
- Workflows: n8n by default; each ships as importable JSON/code plus a setup checklist (credentials, triggers, test steps), with error handling, retries, and run logging.
- Tool shortlist lives in `TOOLS.md`.
