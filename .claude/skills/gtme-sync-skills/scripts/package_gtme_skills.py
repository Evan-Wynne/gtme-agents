#!/usr/bin/env python3
"""Zip every gtme-* skill folder into <name>.skill files that Claude can install.

Usage: package_gtme_skills.py <skills_dir> <out_dir>
"""
import re
import sys
import zipfile
from pathlib import Path

SKIP_DIRS = {"__pycache__", "node_modules", ".git", "evals"}
SKIP_FILES = {".DS_Store"}


def check(skill_dir):
    """Return a problem string, or None if SKILL.md looks installable."""
    md = skill_dir / "SKILL.md"
    if not md.is_file():
        return "no SKILL.md"
    text = md.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        return "SKILL.md has no frontmatter"
    name = re.search(r"^name:\s*(.+)$", m.group(1), re.M)
    desc = re.search(r"^description:\s*(.+)$", m.group(1), re.M)
    if not name or name.group(1).strip() != skill_dir.name:
        return "frontmatter name doesn't match the folder name"
    if not desc or len(desc.group(1).strip()) > 1024:
        return "description missing or longer than 1024 characters"
    return None


def main():
    skills_dir, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
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
        target = out_dir / f"{skill.name}.skill"
        with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
            for f in sorted(skill.rglob("*")):
                rel = f.relative_to(skill)
                if f.is_file() and f.name not in SKIP_FILES and not SKIP_DIRS & set(rel.parts):
                    z.write(f, f.relative_to(skills_dir))
        print(f"OK {target}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
