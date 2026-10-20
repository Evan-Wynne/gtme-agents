# Jev API cheat sheet

Checked against the live docs on 2026-10-20. Re-check
[Models](https://docs.typesafe.ai/models.md) before pinning a version: aliases move.

## Request

`POST https://api.typesafe.ai/v1/systemone`, header `Authorization: Bearer $TYPESAFE_API_KEY`.

```json
{
  "model": "jev-1.13.0",
  "state": { "job": { "title": "...", "description": "..." } },
  "questions": {
    "offshorable": { "type": "noul", "instructions": "...", "criteria": { "true": "...", "false": "..." } },
    "company_fit": { "type": "choice", "instructions": "...", "criteria": { "other": "...", "fit": "..." } },
    "hiring":      { "type": "score", "instructions": "...", "criteria": ["lowest level", "...", "highest level"] }
  }
}
```

- `state`: a string, a JSON object or an array. Refer to parts of it in questions with
  backticked paths such as `` `job.description` ``.
- `instructions` and `criteria` values can be strings, objects or arrays (use objects for
  "covers / not_for / examples" when two options get confused).
- Choice: up to 255 options. Score: 2 to 10 levels. No limit on the number of questions, only
  on context.

## Response

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "offshorable": { "type": "noul", "noul": 0.94 },
    "company_fit": { "type": "choice", "choice": "fit", "confidence": 1.0,
                     "probabilities": { "other": 0.0, "fit": 1.0 } },
    "hiring": { "type": "score", "score": 1.94, "confidence": 0.91,
                "probabilities": { "0": 0.0, "1": 0.06, "2": 0.94 },
                "legend": { "0": "...", "1": "...", "2": "..." } }
  },
  "usage": { "input_tokens": 1120, "output_tokens": 12 }
}
```

- Noul: one probability of yes. No separate confidence. 0.5 means unsure, not "medium".
- Choice `confidence`: 0 for an even split, 1 for certainty. Only the top probability counts.
- Score `score`: probability-weighted level, from 0 to `len(criteria) - 1`. Normalise before
  weighting. Don't interpolate exact quantities from it.
- Log `model` on every row: it is the versioned ID that actually answered.

## Models, price, limits

| | Value |
|---|---|
| `jev-latest` | → `jev-1.13.0` (stable) |
| `jev-preview` | → `jev-1.14.0` (released 2026-10-14) |
| Price | $0.042 per million input tokens; output is free |
| Context | 64k tokens per request, 32k per question (state + one question) |
| Long context | header `TypeSafe-Danger-Zone-Long-Context: true` → 262k; slower and less accurate |
| Body | ≤ 32 MiB, UTF-8 JSON, finite numbers only (send IDs and big numbers as strings) |
| Errors | 400 rule broken or `max_tokens_exceeded`, 401 key, 422 malformed question, 429 rate limit, 529 overloaded |

Retry 429 and 529 with exponential backoff. Rate limits are per organisation (see
console.typesafe.ai/rate-limits).

Known weak spots in `jev-1.13` ([jaggedness page](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md)):
literal reading, maths and counting, date comparison, multi-hop questions, large irrelevant
state, prompt injection in state, contradictory instructions vs criteria, first-option lean
in Choice, and generating text.

## n8n HTTP Request node (proven in Staffviser Workflow 2)

A Code node puts the whole request in `$json.jev_body`; this node sends it, five per second.

```json
{
  "name": "Jev – judge job",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "retryOnFail": true, "maxTries": 3, "waitBetweenTries": 3000,
  "parameters": {
    "method": "POST",
    "url": "https://api.typesafe.ai/v1/systemone",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpBearerAuth",
    "sendBody": true, "contentType": "json", "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify($json.jev_body) }}",
    "options": { "timeout": 60000, "batching": { "batch": { "batchSize": 5, "batchInterval": 1000 } } }
  },
  "credentials": { "httpBearerAuth": { "id": "bnEEetjP9UovTbzS", "name": "TypeSafe Jev" } }
}
```

There is also an official TypeSafe n8n node and n8n gateway credentials for it; the plain HTTP
Request node is what has been tested here.

## Parse and gate (Code node, run once for each item)

Pair each answer with its source row through `$('<build node>').item`, fail loudly when
answers are missing, and keep the raw probabilities on the row.

```javascript
const row = $('Build Jev requests').item.json.row;
const a = $json.answers;
if (!a || !a.offshorable || !a.company_fit) {
  throw new Error('Jev returned no answers for ' + row.id + ': ' + JSON.stringify($json).slice(0, 300));
}
const offMin = 0.8;   // read these from the config sheet in production
const fitMin = 0.7;
const reasons = [];
if (a.offshorable.noul < offMin) reasons.push('not offshorable (p=' + a.offshorable.noul.toFixed(2) + ')');
if (a.company_fit.choice !== 'fit') reasons.push('company: ' + a.company_fit.choice);
else if ((a.company_fit.probabilities.fit ?? 0) < fitMin) reasons.push('fit too uncertain');
const r2 = x => Math.round(x * 100) / 100;
return { json: {
  ...row,
  gate: reasons.length ? 'reject' : 'pass',
  reason: reasons.join('; '),
  offshorable_p: r2(a.offshorable.noul),
  fit_p: r2(a.company_fit.probabilities.fit ?? 0),
  jev_model: $json.model,
  jev_checked_at: new Date().toISOString(),
} };
```

## Docs worth reading for new designs

- [Composite scoring](https://docs.typesafe.ai/patterns/composite-scoring.md): weights in code.
- [Confidence-gated routing](https://docs.typesafe.ai/patterns/confidence-routing.md): act / confirm / human.
- [Speculative fan-out](https://docs.typesafe.ai/patterns/fan-out.md): many questions per call.
- [Re-ranking](https://docs.typesafe.ai/cookbooks/rerank_typesafe.md): one Noul per candidate, sort by probability.
- [Feature discovery](https://docs.typesafe.ai/cookbooks/autoresearch_feature_discovery.md): Jev answers as features once outcomes exist.
