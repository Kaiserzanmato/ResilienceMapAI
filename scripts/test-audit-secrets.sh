#!/usr/bin/env bash
# Fixture tests for audit-secrets.sh. Every candidate is synthetic and lives
# only inside a disposable temporary Git repository.
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
SCANNER="$SCRIPT_DIR/audit-secrets.sh"
TMP_ROOT=$(mktemp -d)
trap 'rm -rf "$TMP_ROOT"' EXIT

run_case() {
  local name expected path content repo exit_code
  name=$1
  expected=$2
  path=$3
  content=$4
  repo="$TMP_ROOT/$name"
  mkdir -p "$repo/$(dirname "$path")"
  git -C "$repo" init -q
  git -C "$repo" config user.email audit@example.invalid
  git -C "$repo" config user.name audit-fixture
  printf '%s\n' "$content" > "$repo/$path"
  git -C "$repo" add .
  git -C "$repo" commit -qm fixture
  if (cd "$repo" && bash "$SCANNER" >/dev/null 2>&1); then exit_code=0; else exit_code=$?; fi
  if [[ "$exit_code" != "$expected" ]]; then
    printf 'Fixture %s expected exit %s, received %s\n' "$name" "$expected" "$exit_code" >&2
    exit 1
  fi
}

run_case openai 1 source.txt 'OPENAI_API_KEY=sk-liveSyntheticOnly1234567890'
run_case qwen 1 source.txt 'QWEN_API_KEY=sk-qwenSyntheticOnly1234567890'
run_case deepseek 1 source.txt 'DEEPSEEK_API_KEY=sk-deepseekSyntheticOnly123456'
run_case bearer 1 source.txt 'Authorization: Bearer synthetic-token-value-1234567890'
run_case database 1 source.txt 'DATABASE_URL=postgresql://user:synthetic-password@db.example.invalid/app'
run_case jwt 1 source.txt 'JWT=eyJsyntheticHeader.eyJsyntheticPayload.syntheticSignature'
run_case private_key 1 source.txt '-----BEGIN SYNTHETIC PRIVATE KEY-----'
run_case placeholder 0 README.md 'OPENAI_API_KEY=YOUR_API_KEY'
run_case example_env 0 backend/.env.example 'DEEPSEEK_API_KEY=replace-me'
run_case documentation 0 docs/template.md 'Use sk-placeholder in documentation only.'
run_case tracked_env 1 .env 'OPENAI_API_KEY=sk-liveSyntheticOnly1234567890'

history_repo="$TMP_ROOT/history_secret"
mkdir -p "$history_repo/backend/app"
git -C "$history_repo" init -q
git -C "$history_repo" config user.email audit@example.invalid
git -C "$history_repo" config user.name audit-fixture
printf '%s\n' 'OPENAI_API_KEY=sk-liveSyntheticOnly1234567890' > "$history_repo/backend/app/removed.py"
git -C "$history_repo" add .
git -C "$history_repo" commit -qm secret-history
printf '%s\n' '# credential removed' > "$history_repo/backend/app/removed.py"
git -C "$history_repo" add .
git -C "$history_repo" commit -qm remove-secret
if (cd "$history_repo" && bash "$SCANNER" >/dev/null 2>&1); then
  printf 'Fixture history_secret expected scanner failure\n' >&2
  exit 1
fi

echo 'Secret-audit fixture tests passed.'
