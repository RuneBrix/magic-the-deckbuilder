#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Arcana needs Node.js 22 or later on PATH. Install Node, then try again."
  printf "Press Return to close. "
  read -r answer
  exit 1
fi
node scripts/start.mjs "$@"
result=$?
if [ "$result" -ne 0 ]; then
  printf "Arcana could not start. Read the error above. Press Return to close. "
  read -r answer
fi
exit "$result"
