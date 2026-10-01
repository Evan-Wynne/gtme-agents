---
name: gtme-sync-skills
description: Package all of Evan's gtme- skills from the gtme-agents repo as .skill files and send them to him, so he can install them in his Claude account. Then every Claude chat has them, including Claude Code. Use when Evan asks to download, install, sync, update or copy his gtme skills to other chats, or right after a gtme- skill was added or changed.
---

# gtme-sync-skills

The job: take the latest `gtme-*` skills from GitHub, zip each one into a `.skill` file, and
send them to Evan so he can install them with one click.

## 1. Get the latest skills

- Use `main` from https://github.com/Evan-Wynne/gtme-agents, because that's what Evan has
  approved.
  - Inside the repo: run `git fetch origin main`, then
    `git archive origin/main .claude/skills | tar -x -C <scratchpad>/sync`.
  - Anywhere else: `git clone --depth 1` the repo into your scratchpad.
  - If neither works, tell Evan to run this skill from a gtme-agents chat, then stop.
- If this branch has skill changes that aren't on `main` yet, say so in one line and ask
  whether to package this branch instead.
- Note the short commit hash, so Evan can see which version he has.

## 2. Package

```bash
python3 <this skill>/scripts/package_gtme_skills.py <scratchpad>/sync/.claude/skills <scratchpad>/gtme-skills
```

This zips every `gtme-*` folder into `<name>.skill`, with the folder at the root of the zip,
and skips any skill whose frontmatter is broken. Fix a skipped skill in the repo, or tell
Evan which one was skipped. Never add lead lists, emails or keys: skills hold instructions
only.

## 3. Send them to Evan

- Send all the `.skill` files in one SendUserFile call (`display: attach`).
- Tell him, in a few lines:
  - Click **Save skill** on each file to add it to his Claude account.
  - If there's no button, go to claude.ai → Customize → Skills → **+** → Create skill →
    Upload a skill, pick the file, then make sure it's turned on
    ([docs](https://support.claude.com/en/articles/12512180-using-skills-in-claude)).
  - If an older copy is already installed, delete it first. Whether an upload with the
    same name overwrites the old one is unverified.
  - Skills need code execution turned on in his Claude settings.
- Once saved, the skills load in every claude.ai chat, and in Claude Code on the web or
  his computer when he signs in with his claude.ai account. Claude Code picks up changes
  within about 10 minutes
  ([docs](https://code.claude.com/docs/en/skills)).
- Don't copy them into `~/.claude/skills/`. A personal copy there beats the repo's own
  newer copy inside gtme-agents, and the account copy already covers local Claude Code.

## 4. Report

One short list: each skill sent, the commit hash, and "Re-run gtme-sync-skills after any
skill change."
