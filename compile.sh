#!/usr/bin/env bash
# =============================================================================
# compile.sh — збірка map.exe (Windows portable)
# Результат: dist-electron/map.exe
#
# Запуск:
#   На Windows (Git Bash): ./compile.sh
#   На Linux:              ./compile.sh
# =============================================================================
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
OUTPUT_DIR="$PROJECT_DIR/dist-electron"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'
RED='\033[0;31m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[ OK ]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR ]${NC} $*"; }
step()    { echo -e "\n${BOLD}${CYAN}━━━ $* ━━━${NC}"; }

cd "$PROJECT_DIR"
mkdir -p "$LOG_DIR"

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║      Карта висот України — compile.sh        ║"
echo "║           Збірка Windows map.exe             ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# =============================================================================
# 1. Перевірка залежностей
# =============================================================================
step "Перевірка залежностей"

for cmd in node npm; do
  if command -v "$cmd" &>/dev/null; then
    success "$cmd $(${cmd} --version)"
  else
    error "$cmd не знайдено. Встановіть Node.js: https://nodejs.org"
    exit 1
  fi
done

if [ ! -d "$PROJECT_DIR/node_modules/electron-builder" ]; then
  error "electron-builder не встановлено. Запустіть: npm install"
  exit 1
fi
success "electron-builder $(node -e "console.log(require('./node_modules/electron-builder/package.json').version)")"

# =============================================================================
# 2. npm install (якщо потрібно)
# =============================================================================
step "npm залежності"

if [ ! -d "$PROJECT_DIR/node_modules/electron" ]; then
  info "Встановлення залежностей..."
  npm install 2>&1 | tee "$LOG_DIR/npm-install.log" \
    | grep -E "^added|^up to date|error" || true
else
  success "node_modules вже є"
fi

# =============================================================================
# 3. Шрифти (потрапляють в exe через extraResources)
# =============================================================================
step "Шрифти"

FONTS_CHECK="$PROJECT_DIR/public/fonts/Noto Sans Regular/0-255.pbf"
if [ ! -f "$FONTS_CHECK" ]; then
  info "Завантаження шрифтів..."
  node scripts/download_fonts.js 2>&1 | tee "$LOG_DIR/fonts.log"
  success "Шрифти завантажено"
else
  success "Шрифти вже є"
fi

# =============================================================================
# 4. Збірка JS bundle
# =============================================================================
step "Збірка JavaScript (esbuild)"

node scripts/build.js 2>&1 | tee "$LOG_DIR/build.log"
success "src/bundle.js та src/worker-bundle.js готові"

# =============================================================================
# 5. @electron/packager → map-win32-x64/ з map.exe всередині
# =============================================================================
# Використовуємо @electron/packager замість electron-builder —
# він НЕ використовує winCodeSign і не потребує прав адміністратора.
step "Компіляція (electron-packager)"

PACK_OUT="$OUTPUT_DIR/map-win32-x64"

info "Ціль: Windows x64"
info "Вивід: $PACK_OUT/"
info "Це може зайняти 2-5 хв (перший раз довше — завантажує Electron binaries)..."
echo ""

# Очищаємо попередній білд
rm -rf "$PACK_OUT"

node_modules/.bin/electron-packager . map \
  --platform=win32 \
  --arch=x64 \
  --out="$OUTPUT_DIR" \
  --overwrite \
  --ignore="^/data($|/)" \
  --ignore="^/logs($|/)" \
  --ignore="^/tools($|/)" \
  --ignore="^/scripts($|/)" \
  --ignore="^/src($|/)" \
  --ignore="^/\.git($|/)" \
  --ignore="^/dist-electron($|/)" \
  --ignore="dev\.sh$" \
  --ignore="update\.sh$" \
  --ignore="compile\.sh$" \
  --ignore="README\.md$" \
  --extra-resource="public" \
  --app-version="1.0.0" \
  2>&1 | tee "$LOG_DIR/compile.log"

# =============================================================================
# 6. Результат
# =============================================================================
step "Результат"

EXE_FILE="$PACK_OUT/map.exe"
if [ -f "$EXE_FILE" ]; then
  SIZE=$(du -sh "$PACK_OUT" | cut -f1)
  echo ""
  success "Готово! Папка зібрана: $SIZE"
  echo ""
  echo -e "${BOLD}  Папка:${NC} $PACK_OUT/"
  echo -e "${BOLD}  Exe:${NC}   $EXE_FILE"
  echo ""
  echo -e "${BOLD}  Щоб розповсюдити:${NC}"
  echo "  1. Скопіюйте всю папку map-win32-x64/ куди завгодно"
  echo "  2. Поруч з map.exe покладіть папку data/:"
  echo ""
  echo -e "  ${YELLOW}map-win32-x64/${NC}"
  echo "  ├── map.exe                    ← запускати це"
  echo "  ├── ... (Electron runtime)"
  echo "  └── data/                      ← скопіювати сюди"
  echo "      ├── ukraine.pmtiles        (~2 GB)"
  echo "      └── ukraine-terrain.pmtiles (~540 MB)"
  echo ""
else
  error "map.exe не знайдено після збірки!"
  error "Перевірте лог: $LOG_DIR/compile.log"
  exit 1
fi
