# gtme-agents

GTM engineering workspace: find leads, enrich them, reach out, track the pipeline — automated where it's worth it.

## Layout

| Path | Owner | Contents |
|------|-------|----------|
| `TOOLS.md` | SCOUT | Researched tool shortlist per job, with verdicts and doc links |
| `data/` | DATA | ICP definitions, enrichment specs, hit-rate / cost reports (no raw personal data — see below) |
| `workflows/` | AUTOMATOR | Importable n8n JSON, scripts, and a setup checklist per workflow |
| `crm/` | OPS | Attio object/list/pipeline schema and field-hygiene rules |
| `outreach/` | OPS | Sequence drafts and copy — never sent without Evan's approval |

## Skills

Claude skills in `.claude/skills/`. A chat opened in this repo loads them; `gtme-sync-skills`
packages them for Evan's claude.ai account.

| Skill | Use it to |
|-------|-----------|
| `gtme-leadflow-intake` | Scope a new client: Tally intake form → flow spec → Apify budget |
| `gtme-jev-scoring` | Turn an ICP into tested Jev questions plus weights, thresholds and tiers in code; score a list once |
| `gtme-signal-pipeline` | Build a signal workflow in n8n: scrape (capped) → dedupe → Jev qualify → enrich passes → score → contacts |
| `gtme-score-review` | Grade a scoring run, name the failure patterns, fix them and re-run on the same items |
| `gtme-cold-batch-writer` | Write 3-touch cold emails for a Flux send batch as Gmail drafts |
| `gtme-n8n-oneoff` | One-time sheet fixes, backfills and tests through a throwaway n8n workflow |
| `gtme-handoff` | Stop cleanly and hand Evan a context file for a new chat |
| `gtme-sync-skills` | Package changed skills as `.skill` files to install in claude.ai |

New client, in order: intake → jev-scoring (design and test) → signal-pipeline → score-review
→ contacts and copy. Repeat score-review after every change to questions or rules.

## Data & GDPR

Evan is in the EU. Do not commit lead lists, emails, or other personal data to this repo.
Keep them in Clay / Attio; commit only schemas, specs, and aggregate reports.
`.gitignore` blocks common export formats in `data/` as a safety net.
