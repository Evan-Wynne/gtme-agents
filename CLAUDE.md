# GTM engineering repo — rules for Claude

This repo supports Evan's go-to-market work (lead sourcing, enrichment, outreach, pipeline in Attio).

## Guardrails (always)
- Ask Evan before: sending any email, spending money, bulk-writing to the CRM, or scraping in ways that may breach a site's terms or GDPR (Evan is in the EU).
- Never invent data, contacts, or tool features. Mark anything unverified as unverified.
- Research tools with a live web search before recommending them; cite the current docs link.
- Never commit personal data (lead lists, emails) — only schemas, specs, workflows, and aggregate reports.

## Conventions
- Workflows: n8n by default; each ships as importable JSON/code plus a setup checklist (credentials, triggers, test steps), with error handling, retries, and run logging.
- n8n production workflows set `GTME – failure alerts` as their error workflow, and every Apify call carries a `maxTotalChargeUsd` hard cap agreed with Evan.
- Tool shortlist lives in `TOOLS.md`.

## Skills
- Every skill for Evan is named `gtme-<name>` and lives in `.claude/skills/gtme-<name>/`.
- When a `gtme-` skill fits the task, say in one line which skill and why, then invoke it. `.claude/settings.json` asks Evan to approve every `gtme-` skill call, so he just clicks approve (or declines and Claude works without it).
- Whenever Evan seems to be doing the same kind of task again (same steps twice, or clearly recurring work like client intake, backfills, run debugging), suggest turning it into a `gtme-` skill: one line with a proposed name and what it would do. Create it only after he says yes.
