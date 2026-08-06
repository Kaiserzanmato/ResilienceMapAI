#!/bin/bash

# Security Audit: Check for exposed secrets
# Run from project root: ./scripts/audit-secrets.sh

set -e

echo "🔍 Starting security audit..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

# Function to run a check
run_check() {
  local check_name=$1
  local command=$2

  echo -n "Checking: $check_name ... "

  if eval "$command" > /dev/null 2>&1; then
    echo -e "${RED}❌ FAIL${NC} - Secrets found!"
    FAILED=$((FAILED + 1))
  else
    echo -e "${GREEN}✅ PASS${NC}"
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Checking for exposed API keys..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check for common secret patterns in source code
run_check "DeepSeek API keys in source" \
  'git grep -n -E "sk-[A-Za-z0-9]{16,}" -- "*.ts" "*.tsx" "*.py" "*.js" ":!backend/tests/**"'

run_check "Hardcoded DEEPSEEK_API_KEY in source" \
  'git grep -n -E "DEEPSEEK_API_KEY\s*=\s*[^\"'"'"'\"[:space:]]" -- "*.ts" "*.tsx" "*.py" "*.js"'

run_check "API keys in frontend code" \
  'git grep -n -E "(apiKey|API_KEY)\s*[:=]\s*[\"'"'"'][^\"'"'"']{12,}" -- "frontend/**/*.ts" "frontend/**/*.tsx" "frontend/**/*.js"'

run_check "process.env.DEEPSEEK_API_KEY in frontend" \
  'grep -r "process\.env\.DEEPSEEK_API_KEY" frontend/ --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null | grep -v node_modules'

run_check "Authorization headers in logs" \
  'grep -r "Authorization\|Bearer" app/ --include="*.py" 2>/dev/null | grep -i "log\|print" | grep -v "test\|__pycache__"'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Checking git safety..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

run_check ".env file tracked in git" \
  'git ls-files | grep -E "^\.env($|\.)"'

run_check "private environment files tracked in git" \
  'git grep -n -E "^(OPENAI_API_KEY|DEEPSEEK_API_KEY|QWEN_API_KEY|TOGETHER_API_KEY|MIMO_API_KEY|GEMINI_API_KEY|FIRECRAWL_API_KEY|ADMIN_SHARED_SECRET|CRON_SECRET)=.+" -- "backend/.env*" "frontend/.env*"'

run_check "credential-shaped secrets in production history" \
  'git log --all -G "sk-[A-Za-z0-9]{16,}" --pretty=format:"%h %s" -- backend/app frontend/app frontend/components frontend/lib | grep .'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Environment file checks..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f "backend/.env.local" ]; then
  echo -e "${GREEN}✅ .env.local exists${NC}"

  if grep -q "DEEPSEEK_API_KEY" backend/.env.local; then
    echo -e "${GREEN}✅ DEEPSEEK_API_KEY is configured${NC}"
  else
    echo -e "${YELLOW}⚠️  DEEPSEEK_API_KEY not found in .env.local${NC}"
  fi

  # Check file permissions
  perms=$(ls -l backend/.env.local | awk '{print $1}')
  echo "File permissions: $perms"
else
  echo -e "${YELLOW}⚠️  backend/.env.local not found (required for local development)${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All security checks passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ $FAILED security check(s) failed${NC}"
  echo "Review the output above and remove any exposed secrets."
  exit 1
fi
