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

## Data & GDPR

Evan is in the EU. Do not commit lead lists, emails, or other personal data to this repo.
Keep them in Clay / Attio; commit only schemas, specs, and aggregate reports.
`.gitignore` blocks common export formats in `data/` as a safety net.
