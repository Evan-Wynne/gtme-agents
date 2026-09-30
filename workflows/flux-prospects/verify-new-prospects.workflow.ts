import { workflow, node, trigger, sticky, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const runVerify = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run verification' },
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
          { id: 'set-max', name: 'max_to_verify', value: 10, type: 'number' },
          { id: 'set-score', name: 'min_score', value: 80, type: 'number' }
        ]
      },
      options: {}
    }
  },
  output: [{ max_to_verify: 50, min_score: 80 }]
});

const checkCredits = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Check Hunter credits',
    executeOnce: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    parameters: {
      method: 'GET',
      url: 'https://api.hunter.io/v2/account',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpTemplatedCustomAuth',
      options: { timeout: 20000 }
    },
    credentials: { httpTemplatedCustomAuth: newCredential('Hunter API (evanwynne)') }
  },
  output: [{ data: { plan_name: 'Free', reset_date: '2026-10-05', requests: { verifications: { used: 16, available: 100 } } } }]
});

const getNew = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Get new prospects',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 't5vVklaYxGRMXJFZ', cachedResultName: 'flux_prospects' },
      matchType: 'allConditions',
      filters: {
        conditions: [
          { keyName: 'status', condition: 'eq', keyValue: 'new' },
          { keyName: 'verify_result', condition: 'isEmpty' }
        ]
      },
      returnAll: false,
      limit: expr("{{ Math.min(Number($('Settings').first().json.max_to_verify) || 50, 50) }}"),
      orderBy: true,
      orderByColumn: 'createdAt',
      orderByDirection: 'ASC'
    }
  },
  output: [{ id: 2, email: 'jane@acme.com', status: 'new', notes: '' }]
});

const pickRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Pick rows within Hunter credits',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Never ask Hunter for more checks than the account has left this month.
const settings = $('Settings').first().json;
const acct = ($('Check Hunter credits').first().json || {}).data || {};
const req = acct.requests || {};
const pool = req.verifications || req.credits || {};
const remaining = typeof pool.remaining === 'number'
  ? pool.remaining
  : Math.max(0, Number(pool.available || 0) - Number(pool.used || 0));
const rows = $('Get new prospects').all().map((i) => i.json).filter((r) => r && r.email && r.id);
const cap = Math.max(0, Math.min(Number(settings.max_to_verify) || 50, 50, remaining));
const pick = rows.slice(0, cap);
let stop_reason = '';
if (remaining <= 0) stop_reason = 'No Hunter verification credits left this month' + (acct.reset_date ? ' (resets ' + acct.reset_date + ')' : '');
else if (rows.length === 0) stop_reason = 'Nothing to verify: no prospects with status new';
return [{ json: {
  credits_remaining: remaining,
  credits_reset_date: acct.reset_date || '',
  waiting_rows_fetched: rows.length,
  to_verify: pick.length,
  stop_reason,
  rows: pick,
} }];`
    }
  },
  output: [{ credits_remaining: 84, credits_reset_date: '2026-10-05', waiting_rows_fetched: 1, to_verify: 1, stop_reason: '', rows: [{ id: 2, email: 'jane@acme.com', notes: '' }] }]
});

const anythingToVerify = ifElse({
  version: 2.2,
  config: {
    name: 'Anything to verify?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.rows.length }}'), operator: { type: 'number', operation: 'gt' }, rightValue: 0 }],
        combinator: 'and'
      }
    }
  }
});

const splitProspects = node({
  type: 'n8n-nodes-base.splitOut',
  version: 1,
  config: {
    name: 'One item per prospect',
    parameters: { fieldToSplitOut: 'rows', include: 'noOtherFields' }
  },
  output: [{ id: 2, email: 'jane@acme.com', notes: '' }]
});

const verifyEmail = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Hunter email verifier',
    parameters: {
      method: 'GET',
      url: 'https://api.hunter.io/v2/email-verifier',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpTemplatedCustomAuth',
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: { parameters: [{ name: 'email', value: expr('{{ $json.email }}') }] },
      options: {
        batching: { batch: { batchSize: 1, batchInterval: 250 } },
        response: { response: { fullResponse: true, neverError: true } },
        timeout: 30000
      }
    },
    credentials: { httpTemplatedCustomAuth: newCredential('Hunter API (evanwynne)') }
  },
  output: [{ statusCode: 200, headers: {}, body: { data: { email: 'jane@acme.com', status: 'valid', result: 'deliverable', score: 95 } } }]
});

const decide = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Decide new status',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// valid + score >= min_score -> verified; accept_all -> stays new (catch-all note); anything else Hunter answered -> invalid.
// No answer (202 still checking, 403 rate limit, 429 credits used up, other errors) -> row untouched, retried next run.
const minScore = Number($('Settings').first().json.min_score) || 80;
const rows = $('One item per prospect').all();
const now = new Date().toISOString();
const addNote = (existing, note) => {
  const e = String(existing || '').trim();
  return e.includes(note) ? e : [e, note].filter(Boolean).join('; ');
};
return $input.all().map((item, i) => {
  const idx = item.pairedItem && typeof item.pairedItem.item === 'number' ? item.pairedItem.item : i;
  const row = (rows[idx] || rows[i]).json;
  const res = item.json || {};
  const code = Number(res.statusCode || 0);
  const d = (res.body && res.body.data) || {};
  const base = { id: row.id, email: row.email, updated_at: now };
  if (code === 200 && d.status) {
    const n = Number(d.score);
    const score = Number.isFinite(n) ? n : null;
    if (d.status === 'accept_all') {
      return { json: { ...base, update: true, new_status: 'new', verify_result: 'accept_all', verify_score: score, notes: addNote(row.notes, 'catch-all, low priority') } };
    }
    if ((d.status === 'valid' || d.result === 'deliverable') && score !== null && score >= minScore) {
      return { json: { ...base, update: true, new_status: 'verified', verify_result: d.status, verify_score: score, notes: String(row.notes || '') } };
    }
    return { json: { ...base, update: true, new_status: 'invalid', verify_result: d.status || d.result || 'unknown', verify_score: score, notes: String(row.notes || '') } };
  }
  let reason = 'Hunter error ' + code;
  if (code === 202) reason = 'Hunter still checking - retried next run';
  if (code === 429 || code === 402) reason = 'Hunter credits used up';
  if (code === 403) reason = 'Hunter rate limit hit - retried next run';
  if (code === 401) reason = 'Hunter API key rejected';
  return { json: { ...base, update: false, new_status: 'new', skip_reason: reason } };
});`
    }
  },
  output: [{ id: 2, email: 'jane@acme.com', update: true, new_status: 'verified', verify_result: 'valid', verify_score: 95, notes: '', updated_at: '2026-09-30T18:00:00.000Z' }]
});

const onlyAnswered = node({
  type: 'n8n-nodes-base.filter',
  version: 2.2,
  config: {
    name: 'Only rows Hunter answered',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.update }}'), operator: { type: 'boolean', operation: 'true', singleValue: true }, rightValue: '' }],
        combinator: 'and'
      }
    }
  },
  output: [{ id: 2, email: 'jane@acme.com', update: true, new_status: 'verified', verify_result: 'valid', verify_score: 95, notes: '', updated_at: '2026-09-30T18:00:00.000Z' }]
});

const saveResult = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save verification result',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: 't5vVklaYxGRMXJFZ', cachedResultName: 'flux_prospects' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          status: expr('{{ $json.new_status }}'),
          verify_result: expr('{{ $json.verify_result }}'),
          verify_score: expr('{{ $json.verify_score }}'),
          notes: expr('{{ $json.notes }}'),
          updated_at: expr('{{ $json.updated_at }}')
        },
        schema: [
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'verify_result', displayName: 'verify_result', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'verify_score', displayName: 'verify_score', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'notes', displayName: 'notes', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'updated_at', displayName: 'updated_at', required: false, defaultMatch: false, display: true, type: 'dateTime', canBeUsedToMatch: true }
        ]
      },
      options: {}
    }
  },
  output: [{ id: 2, email: 'jane@acme.com', status: 'verified' }]
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
          { id: 'v-checked', name: 'checked', value: expr('{{ $input.all().filter(i => i.json.update).length }}'), type: 'number' },
          { id: 'v-verified', name: 'verified', value: expr("{{ $input.all().filter(i => i.json.new_status === 'verified').length }}"), type: 'number' },
          { id: 'v-invalid', name: 'invalid', value: expr("{{ $input.all().filter(i => i.json.new_status === 'invalid').length }}"), type: 'number' },
          { id: 'v-catchall', name: 'catch_all_kept_as_new', value: expr("{{ $input.all().filter(i => i.json.verify_result === 'accept_all').length }}"), type: 'number' },
          { id: 'v-notchecked', name: 'not_checked_retry_next_run', value: expr('{{ $input.all().filter(i => !i.json.update).length }}'), type: 'number' },
          { id: 'v-stopped', name: 'stopped_because_credits_ran_out', value: expr("{{ $input.all().some(i => i.json.skip_reason === 'Hunter credits used up') }}"), type: 'boolean' },
          { id: 'v-credits', name: 'credits_left_before_run', value: expr("{{ $('Pick rows within Hunter credits').first().json.credits_remaining }}"), type: 'number' },
          { id: 'v-reasons', name: 'not_checked_reasons', value: expr('{{ $input.all().filter(i => !i.json.update).map(i => i.json.email + ": " + i.json.skip_reason) }}'), type: 'array' }
        ]
      },
      options: {}
    }
  },
  output: [{ checked: 1, verified: 1, invalid: 0, catch_all_kept_as_new: 0, not_checked_retry_next_run: 0, stopped_because_credits_ran_out: false, credits_left_before_run: 84, not_checked_reasons: [] }]
});

const nothingToDo = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Nothing verified',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'n-msg', name: 'message', value: expr('{{ $json.stop_reason }}'), type: 'string' },
          { id: 'n-credits', name: 'credits_remaining', value: expr('{{ $json.credits_remaining }}'), type: 'number' },
          { id: 'n-reset', name: 'credits_reset_date', value: expr('{{ $json.credits_reset_date }}'), type: 'string' }
        ]
      },
      options: {}
    }
  },
  output: [{ message: 'Nothing to verify: no prospects with status new', credits_remaining: 84, credits_reset_date: '2026-10-05' }]
});

const howTo = sticky(
  '## Flux - verify new prospects\nClick **Execute workflow**. Takes up to 50 prospects with status `new` (oldest first) and checks each with Hunter Email Verifier, about 4 per second.\n\n- valid + score of 80 or more -> `verified`\n- catch-all -> stays `new`, note "catch-all, low priority", not re-checked\n- anything else Hunter answers -> `invalid`\n- no answer (still checking, rate limit, credits used up) -> left as is, tried next run\n\nIt first reads your Hunter balance and never asks for more checks than you have left. Change the limits in **Settings**.',
  [settings, checkCredits],
  { color: 4 }
);

export default workflow('flux-verify-new-prospects', 'Flux - verify new prospects')
  .add(runVerify)
  .to(settings)
  .to(checkCredits)
  .to(getNew)
  .to(pickRows)
  .to(anythingToVerify
    .onTrue(splitProspects.to(verifyEmail).to(decide))
    .onFalse(nothingToDo))
  .add(decide)
  .to(onlyAnswered)
  .to(saveResult)
  .add(decide)
  .to(summary)
  .add(howTo)
  .group('Check credits and pick rows', [settings, checkCredits, getNew, pickRows], { description: 'Reads the Hunter balance and takes at most that many (max 50) new prospects, oldest first.' })
  .group('Verify with Hunter', [splitProspects, verifyEmail, decide], { description: 'Checks each email with Hunter (about 4 per second) and decides verified / invalid / catch-all / retry later.' })
  .group('Save results', [onlyAnswered, saveResult], { description: 'Writes the new status, Hunter result and score back to flux_prospects. Rows Hunter did not answer stay untouched.' });
