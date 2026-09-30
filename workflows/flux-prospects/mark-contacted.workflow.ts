import { workflow, node, trigger, sticky, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const runMark = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run manually' },
  output: [{}]
});

const whatSent = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'What did you send?',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'mc-tab', name: 'send_batch_tab', value: '', type: 'string' },
          { id: 'mc-emails', name: 'emails', value: '', type: 'string' },
          { id: 'mc-seq', name: 'sequence_name', value: '', type: 'string' },
          { id: 'mc-date', name: 'contacted_on', value: expr("{{ $today.toFormat('yyyy-MM-dd') }}"), type: 'string' }
        ]
      },
      options: {}
    }
  },
  output: [{ send_batch_tab: 'Send batch 2026-09-30 2046', emails: '', sequence_name: 'Oct recruiters v1', contacted_on: '2026-10-01' }]
});

const loadProspects = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Load prospects',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 't5vVklaYxGRMXJFZ', cachedResultName: 'flux_prospects' },
      returnAll: true
    }
  },
  output: [{ id: 1, email: 'jane@acme.com', status: 'queued', sequence_name: null }]
});

const tabGiven = ifElse({
  version: 2.2,
  config: {
    name: 'Send batch tab given?',
    executeOnce: true,
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr("{{ $('What did you send?').first().json.send_batch_tab.trim() }}"), operator: { type: 'string', operation: 'notEmpty', singleValue: true }, rightValue: '' }],
        combinator: 'and'
      }
    }
  }
});

const readTab = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read send batch tab',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'sheet',
      operation: 'read',
      authentication: 'oAuth2',
      documentId: { __rl: true, mode: 'id', value: 'REPLACE_WITH_FLUX_PROSPECTS_SHEET_ID', cachedResultName: 'Flux Prospects' },
      sheetName: { __rl: true, mode: 'name', value: expr("{{ $('What did you send?').first().json.send_batch_tab.trim() }}") },
      options: {}
    },
    credentials: { googleSheetsOAuth2Api: newCredential('Google Sheets account') }
  },
  output: [{ email: 'jane@acme.com', first_name: 'Jane', row_number: 2 }]
});

const matchEmails = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Match emails to prospects',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Collect emails from the tab and/or the pasted list, then decide who to mark contacted.
// Never overwrite people who already replied, booked a meeting, became a client or are do_not_contact.
const s = $('What did you send?').first().json;
const clean = (v) => String(v == null ? '' : v).trim().toLowerCase().replace(/^mailto:/, '');
const EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
const emails = new Set();
for (const part of String(s.emails || '').split(/[\\s,;]+/)) {
  const e = clean(part);
  if (EMAIL_RE.test(e)) emails.add(e);
}
let fromTab = 0;
if (String(s.send_batch_tab || '').trim() && $('Read send batch tab').isExecuted) {
  for (const i of $('Read send batch tab').all()) {
    const e = clean(i.json.email);
    if (EMAIL_RE.test(e)) { emails.add(e); fromTab++; }
  }
}
const day = String(s.contacted_on || '').trim();
const when = day ? new Date(day) : new Date();
if (isNaN(when.getTime())) throw new Error('contacted_on must be a date like 2026-10-01, got: ' + day);
const whenIso = when.toISOString();

const byEmail = {};
for (const i of $('Load prospects').all()) {
  const e = clean(i.json.email);
  if (e) byEmail[e] = i.json;
}
const KEEP = ['replied', 'meeting', 'client', 'do_not_contact'];
const seq = String(s.sequence_name || '').trim();
const now = new Date().toISOString();
const updates = [];
const notInStore = [];
const leftAlone = [];
for (const e of emails) {
  const row = byEmail[e];
  if (!row) { notInStore.push(e); continue; }
  if (KEEP.includes(row.status)) { leftAlone.push(e + ' (' + row.status + ')'); continue; }
  updates.push({ id: row.id, email: e, last_contacted_at: whenIso, sequence_name: seq || row.sequence_name || '', updated_at: now });
}
return [{ json: {
  emails_given: emails.size,
  from_tab: fromTab,
  contacted_on: whenIso,
  marked_contacted: updates.length,
  not_in_store: notInStore,
  left_alone: leftAlone,
  updates,
} }];`
    }
  },
  output: [{ emails_given: 1, from_tab: 1, contacted_on: '2026-10-01T00:00:00.000Z', marked_contacted: 1, not_in_store: [], left_alone: [], updates: [{ id: 1, email: 'jane@acme.com', last_contacted_at: '2026-10-01T00:00:00.000Z', sequence_name: 'Oct recruiters v1', updated_at: '2026-10-01T09:00:00.000Z' }] }]
});

const anythingToMark = ifElse({
  version: 2.2,
  config: {
    name: 'Anyone to mark?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.updates.length }}'), operator: { type: 'number', operation: 'gt' }, rightValue: 0 }],
        combinator: 'and'
      }
    }
  }
});

const splitUpdates = node({
  type: 'n8n-nodes-base.splitOut',
  version: 1,
  config: {
    name: 'One item per person',
    parameters: { fieldToSplitOut: 'updates', include: 'noOtherFields' }
  },
  output: [{ id: 1, email: 'jane@acme.com', last_contacted_at: '2026-10-01T00:00:00.000Z', sequence_name: 'Oct recruiters v1', updated_at: '2026-10-01T09:00:00.000Z' }]
});

const markContacted = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Mark contacted',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: 't5vVklaYxGRMXJFZ', cachedResultName: 'flux_prospects' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          status: 'contacted',
          last_contacted_at: expr('{{ $json.last_contacted_at }}'),
          sequence_name: expr('{{ $json.sequence_name }}'),
          updated_at: expr('{{ $json.updated_at }}')
        },
        schema: [
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'last_contacted_at', displayName: 'last_contacted_at', required: false, defaultMatch: false, display: true, type: 'dateTime', canBeUsedToMatch: true },
          { id: 'sequence_name', displayName: 'sequence_name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'updated_at', displayName: 'updated_at', required: false, defaultMatch: false, display: true, type: 'dateTime', canBeUsedToMatch: true }
        ]
      },
      options: {}
    }
  },
  output: [{ id: 1, email: 'jane@acme.com', status: 'contacted' }]
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
          { id: 'ms-marked', name: 'marked_contacted', value: expr("{{ $('Match emails to prospects').first().json.marked_contacted }}"), type: 'number' },
          { id: 'ms-given', name: 'emails_given', value: expr("{{ $('Match emails to prospects').first().json.emails_given }}"), type: 'number' },
          { id: 'ms-tab', name: 'from_send_batch_tab', value: expr("{{ $('Match emails to prospects').first().json.from_tab }}"), type: 'number' },
          { id: 'ms-date', name: 'contacted_on', value: expr("{{ $('Match emails to prospects').first().json.contacted_on }}"), type: 'string' },
          { id: 'ms-notfound', name: 'not_in_store', value: expr("{{ $('Match emails to prospects').first().json.not_in_store }}"), type: 'array' },
          { id: 'ms-left', name: 'left_alone', value: expr("{{ $('Match emails to prospects').first().json.left_alone }}"), type: 'array' },
          { id: 'ms-msg', name: 'message', value: expr("{{ $('Match emails to prospects').first().json.emails_given === 0 ? 'Nothing to do: type a Send batch tab name or paste emails in \"What did you send?\"' : 'Done' }}"), type: 'string' }
        ]
      },
      options: {}
    }
  },
  output: [{ marked_contacted: 1, emails_given: 1, from_send_batch_tab: 1, contacted_on: '2026-10-01T00:00:00.000Z', not_in_store: [], left_alone: [], message: 'Done' }]
});

const howTo = sticky(
  '## Flux - mark contacted\nRun this after you send a batch. Double-click **What did you send?** and fill in either:\n- **send_batch_tab**: the tab name from Flux Prospects, e.g. `Send batch 2026-09-30 2046`, or\n- **emails**: paste emails (one per line or comma separated)\n\nOptional: **sequence_name** (which campaign) and **contacted_on** (defaults to today, format 2026-10-01).\n\nThen click **Execute workflow**. Sets status `contacted` + `last_contacted_at`. People who replied, booked a meeting, became a client or are do_not_contact are left alone.',
  [whatSent, loadProspects],
  { color: 4 }
);

export default workflow('flux-mark-contacted', 'Flux - mark contacted')
  .add(runMark)
  .to(whatSent)
  .to(loadProspects)
  .to(tabGiven
    .onTrue(readTab.to(matchEmails))
    .onFalse(matchEmails))
  .add(matchEmails)
  .to(anythingToMark
    .onTrue(splitUpdates.to(markContacted).to(summary))
    .onFalse(summary))
  .add(howTo)
  .group('Collect who was sent', [readTab], { description: 'Reads the Send batch tab you named (if any).' })
  .group('Mark them contacted', [anythingToMark, splitUpdates, markContacted, summary], { description: 'Sets status contacted, last_contacted_at and sequence_name, then shows the counts.' });
