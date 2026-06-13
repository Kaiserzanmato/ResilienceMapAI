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
  'grep -r "sk-" . --include="*.ts" --include="*.tsx" --include="*.py" --include="*.js" 2>/dev/null | grep -v node_modules | grep -v ".next" | grep -v "__pycache__"'

run_check "Hardcoded DEEPSEEK_API_KEY in source" \
  'grep -r "DEEPSEEK_API_KEY\s*=" . --include="*.ts" --include="*.tsx" --include="*.py" --include="*.js" 2>/dev/null | grep -v node_modules | grep -v ".next" | grep -v "__pycache__" | grep -v ".env.example" | grep -v "DEEPSEEK_SECURE_SETUP.md"'

run_check "API keys in frontend code" \
  'grep -r "apiKey\|API_KEY" frontend/ --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null | grep -v node_modules | grep -v ".next" | grep -v "config.ts" | grep -v "types.ts"'

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

run_check ".env.local tracked in git" \
  'git ls-files | grep -E "\.env\.local"'

run_check "Secret commits in history" \
  'git log --all -S "sk-" --pretty=format:"%h %s"'

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
