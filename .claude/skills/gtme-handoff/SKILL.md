---
name: gtme-handoff
description: Wrap up the current chat safely and give Evan a single markdown file with its context, which he drops into a new local Claude chat. Use when Evan wants to continue in a new or local chat, is pausing or dropping work, or says "hand off", "save the context", "make context for this chat" or "pick this up later".
---

# gtme-handoff

There are two jobs: stop cleanly, then give Evan one `.md` file he can drop into a new chat.

## 1. Stop safely

- Don't start anything new. If the current step is quick, finish it. Otherwise stop it and
  note where it stopped.
- Commit and push finished work, so nothing is left half-changed.
- Archive anything temporary you made, such as `TEMP:` n8n workflows. Leave live and
  published things as they are.

## 2. Write the context file

Save it as `context-<topic>.md` in your scratchpad directory. Don't commit it. Keep it to one
screen and use this layout:

```markdown
# Context: <topic>
<date> · from <cloud/local> chat

> New chat: read this, tell Evan where we are in 3 lines, then wait for his go.

## Goal
## Where we are
- Done:
- Paused / not done:
## Where things live
## Next steps
## Watch out for
```

- Include only facts, and mark anything you didn't check as **unverified**.
- Leave out API keys, webhook URLs and lead contact details, because the file may get
  copied around.
- Don't repeat rules that are already in `CLAUDE.md` or a skill. A chat opened in the
  `gtme-agents` folder loads those itself.

## 3. Give it to Evan

Send the file with `SendUserFile` (`display: attach`). If that tool isn't available, give
him the file path. Then tell him in one line: open a new local chat in `gtme-agents` and
attach or paste the file.
