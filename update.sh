#!/usr/bin/env bash
# =============================================================================
# update.sh — оновлення проекту до останньої версії
# Робить: git hard reset + npm install + rebuild bundle
# =============================================================================
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$PROJECT_DIR/logs"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[ OK ]${NC} $*"; }
step()    { echo -e "\n${BOLD}${CYAN}━━━ $* ━━━${NC}"; }

cd "$PROJECT_DIR"
mkdir -p "$LOG_DIR"

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║       Карта висот України — update.sh        ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# =============================================================================
# 1. Git — скидаємо до останньої версії з remote
# =============================================================================
step "Git оновлення"

info "Поточний коміт: $(git rev-parse --short HEAD) — $(git log -1 --format='%s')"
info "Завантаження змін з remote..."
git fetch origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  success "Вже остання версія ($(git rev-parse --short HEAD))"
else
  info "Скидання до origin/main (git reset --hard)..."
  git reset --hard origin/main
  success "Оновлено до: $(git rev-parse --short HEAD) — $(git log -1 --format='%s')"
fi

# =============================================================================
# 2. npm install — оновлення залежностей
# =============================================================================
step "npm install"

info "Перевірка та оновлення npm залежностей..."
npm install 2>&1 | tee "$LOG_DIR/npm-install.log" \
  | grep -E "^added|^removed|^changed|^up to date|error" || true
success "npm залежності актуальні"

# =============================================================================
# 3. Rebuild JS bundle
# =============================================================================
step "Збірка JavaScript"

node scripts/build.js 2>&1 | tee "$LOG_DIR/build.log"
success "Bundle зібрано: src/bundle.js, src/worker-bundle.js"

# =============================================================================
# Готово
# =============================================================================
echo ""
success "Оновлення завершено! Запустіть: ./dev.sh"
echo ""
