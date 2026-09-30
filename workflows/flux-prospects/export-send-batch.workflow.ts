import { workflow, node, trigger, sticky, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const runExport = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run export' },
  output: [{}]
});

const settings = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Settings',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'exp-n', name: 'batch_size', value: 50, type: 'number' }
        ]
      },
      options: {}
    }
  },
  output: [{ batch_size: 50 }]
});

const getVerified = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Get verified prospects',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 't5vVklaYxGRMXJFZ', cachedResultName: 'flux_prospects' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'status', condition: 'eq', keyValue: 'verified' }] },
      returnAll: true,
      orderBy: true,
      orderByColumn: 'createdAt',
      orderByDirection: 'ASC'
    }
  },
  output: [{ id: 2, email: 'jane@acme.com', status: 'verified', last_contacted_at: null }]
});

const loadSuppression = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Load suppression list',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'Qc3gr8AHZk1eJ0qM', cachedResultName: 'flux_suppression' },
      returnAll: true
    }
  },
  output: [{ id: 1, email: '', domain: 'staffviser.com', reason: 'existing client/lead' }]
});

const pickBatch = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Pick send batch',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Verified, not contacted in the last 90 days, not on the suppression list. Oldest first, up to batch_size.
const n = Math.max(0, Math.floor(Number($('Settings').first().json.batch_size) || 0));
const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
const clean = (v) => String(v == null ? '' : v).trim().toLowerCase();
const cleanDomain = (v) => {
  let d = clean(v);
  if (d.includes('@')) d = d.split('@').pop();
  d = d.replace(/^[a-z]+:\\/\\//, '').replace(/^www\\./, '');
  return d.split(/[\\/?#:]/)[0];
};
const supEmails = new Set();
const supDomains = new Set();
for (const i of $('Load suppression list').all()) {
  const e = clean(i.json.email);
  if (e) supEmails.add(e);
  const d = cleanDomain(i.json.domain);
  if (d) supDomains.add(d);
}
const domainSuppressed = (d) => {
  if (!d) return false;
  if (supDomains.has(d)) return true;
  for (const s of supDomains) { if (d.endsWith('.' + s)) return true; }
  return false;
};
const rows = $('Get verified prospects').all().map((i) => i.json).filter((r) => r && r.email && r.status === 'verified');
const eligible = [];
let skippedRecent = 0;
let skippedSuppressed = 0;
for (const r of rows) {
  const email = clean(r.email);
  if (supEmails.has(email) || domainSuppressed(email.split('@')[1]) || domainSuppressed(cleanDomain(r.domain))) { skippedSuppressed++; continue; }
  const last = r.last_contacted_at ? new Date(r.last_contacted_at).getTime() : 0;
  if (last && last > cutoff) { skippedRecent++; continue; }
  eligible.push(r);
}
const batch = eligible.slice(0, n).map((r) => ({
  email: clean(r.email),
  first_name: r.first_name || '',
  last_name: r.last_name || '',
  company: r.company || '',
  domain: r.domain || '',
  title: r.title || '',
  linkedin_url: r.linkedin_url || '',
  list_name: r.list_name || '',
  source: r.source || '',
  verify_score: r.verify_score == null ? '' : r.verify_score,
}));
return [{ json: {
  tab_name: 'Send batch ' + $now.toFormat('yyyy-MM-dd HHmm'),
  batch_size: n,
  verified_found: rows.length,
  skipped_contacted_last_90_days: skippedRecent,
  skipped_suppressed: skippedSuppressed,
  exported: batch.length,
  rows: batch,
} }];`
    }
  },
  output: [{ tab_name: 'Send batch 2026-09-30 1830', batch_size: 50, verified_found: 1, skipped_contacted_last_90_days: 0, skipped_suppressed: 0, exported: 1, rows: [{ email: 'jane@acme.com', first_name: 'Jane' }] }]
});

const anythingToExport = ifElse({
  version: 2.2,
  config: {
    name: 'Anything to export?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.rows.length }}'), operator: { type: 'number', operation: 'gt' }, rightValue: 0 }],
        combinator: 'and'
      }
    }
  }
});

const createTab = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Create send batch tab',
    executeOnce: true,
    parameters: {
      resource: 'sheet',
      operation: 'create',
      authentication: 'oAuth2',
      documentId: { __rl: true, mode: 'id', value: 'REPLACE_WITH_FLUX_PROSPECTS_SHEET_ID', cachedResultName: 'Flux Prospects' },
      title: expr('{{ $json.tab_name }}'),
      options: {}
    },
    credentials: { googleSheetsOAuth2Api: newCredential('Google Sheets account') }
  },
  output: [{ sheetId: 123, title: 'Send batch 2026-09-30 1830' }]
});

const rowsToWrite = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Rows to write',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `return $('Pick send batch').first().json.rows.map((r) => ({ json: r }));`
    }
  },
  output: [{ email: 'jane@acme.com', first_name: 'Jane', last_name: '', company: 'Acme', domain: 'acme.com', title: '', linkedin_url: '', list_name: '', source: 'manual', verify_score: 95 }]
});

const writeRows = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Write rows to sheet',
    parameters: {
      resource: 'sheet',
      operation: 'append',
      authentication: 'oAuth2',
      documentId: { __rl: true, mode: 'id', value: 'REPLACE_WITH_FLUX_PROSPECTS_SHEET_ID', cachedResultName: 'Flux Prospects' },
      sheetName: { __rl: true, mode: 'name', value: expr("{{ $('Pick send batch').first().json.tab_name }}") },
      columns: {
        mappingMode: 'autoMapInputData',
        value: {},
        schema: [
          { id: 'email', displayName: 'email', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'first_name', displayName: 'first_name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'last_name', displayName: 'last_name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'company', displayName: 'company', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'domain', displayName: 'domain', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'title', displayName: 'title', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'linkedin_url', displayName: 'linkedin_url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'list_name', displayName: 'list_name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'source', displayName: 'source', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'verify_score', displayName: 'verify_score', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: { cellFormat: 'RAW' }
    },
    credentials: { googleSheetsOAuth2Api: newCredential('Google Sheets account') }
  },
  output: [{ email: 'jane@acme.com', first_name: 'Jane' }]
});

const markQueued = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Mark as queued',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: 't5vVklaYxGRMXJFZ', cachedResultName: 'flux_prospects' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'email', condition: 'eq', keyValue: expr("{{ $('Rows to write').item.json.email }}") }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          status: 'queued',
          updated_at: expr('{{ $now.toISO() }}')
        },
        schema: [
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'updated_at', displayName: 'updated_at', required: false, defaultMatch: false, display: true, type: 'dateTime', canBeUsedToMatch: true }
        ]
      },
      options: {}
    }
  },
  output: [{ id: 2, email: 'jane@acme.com', status: 'queued' }]
});

const summary = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Summary',
    executeOnce: true,
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'e-exported', name: 'exported', value: expr("{{ $('Pick send batch').first().json.exported }}"), type: 'number' },
          { id: 'e-tab', name: 'tab_name', value: expr("{{ $('Pick send batch').first().json.tab_name }}"), type: 'string' },
          { id: 'e-url', name: 'sheet_url', value: 'https://docs.google.com/spreadsheets/d/REPLACE_WITH_FLUX_PROSPECTS_SHEET_ID/edit', type: 'string' },
          { id: 'e-found', name: 'verified_found', value: expr("{{ $('Pick send batch').first().json.verified_found }}"), type: 'number' },
          { id: 'e-recent', name: 'skipped_contacted_last_90_days', value: expr("{{ $('Pick send batch').first().json.skipped_contacted_last_90_days }}"), type: 'number' },
          { id: 'e-sup', name: 'skipped_suppressed', value: expr("{{ $('Pick send batch').first().json.skipped_suppressed }}"), type: 'number' },
          { id: 'e-queued', name: 'marked_queued', value: expr('{{ $input.all().length }}'), type: 'number' }
        ]
      },
      options: {}
    }
  },
  output: [{ exported: 1, tab_name: 'Send batch 2026-09-30 1830', sheet_url: 'https://docs.google.com/', verified_found: 1, skipped_contacted_last_90_days: 0, skipped_suppressed: 0, marked_queued: 1 }]
});

const nothingToExport = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Nothing to export',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'x-msg', name: 'message', value: 'No verified prospects are ready to send (not contacted in 90 days, not suppressed). No tab created.', type: 'string' },
          { id: 'x-found', name: 'verified_found', value: expr('{{ $json.verified_found }}'), type: 'number' },
          { id: 'x-recent', name: 'skipped_contacted_last_90_days', value: expr('{{ $json.skipped_contacted_last_90_days }}'), type: 'number' },
          { id: 'x-sup', name: 'skipped_suppressed', value: expr('{{ $json.skipped_suppressed }}'), type: 'number' }
        ]
      },
      options: {}
    }
  },
  output: [{ message: 'No verified prospects are ready to send.', verified_found: 0, skipped_contacted_last_90_days: 0, skipped_suppressed: 0 }]
});

const howTo = sticky(
  '## Flux - export send batch\nSet how many people you want in **Settings** (batch_size), then click **Execute workflow**.\n\nPicks `verified` prospects (oldest first) who were not contacted in the last 90 days and are not on **flux_suppression**, writes them to a new tab **Send batch <date time>** in the **Flux Prospects** sheet (Drive > Flux GTM), then marks them `queued` so they are never exported twice.\n\nNothing is sent. Import the tab into your sender yourself.',
  [settings, getVerified],
  { color: 4 }
);

export default workflow('flux-export-send-batch', 'Flux - export send batch')
  .add(runExport)
  .to(settings)
  .to(getVerified)
  .to(loadSuppression)
  .to(pickBatch)
  .to(anythingToExport
    .onTrue(createTab.to(rowsToWrite).to(writeRows).to(markQueued).to(summary))
    .onFalse(nothingToExport))
  .add(howTo)
  .group('Pick who to export', [settings, getVerified, loadSuppression, pickBatch], { description: 'Verified prospects, not contacted in 90 days, not suppressed. Oldest first, up to batch_size.' })
  .group('Write the sheet tab and mark queued', [createTab, rowsToWrite, writeRows, markQueued, summary], { description: 'Creates the Send batch tab in Flux Prospects, writes the rows, then marks each person queued.' });
