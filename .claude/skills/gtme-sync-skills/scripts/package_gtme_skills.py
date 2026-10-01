#!/usr/bin/env python3
"""Zip gtme-* skill folders into <name>.skill files that Claude can install.

Usage: package_gtme_skills.py <skills_dir> <out_dir> [--all]

If Evan's account skills are visible (~/.claude/skills/synced/*/), only new or changed
skills are packaged; unchanged ones are reported as SAME. --all packages every skill.
"""
import re
import sys
import zipfile
from pathlib import Path

SKIP_DIRS = {"__pycache__", "node_modules", ".git", "evals"}
SKIP_FILES = {".DS_Store"}


def field(frontmatter, key):
    m = re.search(rf"^{key}:\s*(.+)$", frontmatter, re.M)
    return m.group(1).strip().strip("\"'") if m else ""


def check(skill_dir):
    """Return a problem string, or None if SKILL.md looks installable."""
    md = skill_dir / "SKILL.md"
    if not md.is_file():
        return "no SKILL.md"
    m = re.match(r"^---\n(.*?)\n---\n", md.read_text(encoding="utf-8"), re.S)
    if not m:
        return "SKILL.md has no frontmatter"
    desc = field(m.group(1), "description")
    if field(m.group(1), "name") != skill_dir.name:
        return "frontmatter name doesn't match the folder name"
    if not desc or len(desc) > 1024:
        return "description missing or longer than 1024 characters"
    if "<" in desc or ">" in desc:
        return "description has < or >, which claude.ai rejects as XML tags"
    return None


def files(skill_dir):
    """The skill's files, relative to its folder, minus caches."""
    out = {}
    for f in sorted(skill_dir.rglob("*")):
        rel = f.relative_to(skill_dir)
        if f.is_file() and f.name not in SKIP_FILES and not SKIP_DIRS & set(rel.parts):
            out[rel] = f
    return out


def account_copy(name):
    """Evan's installed copy of a skill, if this session can see it."""
    for d in (Path.home() / ".claude" / "skills" / "synced").glob(f"*/{name}"):
        if d.is_dir():
            return d
    return None


def unchanged(skill_dir, installed):
    mine, theirs = files(skill_dir), files(installed)
    return mine.keys() == theirs.keys() and all(
        mine[k].read_bytes() == theirs[k].read_bytes() for k in mine
    )


def main():
    args = [a for a in sys.argv[1:] if a != "--all"]
    package_all = "--all" in sys.argv
    skills_dir, out_dir = Path(args[0]), Path(args[1])
    out_dir.mkdir(parents=True, exist_ok=True)
    folders = sorted(p for p in skills_dir.glob("gtme-*") if p.is_dir())
    if not folders:
        sys.exit(f"No gtme-* skill folders in {skills_dir}")
    failed = False
    for skill in folders:
        problem = check(skill)
        if problem:
            print(f"SKIPPED {skill.name}: {problem}")
            failed = True
            continue
        installed = account_copy(skill.name)
        same = installed is not None and unchanged(skill, installed)
        if same and not package_all:
            print(f"SAME {skill.name}: already current in Evan's account")
            continue
        target = out_dir / f"{skill.name}.skill"
        with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
            for rel, f in files(skill).items():
                z.write(f, Path(skill.name) / rel)
        status = "SAME" if same else "CHANGED" if installed else "NEW"
        print(f"{status} {skill.name}: {target}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
