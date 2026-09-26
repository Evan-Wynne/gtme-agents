---
name: gtme-handoff
description: Hand a Claude Code session over to a fresh one, usually a cloud session to a new local `claude` session on Evan's computer. Writes a short brief to `.claude/handoff.md` covering the goal, what's done, where things live, decisions and next steps. Commits and pushes the brief, then gives Evan the exact commands to start a local session that already has that context. Use whenever Evan wants to continue locally, on his laptop or in the terminal, or wants a new session "with this context". Also use when he says "hand off", "save where we are" or "pick this up later", or when he pauses work he'll come back to, even if he doesn't mention a new session. Also works local → cloud.
---

# gtme-handoff

A fresh session that starts from a short brief is quicker and less confused than one that
carries a long chat history, and the brief stays in git as a record. If Evan wants the whole
conversation instead, `claude --teleport <session-id>` pulls the full cloud session into his
terminal
([docs](https://code.claude.com/docs/en/claude-code-on-the-web#from-cloud-to-terminal)).
Offer that option in one line and use the brief by default.

## Step 1 — Save the work first

The local checkout sees only what's on GitHub.
- Run `git status`. Commit and push any work in progress on the session branch. Leave
  something uncommitted only if Evan says so, and note it in the brief.
- Note the branch and the last commit (`git rev-parse --short HEAD`).

## Step 2 — Gather the context

Pull context from:
- the conversation, including any compaction summary
- `git log` on the branch
- the repo

Check live state with a connector only when the brief would otherwise have to guess, for
example whether a workflow is published. Never run anything paid, and never send anything,
just to gather context.

Sort what you find:
- **Durable rules and preferences** (how Evan wants something done every time) belong in
  `CLAUDE.md` or the relevant `gtme-` skill, not in the brief. If one from this chat isn't
  there yet, propose the one-line edit to Evan.
- **Session state** goes in the brief: what's done, what's paused, IDs, next steps, gotchas.

## Step 3 — Write `.claude/handoff.md`

Use `references/handoff-template.md`. Overwrite the previous brief; git keeps the history.
Keep it under ~80 lines, because the reader is a fresh session that needs the current state,
not the story of how you got there.
- Mark each fact as verified (checked in this session) or **unverified**.
- Name things so the reader can find them: workflow names and IDs, form IDs, repo paths,
  sheet tab names.
- The brief is committed, so the repo's data rules apply. Leave out:
  - emails
  - names or profile URLs of leads and contacts
  - webhook URLs
  - sheet IDs
  - API keys and tokens

  Say where each one lives instead, e.g. "Clay webhook URL: in the n8n node 'Send to Clay'".
- List the connectors the next steps need, so the new session can check it has them before
  it starts.

## Step 4 — Check, commit, push

- Run `bash .claude/skills/gtme-handoff/scripts/scrub_check.sh .claude/handoff.md`. Fix every
  hit, or confirm with Evan that it's a false positive.
- Commit as `Handoff: <topic>` and push to the session branch.

## Step 5 — Give Evan the start commands

Give one code block with the values filled in and one command per line. That layout works in
macOS/Linux shells and in PowerShell:

```
cd <his gtme-agents folder>
git fetch origin
git checkout <branch>
git pull
claude -n "<topic>" "Read .claude/handoff.md and pick up from there."
```

Then add one line for each of these:
- **First time on this computer:** `git clone https://github.com/Evan-Wynne/gtme-agents.git`,
  then `cd gtme-agents`.
- **Local changes:** if `git checkout` refuses because of local changes, commit or stash them
  first.
- **Connectors:** they come from his claude.ai account when `claude` is logged in with it
  (`/login`). `/mcp` shows which are connected
  ([docs](https://code.claude.com/docs/en/mcp)).
- **Full chat instead:** `claude --teleport <session-id>`. In a cloud session, get the ID from
  `get_session` (claude-code-remote MCP).

The new session reads `CLAUDE.md`, the `gtme-` skills and `.claude/settings.json` from the
checkout, so the guardrails and the approve prompt come with it.

## Other direction (local → cloud)

Write and push the brief the same way, then run
`claude --cloud "Read .claude/handoff.md and pick up from there."`
The cloud session clones the current branch from GitHub, so push first
([docs](https://code.claude.com/docs/en/claude-code-on-the-web#from-terminal-to-cloud)).
