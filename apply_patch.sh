#!/usr/bin/env bash
# Run from the ROOT of your hakunashortcut (public) checkout:  bash /path/to/apply_patch.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(git rev-parse --show-toplevel)"
# Clean file names: "log-001.md Hustles To Systems." -> "log-001.md"; ". md" -> ".md"
for f in log-0*.md\ *; do [ -e "$f" ] && git mv -- "$f" "${f:0:10}"; done
if [ -e "Why PayPal Forced Me to Think Differently About Online Income. md" ]; then
  git mv -- "Why PayPal Forced Me to Think Differently About Online Income. md" "Why PayPal Forced Me to Think Differently About Online Income.md"
fi
cp "$HERE/files/LOG_ROADMAP.md" LOG_ROADMAP.md
cp "$HERE/files/README.md" README.md
cp "$HERE"/files/log-01[2-7].md .
mkdir -p images && cp "$HERE"/files/images/* images/
git add -A
echo; git status --short
echo; echo "Suggested message: Archive LOGs 012-017; clean log file names; sync roadmap to v3.5 and README log table"
