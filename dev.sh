#!/usr/bin/env bash
# =============================================================================
# dev.sh — повний запуск проекту "Карта висот України" з нуля
# =============================================================================
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$PROJECT_DIR/data"
TOOLS_DIR="$PROJECT_DIR/tools"
PMTILES_BIN="$TOOLS_DIR/pmtiles"
LOG_DIR="/tmp/ukraine-map-logs"

# Кольори для виводу
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*"; }
step()    { echo -e "\n${BOLD}${CYAN}━━━ $* ${NC}"; }

cd "$PROJECT_DIR"
mkdir -p "$DATA_DIR" "$LOG_DIR"

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║        Карта висот України — dev.sh          ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# =============================================================================
# 1. Перевірка залежностей
# =============================================================================
step "Перевірка системних залежностей"

check_cmd() {
  if command -v "$1" &>/dev/null; then
    success "$1 знайдено: $(command -v "$1")"
  else
    error "$1 не знайдено. Встановіть: $2"
    exit 1
  fi
}

check_cmd node  "https://nodejs.org"
check_cmd npm   "https://nodejs.org"
check_cmd python3 "sudo apt-get install python3"

NODE_VER=$(node -e "process.exit(parseInt(process.version.slice(1)) < 18 ? 1 : 0)" 2>/dev/null && echo "ok" || echo "old")
if [ "$NODE_VER" = "old" ]; then
  error "Потрібна Node.js версія 18+. Поточна: $(node --version)"
  exit 1
fi
success "Node.js $(node --version)"

# =============================================================================
# 2. npm install
# =============================================================================
step "Встановлення npm залежностей"

if [ ! -d "$PROJECT_DIR/node_modules/electron" ]; then
  info "Запуск npm install (може зайняти 1-2 хв)..."
  npm install 2>&1 | tee "$LOG_DIR/npm-install.log" | grep -E "added|warn|error|postinstall" || true
  success "npm install завершено"
else
  info "node_modules вже існує, пропускаємо (запустіть 'npm install' вручну для оновлення)"
fi

# =============================================================================
# 3. go-pmtiles CLI
# =============================================================================
step "Перевірка pmtiles CLI"

if [ ! -f "$PMTILES_BIN" ]; then
  info "Завантаження go-pmtiles CLI..."
  mkdir -p "$TOOLS_DIR"
  PMTILES_URL="https://github.com/protomaps/go-pmtiles/releases/download/v1.30.1/go-pmtiles_1.30.1_Linux_x86_64.tar.gz"
  curl -sL "$PMTILES_URL" | tar xz -C "$TOOLS_DIR"
  chmod +x "$PMTILES_BIN"
  success "pmtiles $($PMTILES_BIN --version 2>&1 | head -1)"
else
  success "pmtiles вже є: $PMTILES_BIN"
fi

# =============================================================================
# 4. Завантаження шрифтів (glyph PBF для підписів)
# =============================================================================
step "Завантаження шрифтів для карти"

FONTS_DIR="$PROJECT_DIR/public/fonts/Noto Sans Regular"
if [ ! -f "$FONTS_DIR/0-255.pbf" ]; then
  info "Завантаження шрифтів Noto Sans (Latin + Cyrillic)..."
  node scripts/download_fonts.js 2>&1 | tee "$LOG_DIR/fonts.log"
  success "Шрифти завантажено"
else
  success "Шрифти вже завантажено"
fi

# =============================================================================
# 5. Базова карта (векторні тайли)
# =============================================================================
step "Базова векторна карта України"

if [ ! -f "$DATA_DIR/ukraine.pmtiles" ]; then
  info "Завантаження векторних тайлів з Protomaps..."
  info "Bbox: 22,44 → 41,53 (Україна + буфер), zoom 0-14"
  info "Розмір: ~2 GB, може зайняти 5-10 хв залежно від швидкості інтернету"
  "$PMTILES_BIN" extract \
    https://build.protomaps.com/20260313.pmtiles \
    "$DATA_DIR/ukraine.pmtiles" \
    --bbox=22,44,41,53 \
    --maxzoom=14 2>&1 | tee "$LOG_DIR/basemap-extract.log"

  if [ -f "$DATA_DIR/ukraine.pmtiles" ]; then
    SIZE=$(du -sh "$DATA_DIR/ukraine.pmtiles" | cut -f1)
    success "Базова карта завантажена: $SIZE"
  else
    error "Помилка завантаження базової карти. Перевірте $LOG_DIR/basemap-extract.log"
    exit 1
  fi
else
  SIZE=$(du -sh "$DATA_DIR/ukraine.pmtiles" | cut -f1)
  success "Базова карта вже є: $SIZE"
fi

# =============================================================================
# 6. Тайли висот (terrain)
# =============================================================================
step "Завантаження тайлів висот (Terrarium / AWS Open Data)"

if [ ! -f "$DATA_DIR/ukraine-terrain.pmtiles" ]; then
  info "Перевірка Python залежностей..."
  python3 -c "import urllib.request, sqlite3, concurrent.futures" 2>/dev/null \
    && success "Python стандартні бібліотеки — OK" \
    || { error "Потрібна Python 3.8+"; exit 1; }

  info "Завантаження ~11,500 тайлів висот (zoom 0-11, ~78m/pixel)"
  info "Джерело: AWS Open Data (elevation-tiles-prod), безкоштовно, без API ключа"
  info "Розмір: ~540 MB, може зайняти 5-15 хв"

  python3 scripts/fetch_terrain.py 2>&1 | tee "$LOG_DIR/terrain.log"

  if [ -f "$DATA_DIR/ukraine-terrain.pmtiles" ]; then
    SIZE=$(du -sh "$DATA_DIR/ukraine-terrain.pmtiles" | cut -f1)
    success "Terrain PMTiles готовий: $SIZE"
  else
    error "Помилка створення terrain файлу. Перевірте $LOG_DIR/terrain.log"
    exit 1
  fi
else
  SIZE=$(du -sh "$DATA_DIR/ukraine-terrain.pmtiles" | cut -f1)
  success "Terrain вже є: $SIZE"
fi

# =============================================================================
# 7. Збірка JS bundle
# =============================================================================
step "Збірка JavaScript"

info "esbuild: src/app.js → src/bundle.js, src/worker.js → src/worker-bundle.js"
node scripts/build.js 2>&1 | tee "$LOG_DIR/build.log"
success "Збірка завершена"

# =============================================================================
# 8. Підсумок файлів
# =============================================================================
step "Стан файлів проекту"

show_file() {
  local file="$1" label="$2"
  if [ -f "$file" ]; then
    local size
    size=$(du -sh "$file" 2>/dev/null | cut -f1)
    success "$label ($size)"
  else
    warn "$label — файл відсутній"
  fi
}

show_file "$DATA_DIR/ukraine.pmtiles"         "data/ukraine.pmtiles (базова карта)"
show_file "$DATA_DIR/ukraine-terrain.pmtiles" "data/ukraine-terrain.pmtiles (висоти)"
show_file "$PROJECT_DIR/src/bundle.js"        "src/bundle.js"
show_file "$PROJECT_DIR/src/worker-bundle.js" "src/worker-bundle.js"

# =============================================================================
# 9. Запуск Electron
# =============================================================================
step "Запуск застосунку (dev режим)"

ELECTRON_BIN="$PROJECT_DIR/node_modules/.bin/electron"

if [ ! -f "$ELECTRON_BIN" ]; then
  error "Electron не знайдено: $ELECTRON_BIN"
  exit 1
fi

# Визначаємо дисплей
if [ -z "$DISPLAY" ]; then
  if xdpyinfo -display :99 &>/dev/null 2>&1; then
    export DISPLAY=:99
    info "Використовуємо Xvfb дисплей :99"
  else
    warn "DISPLAY не встановлено. Запускаємо з DISPLAY=:99"
    export DISPLAY=:99
  fi
fi

echo ""
info "Запуск Electron..."
info "Лог помилок: $LOG_DIR/electron.log"
echo ""

# Запуск з обов'язковими прапорами для Docker/Xvfb
exec "$ELECTRON_BIN" . \
  --no-sandbox \
  --disable-gpu \
  --enable-unsafe-swiftshader \
  2>"$LOG_DIR/electron.log"
