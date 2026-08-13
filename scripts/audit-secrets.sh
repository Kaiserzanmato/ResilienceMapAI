#!/usr/bin/env bash
# Repository-root secret audit. It reports only file/line/type metadata, never
# matched values, so running the audit cannot disclose a credential in logs.
set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

FAILED=0
CURRENT_FILE=""
CURRENT_COMMIT=""

is_excluded_path() {
  case "$1" in
    scripts/audit-secrets.sh|scripts/test-audit-secrets.sh|backend/tests/*) return 0 ;;
    *) return 1 ;;
  esac
}

is_safe_placeholder() {
  local text placeholder_re assignment_re
  text=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  placeholder_re='<[a-z0-9_[:space:]-]+>'
  assignment_re='[=:][[:space:]]*(your_api_key|your_actual_[a-z0-9_]*|api_key_here|example-key|replace-me|replace_me|changeme|dummy|test-only|test_only|configured|\.\.\.|postgres(ql)?://\.\.\.|sk-placeholder|sk-\.\.\.|sk-xxxx|sk-\[)'
  [[ "$text" =~ $assignment_re ]] ||
    [[ "$text" =~ sk-(your_actual|placeholder|\.\.\.|xxxx|\[) ]] ||
    [[ "$text" =~ $placeholder_re ]]
}

report() {
  local kind=$1 file=$2 line=$3 scope=${4:-working-tree}
  printf 'FAIL %-18s %s:%s (%s)\n' "$kind" "$file" "$line" "$scope"
  FAILED=$((FAILED + 1))
}

scan_worktree_pattern() {
  local kind=$1 pattern=$2 match file line content
  while IFS= read -r match; do
    file=${match%%:*}
    line=${match#*:}; line=${line%%:*}
    content=${match#*:*:}
    if is_excluded_path "$file" || is_safe_placeholder "$content"; then
      continue
    fi
    report "$kind" "$file" "$line"
  done < <(git grep -nI -E "$pattern" -- || true)
}

scan_history_pattern() {
  local kind=$1 pattern=$2 record line content file line_no=0
  CURRENT_FILE=""
  CURRENT_COMMIT=""
  while IFS= read -r record; do
    case "$record" in
      commit\ *) CURRENT_COMMIT=${record#commit } ;;
      +++\ b/*) CURRENT_FILE=${record#+++ b/}; line_no=0 ;;
      ---\ a/*) CURRENT_FILE=${record#--- a/}; line_no=0 ;;
      +*|-*)
        if [[ "$record" == "+++ " || "$record" == "--- " ]]; then
          continue
        fi
        line_no=$((line_no + 1))
        content=${record:1}
        if [[ -n "$CURRENT_FILE" ]] && ! is_excluded_path "$CURRENT_FILE" && ! is_safe_placeholder "$content" && printf '%s\n' "$content" | grep -qE "$pattern"; then
          report "$kind" "$CURRENT_FILE" "$line_no" "history:${CURRENT_COMMIT:0:12}"
        fi
        ;;
    esac
  done < <(git log --all -p --full-history --no-ext-diff -G "$pattern" --format='commit %H' -- backend/app frontend/app frontend/components frontend/lib backend/.env.example frontend/.env.example)
}

echo 'Secret audit: scanning tracked repository files from root.'

# Realistic credential formats. These patterns intentionally avoid generic
# prose such as "API key" and only suppress verified placeholder conventions.
scan_worktree_pattern 'openai-style' 'sk-[A-Za-z0-9_-]{20,}'
scan_worktree_pattern 'cloud-key' 'AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|gh[pousr]_[A-Za-z0-9_]{20,}'
scan_worktree_pattern 'bearer-token' 'Bearer[[:space:]]+[A-Za-z0-9._~-]{20,}'
scan_worktree_pattern 'database-uri' 'postgres(ql)?://[^[:space:]@:/]+:[^[:space:]@]+@'
scan_worktree_pattern 'jwt' 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
scan_worktree_pattern 'private-key' 'BEGIN [A-Z ]*PRIVATE KEY'
scan_worktree_pattern 'secret-assignment' '^[[:space:]]*(export[[:space:]]+)?(OPENAI|DEEPSEEK|QWEN|TOGETHER|MIMO|GEMINI|FIRECRAWL)_API_KEY[[:space:]]*=[[:space:]]*[^#[:space:]]+'
scan_worktree_pattern 'secret-assignment' '^[[:space:]]*(export[[:space:]]+)?(DATABASE_URL|JWT_SECRET|SECRET_KEY|ADMIN_SHARED_SECRET|CRON_SECRET)[[:space:]]*=[[:space:]]*[^#[:space:]]+'

# Example templates are intentionally tracked, while real local environment
# files remain forbidden at every directory level.
while IFS= read -r file; do
  case "$file" in
    .env.example|*/.env.example) ;;
    .env|.env.*|*/.env|*/.env.*) report 'tracked-env-file' "$file" 1 ;;
  esac
done < <(git ls-files)

# Scan historical additions and removals in deployable runtime paths and
# templates too. A committed real secret is a deployment blocker even if it
# no longer appears in the working tree. Documentation history is reviewed
# separately because it contains verified, explicit placeholder examples.
scan_history_pattern 'history-secret' 'sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|gh[pousr]_[A-Za-z0-9_]{20,}|Bearer[[:space:]]+[A-Za-z0-9._~-]{20,}|postgres(ql)?://[^[:space:]@:/]+:[^[:space:]@]+@|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|BEGIN [A-Z ]*PRIVATE KEY'

if (( FAILED > 0 )); then
  printf 'Secret audit failed: %d suspicious item(s). Values were not printed.\n' "$FAILED"
  exit 1
fi

echo 'Secret audit passed: no suspicious tracked credentials or history candidates found.'
