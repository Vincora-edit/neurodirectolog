#!/bin/bash
# Health check script - проверяет что всё работает после деплоя

set -e

ENV=${1:-staging}  # staging или prod

if [ "$ENV" = "prod" ]; then
  BASE_URL="https://dashboard.vincora.ru"
else
  BASE_URL="https://test-dashboard.vincora.ru"
fi

echo "🔍 Проверка $ENV ($BASE_URL)..."
echo ""

ERRORS=0

# 1. Проверка health endpoint
echo -n "1. Health endpoint... "
HEALTH=$(curl -s "$BASE_URL/health" 2>/dev/null)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "✅ OK"
else
  echo "❌ FAILED"
  echo "   Response: $HEALTH"
  ERRORS=$((ERRORS + 1))
fi

# 2. Проверка что frontend отдаётся
echo -n "2. Frontend (index.html)... "
FRONTEND=$(curl -s "$BASE_URL/" 2>/dev/null)
if echo "$FRONTEND" | grep -q '<div id="root"'; then
  echo "✅ OK"
else
  echo "❌ FAILED"
  ERRORS=$((ERRORS + 1))
fi

# 3. Проверка API auth endpoint
echo -n "3. Auth API endpoint... "
AUTH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}' 2>/dev/null)
# Ожидаем ошибку авторизации, но не 404/405
if echo "$AUTH_RESPONSE" | grep -q '"success":false'; then
  echo "✅ OK (returns auth error as expected)"
elif echo "$AUTH_RESPONSE" | grep -q '"success":true'; then
  echo "✅ OK"
else
  echo "❌ FAILED - endpoint not working"
  echo "   Response: $AUTH_RESPONSE"
  ERRORS=$((ERRORS + 1))
fi

# 4. Проверка что нет двойного /api/api
echo -n "4. No double /api/api... "
DOUBLE_API=$(curl -s "$BASE_URL/api/api/health" 2>/dev/null)
if echo "$DOUBLE_API" | grep -q '404\|Cannot GET'; then
  echo "✅ OK (correctly returns 404)"
else
  echo "⚠️  WARNING - might have routing issues"
fi

# 5. Проверка projects endpoint (требует auth, но должен вернуть 401, не 404)
echo -n "5. Projects API endpoint... "
PROJECTS=$(curl -s "$BASE_URL/api/projects/list" 2>/dev/null)
if echo "$PROJECTS" | grep -q 'Unauthorized\|No token\|401\|"success"'; then
  echo "✅ OK (auth required or success)"
else
  echo "❌ FAILED - endpoint not found"
  echo "   Response: $PROJECTS"
  ERRORS=$((ERRORS + 1))
fi

# 6. Проверка alerts endpoint
echo -n "6. Alerts API endpoint... "
ALERTS=$(curl -s "$BASE_URL/api/alerts" 2>/dev/null)
if echo "$ALERTS" | grep -q 'Unauthorized\|No token\|401\|"success"'; then
  echo "✅ OK (auth required or success)"
else
  echo "❌ FAILED - endpoint not found"
  echo "   Response: $ALERTS"
  ERRORS=$((ERRORS + 1))
fi

echo ""
echo "================================"
if [ $ERRORS -eq 0 ]; then
  echo "✅ Все проверки пройдены!"
  exit 0
else
  echo "❌ Ошибок: $ERRORS"
  echo "⚠️  НЕ ДЕПЛОИТЬ В ПРОД!"
  exit 1
fi
