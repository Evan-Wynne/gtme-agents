# Proven one-off patterns (n8n Workflow SDK)

All three ran successfully on 2026-09-26. Replace `<SHEET_ID>`, `<TAB>` and `<WEBHOOK_URL>`
with real values at run time — never commit them. Validate before creating.

## 1. Fix a column in a Google Sheet (update rows in place)

Manual Trigger → Google Sheets **read** → Set (compute new value) → Google Sheets **update**
matched on a unique column.

```typescript
import { workflow, node, trigger, newCredential, expr } from '@n8n/workflow-sdk';

const start = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1,
  config: { name: 'Run once', output: [{}] } });

const readRows = node({ type: 'n8n-nodes-base.googleSheets', version: 4.7, config: {
  name: 'Read tab',
  parameters: { resource: 'sheet', operation: 'read',
    documentId: { __rl: true, mode: 'id', value: '<SHEET_ID>' },
    sheetName: { __rl: true, mode: 'name', value: '<TAB>' }, options: {} },
  credentials: { googleSheetsOAuth2Api: newCredential('Google Sheets account') },
  output: [{ post_url: 'https://…', linkedin_url: 'https://…?x=1', row_number: 2 }] } });

const fix = node({ type: 'n8n-nodes-base.set', version: 3.4, config: {
  name: 'Compute new value',
  parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [
    { id: 'k', name: 'post_url', value: expr('{{ $json.post_url }}'), type: 'string' },
    { id: 'v', name: 'linkedin_url', value: expr("{{ String($json.linkedin_url || '').split('?')[0] }}"), type: 'string' } ] } },
  output: [{ post_url: 'https://…', linkedin_url: 'https://…' }] } });

const update = node({ type: 'n8n-nodes-base.googleSheets', version: 4.7, config: {
  name: 'Update rows',
  parameters: { resource: 'sheet', operation: 'update',
    documentId: { __rl: true, mode: 'id', value: '<SHEET_ID>' },
    sheetName: { __rl: true, mode: 'name', value: '<TAB>' },
    columns: { mappingMode: 'defineBelow',
      value: { post_url: expr('{{ $json.post_url }}'), linkedin_url: expr('{{ $json.linkedin_url }}') },
      matchingColumns: ['post_url'],
      schema: [
        { id: 'post_url', displayName: 'post_url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
        { id: 'linkedin_url', displayName: 'linkedin_url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true } ] },
    options: {} },
  credentials: { googleSheetsOAuth2Api: newCredential('Google Sheets account') },
  output: [{ post_url: 'https://…', linkedin_url: 'https://…' }] } });

export default workflow('temp-sheet-fix', 'TEMP: fix <column> in <TAB>')
  .add(start).to(readRows).to(fix).to(update);
```

## 2. Backfill sheet rows to a webhook (e.g. a Clay table)

Manual Trigger → Google Sheets **read** → HTTP Request POST, throttled.

```typescript
const send = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: {
  name: 'Send to webhook',
  parameters: { method: 'POST', url: '<WEBHOOK_URL>', sendBody: true, contentType: 'json',
    specifyBody: 'json',
    jsonBody: expr('{{ JSON.stringify({ name: $json.name, linkedin_url: $json.linkedin_url }) }}'),
    options: { batching: { batch: { batchSize: 5, batchInterval: 1000 } } } },
  retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
  output: [{ data: 'OK' }] } });
// workflow(...).add(start).to(readRows).to(send)
```

Verify: every output item is `{ data: 'OK' }` (Clay's plain-text reply).

## 3. Test an error/alert workflow (production failure)

Webhook trigger → Stop and Error. After creating: `update_workflow` →
`setWorkflowSettings { errorWorkflow: '<alert workflow id>' }`, `publish_workflow`, then
`execute_workflow` with `executionMode: 'production'`, `triggerNodeName: 'Test trigger'`,
`inputs: { webhookData: { method: 'POST', body: { test: true } } }`.

```typescript
const hook = trigger({ type: 'n8n-nodes-base.webhook', version: 2.1, config: {
  name: 'Test trigger',
  parameters: { httpMethod: 'POST', path: 'temp-alert-test-<random>', responseMode: 'onReceived', options: {} },
  output: [{ body: {}, headers: {}, query: {}, params: {} }] } });

const fail = node({ type: 'n8n-nodes-base.stopAndError', version: 1, config: {
  name: 'Fail on purpose',
  parameters: { errorType: 'errorMessage', errorMessage: 'TEST ALERT - safe to ignore.' },
  output: [{}] } });
// workflow(...).add(hook).to(fail)
```

Verify: `search_workflow_executions` on the alert workflow shows a new `mode: error` run with
status `success`, and the Gmail step output has `labelIds` containing `SENT`. This sends Evan
a real email — ask first.
