#!/bin/bash

# Устанавливает git hooks для проекта

HOOKS_DIR="$(dirname "$0")/../.git/hooks"
SCRIPTS_DIR="$(dirname "$0")"

# Создаём pre-commit hook
cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/bin/bash

echo "🔍 Running pre-commit checks..."

# Проверка TypeScript
echo "📝 Checking TypeScript..."
cd client
if ! npx tsc --noEmit 2>&1; then
    echo "❌ TypeScript errors found! Fix them before committing."
    exit 1
fi
cd ..

echo "✅ All checks passed!"
exit 0
EOF

chmod +x "$HOOKS_DIR/pre-commit"

echo "✅ Git hooks installed successfully!"
echo ""
echo "Pre-commit hook will:"
echo "  - Check TypeScript errors"
echo ""
echo "To skip hooks (not recommended): git commit --no-verify"
