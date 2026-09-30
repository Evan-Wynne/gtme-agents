import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const webhookIn = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Receive list (webhook)',
    parameters: {
      httpMethod: 'POST',
      path: 'flux-add-prospects',
      authentication: 'none',
      responseMode: 'lastNode',
      responseData: 'firstEntryJson',
      options: {}
    }
  },
  output: [{ headers: {}, params: {}, query: {}, body: { prospects: [{ email: 'jane@acme.com', first_name: 'Jane' }] } }]
});

const manualIn = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run manually' },
  output: [{}]
});

const pasteList = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Paste your list here',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'paste-data', name: 'data', value: 'email,first_name,last_name,company,domain,title,linkedin_url,source,list_name\n', type: 'string' },
          { id: 'paste-source', name: 'source', value: 'manual', type: 'string' },
          { id: 'paste-list', name: 'list_name', value: '', type: 'string' }
        ]
      },
      options: {}
    }
  },
  output: [{ data: 'email,first_name\njane@acme.com,Jane\n', source: 'manual', list_name: '' }]
});

const parseInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse input',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Accepts a JSON array, {prospects:[...]}, {csv:"..."} or pasted CSV/JSON text.
const first = $input.first().json;
const isWebhook = first && typeof first === 'object' && 'body' in first && 'headers' in first;
const body = isWebhook ? first.body : first;
const query = isWebhook ? (first.query || {}) : {};

const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
const ALIASES = {
  email: ['email', 'email address', 'e-mail', 'work email', 'business email', 'mail'],
  first_name: ['first_name', 'first name', 'firstname', 'first', 'given name'],
  last_name: ['last_name', 'last name', 'lastname', 'last', 'surname', 'family name'],
  company: ['company', 'company name', 'organization', 'organisation', 'account', 'account name'],
  domain: ['domain', 'website', 'company domain', 'company website', 'url', 'company url'],
  title: ['title', 'job title', 'position', 'role', 'headline'],
  linkedin_url: ['linkedin_url', 'linkedin', 'linkedin url', 'person linkedin url', 'linkedin profile', 'profile url'],
  source: ['source'],
  list_name: ['list_name', 'list name', 'list'],
  notes: ['notes', 'note'],
};
const lookup = {};
for (const field of Object.keys(ALIASES)) {
  lookup[norm(field)] = field;
  for (const a of ALIASES[field]) lookup[norm(a)] = field;
}

function mapRow(obj) {
  const out = {};
  for (const k of Object.keys(obj || {})) {
    const f = lookup[norm(k)];
    if (f && (out[f] === undefined || out[f] === '')) out[f] = obj[k] == null ? '' : String(obj[k]).trim();
  }
  return out;
}

function parseCsv(input) {
  const text = String(input).replace(/^\\uFEFF/, '');
  const firstLine = text.split(/\\r?\\n/)[0] || '';
  const count = (ch) => firstLine.split(ch).length - 1;
  const delim = count('\\t') > 0 ? '\\t' : (count(';') > count(',') ? ';' : ',');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else { field += c; }
    } else if (c === '"') { inQuotes = true; }
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\\n' || c === '\\r') {
      if (c === '\\r' && text[i + 1] === '\\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else { field += c; }
  }
  row.push(field);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  if (rows.length < 2) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, idx) => { o[h] = r[idx]; });
    return o;
  });
}

function fromText(input) {
  const t = String(input || '').trim();
  if (!t) return [];
  if (t[0] === '[' || t[0] === '{') return toList(JSON.parse(t));
  return parseCsv(t);
}

function toList(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    for (const key of ['prospects', 'rows', 'items', 'leads', 'contacts']) {
      if (Array.isArray(v[key])) return v[key];
    }
    for (const key of ['csv', 'data', 'text']) {
      if (typeof v[key] === 'string') return fromText(v[key]);
    }
    if (v.email) return [v];
  }
  if (typeof v === 'string') return fromText(v);
  return [];
}

const rows = toList(body).map((r) => (r && typeof r === 'object' ? mapRow(r) : {}));
const bodyObj = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
const defaults = {
  source: String(bodyObj.source || query.source || '').trim(),
  list_name: String(bodyObj.list_name || query.list_name || '').trim(),
};
return [{ json: { rows, defaults } }];`
    }
  },
  output: [{ rows: [{ email: 'jane@acme.com', first_name: 'Jane' }], defaults: { source: 'manual', list_name: '' } }]
});

const loadProspects = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Load existing prospects',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 't5vVklaYxGRMXJFZ', cachedResultName: 'flux_prospects' },
      returnAll: true
    }
  },
  output: [{ id: 1, email: 'old@acme.com', status: 'new' }]
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

const classify = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Check duplicates & suppression',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const ALLOWED_SOURCES = ['apify', 'hunter', 'apollo', 'clay', 'website', 'manual'];
const EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
const parsed = $('Parse input').first().json;
const clean = (v) => String(v == null ? '' : v).trim();
const cleanEmail = (v) => clean(v).toLowerCase().replace(/^mailto:/, '');
const cleanDomain = (v) => {
  let d = clean(v).toLowerCase();
  if (d.includes('@')) d = d.split('@').pop();
  d = d.replace(/^[a-z]+:\\/\\//, '').replace(/^www\\./, '');
  return d.split(/[\\/?#:]/)[0];
};
const cleanLinkedin = (v) => clean(v).split('?')[0].replace(/\\/+$/, '');

const existing = new Set();
for (const i of $('Load existing prospects').all()) {
  const e = cleanEmail(i.json.email);
  if (e) existing.add(e);
}
const supEmails = new Set();
const supDomains = new Set();
for (const i of $('Load suppression list').all()) {
  const e = cleanEmail(i.json.email);
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

const now = new Date().toISOString();
const seen = new Set();
const toAdd = [];
const skipped = [];
let dup = 0;
let sup = 0;
let invalid = 0;
for (const r of parsed.rows || []) {
  const email = cleanEmail(r.email);
  if (!EMAIL_RE.test(email)) { invalid++; skipped.push({ email: clean(r.email), reason: 'invalid or missing email' }); continue; }
  const emailDomain = email.split('@')[1];
  const domain = cleanDomain(r.domain) || emailDomain;
  if (supEmails.has(email) || domainSuppressed(emailDomain) || domainSuppressed(domain)) { sup++; skipped.push({ email, reason: 'suppressed' }); continue; }
  if (existing.has(email) || seen.has(email)) { dup++; skipped.push({ email, reason: 'duplicate' }); continue; }
  seen.add(email);
  let source = clean(r.source || (parsed.defaults || {}).source || 'manual').toLowerCase();
  let notes = clean(r.notes);
  if (!ALLOWED_SOURCES.includes(source)) {
    notes = [notes, 'source: ' + source].filter(Boolean).join('; ');
    source = 'manual';
  }
  toAdd.push({
    email,
    first_name: clean(r.first_name),
    last_name: clean(r.last_name),
    company: clean(r.company),
    domain,
    title: clean(r.title),
    linkedin_url: cleanLinkedin(r.linkedin_url),
    source,
    list_name: clean(r.list_name) || (parsed.defaults || {}).list_name || '',
    status: 'new',
    notes,
    created_at: now,
    updated_at: now,
  });
}
return [{ json: {
  received: (parsed.rows || []).length,
  added: toAdd.length,
  skipped_duplicate: dup,
  skipped_suppressed: sup,
  skipped_invalid: invalid,
  skipped: skipped.slice(0, 100),
  to_add: toAdd,
} }];`
    }
  },
  output: [{ received: 1, added: 1, skipped_duplicate: 0, skipped_suppressed: 0, skipped_invalid: 0, skipped: [], to_add: [{ email: 'jane@acme.com', first_name: 'Jane', status: 'new' }] }]
});

const anythingToAdd = ifElse({
  version: 2.2,
  config: {
    name: 'Anything to add?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.to_add.length }}'), operator: { type: 'number', operation: 'gt' }, rightValue: 0 }],
        combinator: 'and'
      }
    }
  }
});

const splitRows = node({
  type: 'n8n-nodes-base.splitOut',
  version: 1,
  config: {
    name: 'One item per new prospect',
    parameters: { fieldToSplitOut: 'to_add', include: 'noOtherFields' }
  },
  output: [{ email: 'jane@acme.com', first_name: 'Jane', status: 'new' }]
});

const saveProspects = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save new prospects',
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'id', value: 't5vVklaYxGRMXJFZ', cachedResultName: 'flux_prospects' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          email: expr('{{ $json.email }}'),
          first_name: expr('{{ $json.first_name }}'),
          last_name: expr('{{ $json.last_name }}'),
          company: expr('{{ $json.company }}'),
          domain: expr('{{ $json.domain }}'),
          title: expr('{{ $json.title }}'),
          linkedin_url: expr('{{ $json.linkedin_url }}'),
          source: expr('{{ $json.source }}'),
          list_name: expr('{{ $json.list_name }}'),
          status: expr('{{ $json.status }}'),
          notes: expr('{{ $json.notes }}'),
          created_at: expr('{{ $json.created_at }}'),
          updated_at: expr('{{ $json.updated_at }}')
        },
        schema: [
          { id: 'email', displayName: 'email', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'first_name', displayName: 'first_name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'last_name', displayName: 'last_name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'company', displayName: 'company', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'domain', displayName: 'domain', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'title', displayName: 'title', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'linkedin_url', displayName: 'linkedin_url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'source', displayName: 'source', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'list_name', displayName: 'list_name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'notes', displayName: 'notes', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'created_at', displayName: 'created_at', required: false, defaultMatch: false, display: true, type: 'dateTime', canBeUsedToMatch: true },
          { id: 'updated_at', displayName: 'updated_at', required: false, defaultMatch: false, display: true, type: 'dateTime', canBeUsedToMatch: true }
        ]
      },
      options: {}
    }
  },
  output: [{ id: 2, email: 'jane@acme.com', status: 'new' }]
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
          { id: 'sum-received', name: 'received', value: expr("{{ $('Check duplicates & suppression').first().json.received }}"), type: 'number' },
          { id: 'sum-added', name: 'added', value: expr("{{ $('Check duplicates & suppression').first().json.added }}"), type: 'number' },
          { id: 'sum-dup', name: 'skipped_duplicate', value: expr("{{ $('Check duplicates & suppression').first().json.skipped_duplicate }}"), type: 'number' },
          { id: 'sum-sup', name: 'skipped_suppressed', value: expr("{{ $('Check duplicates & suppression').first().json.skipped_suppressed }}"), type: 'number' },
          { id: 'sum-invalid', name: 'skipped_invalid', value: expr("{{ $('Check duplicates & suppression').first().json.skipped_invalid }}"), type: 'number' },
          { id: 'sum-skipped', name: 'skipped', value: expr("{{ $('Check duplicates & suppression').first().json.skipped }}"), type: 'array' }
        ]
      },
      options: {}
    }
  },
  output: [{ received: 1, added: 1, skipped_duplicate: 0, skipped_suppressed: 0, skipped_invalid: 0, skipped: [] }]
});

const howTo = sticky(
  '## Flux - add prospects\nAdds people to **flux_prospects** with status `new`.\nSkips anyone already there, and anyone whose email or domain is in **flux_suppression**.\n\n**By hand:** paste CSV (with a header row) or JSON into **Paste your list here**, then click **Execute workflow**. The last node shows the summary.\n\n**By webhook (after publishing):** POST JSON to the webhook URL, e.g. `{"source":"apollo","list_name":"Oct SaaS","prospects":[{"email":"...","first_name":"..."}]}` or `{"csv":"email,first_name\\n..."}`.',
  [pasteList, parseInput],
  { color: 4 }
);

export default workflow('flux-add-prospects', 'Flux - add prospects')
  .add(webhookIn)
  .to(parseInput)
  .to(loadProspects)
  .to(loadSuppression)
  .to(classify)
  .to(anythingToAdd
    .onTrue(splitRows.to(saveProspects).to(summary))
    .onFalse(summary))
  .add(manualIn)
  .to(pasteList)
  .to(parseInput)
  .add(howTo)
  .group('Read the incoming list', [parseInput], { description: 'Turns pasted text or a webhook body (CSV or JSON) into clean rows with standard column names.' })
  .group('Check against existing data', [loadProspects, loadSuppression, classify], { description: 'Loads current prospects and the suppression list, then splits the new rows into add / duplicate / suppressed / invalid.' })
  .group('Save and report', [anythingToAdd, splitRows, saveProspects, summary], { description: 'Inserts only the new prospects with status new, then returns the counts.' });
