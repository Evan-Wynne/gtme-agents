#!/usr/bin/env bash
# Flags personal data and secrets in a handoff brief before it is committed.
# Usage: scrub_check.sh <file>   Exit 0 = clean, 1 = hits to fix, 2 = usage error.
set -u
file="${1:-}"
if [ -z "$file" ] || [ ! -f "$file" ]; then
  echo "usage: $0 <file>" >&2
  exit 2
fi

hits=0
check() {
  local label="$1" pattern="$2" out
  out=$(grep -nEi -- "$pattern" "$file" || true)
  if [ -n "$out" ]; then
    echo "== $label"
    echo "$out"
    hits=1
  fi
}

check "email address"          '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
check "LinkedIn profile URL"   'linkedin\.com/in/'
check "webhook URL"            'hooks\.|/webhook/|webhook-[0-9a-f]{8}'
check "Google Sheet URL"       'docs\.google\.com/spreadsheets/d/'
check "long ID (sheet ID?)"    '[A-Za-z0-9_-]{40,}'
check "secret-looking value"   '(api[_-]?key|token|secret|password|bearer)[[:space:]]*[:=]'
check "known key prefix"       'apify_api_|sk-[A-Za-z0-9]{10,}|xox[bp]-|ghp_[A-Za-z0-9]{10,}'
check "phone number"           '\+[0-9][0-9 ()-]{8,}[0-9]'

if [ "$hits" -eq 0 ]; then
  echo "clean: $file"
fi
exit "$hits"
