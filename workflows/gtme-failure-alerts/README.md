# GTME – failure alerts (n8n)

Shared error workflow: when a GTME workflow that points to it fails **in production**, it
emails the workflow name, the failed step, the error message and a link to the failed run.

- Lives in n8n cloud as workflow `MrGJ9sB98EIiZz55`; `workflow.json` is an importable export.
- Manual/test runs never trigger it — only scheduled, webhook and other production runs.

## Setup checklist

- [ ] n8n credential **Gmail account** (Gmail OAuth2 → Sign in with Google) attached to
      `Email failure alert`. Until then n8n refuses to publish this workflow.
- [ ] `sendTo` is Evan's inbox (the export has `REPLACE_WITH_ALERT_EMAIL`).
- [ ] Workflow published (an error workflow must have a published version to run).
- [ ] Each production GTME workflow has it set under Workflow settings → Error workflow.

## Test steps

1. Temporarily break a copy of a GTME workflow (e.g. wrong sheet tab name), set this as its
   error workflow, publish it and run it in production mode.
2. Expect one email titled `[n8n] <workflow> failed at <step>` with a working run link.
3. Delete the broken copy.
