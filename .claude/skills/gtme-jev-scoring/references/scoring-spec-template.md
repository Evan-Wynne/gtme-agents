# <Client> — scoring spec

Status: draft | tested | live · Model: `jev-1.13.0` · Last tested: YYYY-MM-DD
Workflow: n8n `<name>` (`<id>`) · Config: ICP sheet `<name>` (tabs: settings, ...)

## What a qualified lead is
One paragraph in plain words, agreed with Evan (and the client, where it changes their ICP).

## Criteria
| Criterion | Bucket (rule / gate / signal / later step) | Source field or question | Threshold or points |
|---|---|---|---|

## Jev questions
State sent per item (field names only):

```json
{ "job": { "title": "", "company": "", "description": "" } }
```

Questions, exactly as sent:

```json
{}
```

## Policy in code
- Gates: ...
- Points: ... (normalised Scores × weights, plus rule points)
- Tiers: ...
- Review band (status `hold`): ...
- Config rows that drive this: `setting_name` = value, ...

## Test results
| Date | Model | Cases | Question | Agreement | Borderline | Choice flips | Cost |
|---|---|---|---|---|---|---|---|

Notes on misses (patterns only, no lead names):

## Changelog
- YYYY-MM-DD — what changed, why, before → after (aggregate numbers).
