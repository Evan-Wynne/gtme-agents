---
name: gtme-n8n-oneoff
description: Run a single job inside Evan's n8n cloud through a throwaway workflow — build it, run it once, verify the result, archive it. Use for one-time sheet fixes and backfills (clean a column in a Google Sheet, push existing rows to a Clay webhook table), testing an error/alert workflow, or any one-off step that needs an n8n credential or network access Claude doesn't have directly (Google Sheets writes, Gmail, Clay/Apify APIs blocked from the sandbox). Not for recurring automations — those get a real workflow with a checklist in workflows/.
---

# gtme-n8n-oneoff

A throwaway n8n workflow is how Claude does a one-time write with Evan's own credentials:
the Drive connector can't edit cells, and the sandbox can't reach Clay or Apify. Proven
templates are in `references/patterns.md`.

## Step 0 — Scope it with Evan (one message)

Say what will change, where, and roughly how many rows/items. Per CLAUDE.md, get an explicit
yes first if the job sends email, spends money, bulk-writes to the CRM (Attio), or scrapes.

## Step 1 — Look before touching

- Read the target's current state: Google Drive connector (`read_file_content`, or
  `download_file_content` as xlsx/csv) for sheets; n8n `list_credentials` to find the
  credential to reuse; `explore_node_resources` (Google Sheets `sheetsSearch`) for exact tab
  names — they're case-sensitive.
- Note the "before" (row count, a sample value) in chat, not in the repo.

## Step 2 — Build the throwaway workflow

1. `get_workflow_sdk_reference` (once per session) and `get_node_types` for every node used.
2. Name it `TEMP: <what it does>`; description says "Archive after running".
3. Pick the trigger:
   - **Manual Trigger** for sheet/API jobs → run in `manual` mode.
   - **Webhook trigger** when it must be a *production* run (error workflows only fire on
     production failures) → set `errorWorkflow` with `update_workflow`, `publish_workflow`,
     then run in `production` mode with `webhookData`.
4. Reuse existing credentials: `newCredential('<exact existing name>')` auto-assigns — check
   `autoAssignedCredentials` in the create result. Never put secrets in parameters.
5. Make writes safe:
   - Match rows on a unique column (e.g. `post_url`), never by position.
   - Throttle external calls (HTTP Request batching, e.g. 5 per second for Clay's 10/s limit).
   - Prefer idempotent writes, so an accidental second run doesn't duplicate.
6. `validate_workflow` → `create_workflow_from_code`.

## Step 3 — Run once

`execute_workflow`, then `get_workflow_execution`. For runs longer than a few seconds, start a
background `sleep 60` and re-check when it completes — don't poll in a tight loop.

## Step 4 — Verify

- Item counts per node match what Step 1 predicted.
- Read the target back: the sheet via Drive, Clay webhook responses all `OK`, Gmail send
  output has `labelIds` including `SENT`.
- Report before → after in chat.

## Step 5 — Clean up

`archive_workflow` on the TEMP workflow (this also takes its webhook offline). If the run
failed halfway, check what was already written before re-running — never re-run blind.

## Gotchas seen so far

- **HTTP 423** from n8n = Evan has that workflow open in the editor. Ask him to close the tab,
  or read the current state and work around it.
- An **error workflow** must be published (with its credential attached) before any workflow
  can point `errorWorkflow` at it.
- **Drafts don't run in production**; production runs use the published version.
- Google Sheets **update** needs `matchingColumns`; **append** to an empty tab creates the
  header row from the first item's keys.
- If the same one-off is needed a third time, suggest making it a permanent workflow.
