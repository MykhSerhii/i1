#!/usr/bin/env bash
# =============================================================================
# dev.sh — повний запуск "Карта висот України" з нуля
# Підтримує: Windows (Git Bash) та Linux
# Запуск: ./dev.sh
# =============================================================================
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$PROJECT_DIR/data"
TOOLS_DIR="$PROJECT_DIR/tools"
LOG_DIR="$PROJECT_DIR/logs"

# Кольори
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[ OK ]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR ]${NC} $*"; }
step()    { echo -e "\n${BOLD}${CYAN}━━━ $* ━━━${NC}"; }

cd "$PROJECT_DIR"
mkdir -p "$DATA_DIR" "$TOOLS_DIR" "$LOG_DIR"

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║        Карта висот України — dev.sh          ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# =============================================================================
# Визначення ОС
# =============================================================================
OS="linux"
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
  OS="windows"
elif [[ "$OSTYPE" == "darwin"* ]]; then
  OS="mac"
fi
info "Платформа: $OS ($OSTYPE)"

# =============================================================================
# 1. Перевірка залежностей
# =============================================================================
step "Перевірка залежностей"

check_cmd() {
  local cmd="$1" install_hint="$2"
  if command -v "$cmd" &>/dev/null; then
    success "$cmd → $(command -v "$cmd")"
  else
    error "$cmd не знайдено."
    echo "       Встановіть: $install_hint"
    exit 1
  fi
}

check_cmd node "https://nodejs.org  (LTS версія)"
check_cmd npm  "https://nodejs.org  (входить до Node.js)"

# Перевірка версії Node.js
NODE_MAJOR=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
  error "Потрібна Node.js 18+. Поточна: $(node --version)"
  exit 1
fi
success "Node.js $(node --version)"

# Python: на Windows зазвичай 'python', на Linux 'python3'
PYTHON_CMD=""
for cmd in python3 python; do
  if command -v "$cmd" &>/dev/null; then
    PY_VER=$("$cmd" -c "import sys; print(sys.version_info.major)" 2>/dev/null || echo "0")
    if [ "$PY_VER" = "3" ]; then
      PYTHON_CMD="$cmd"
      success "Python → $(command -v "$cmd") ($($cmd --version 2>&1))"
      break
    fi
  fi
done

if [ -z "$PYTHON_CMD" ]; then
  error "Python 3 не знайдено."
  if [ "$OS" = "windows" ]; then
    echo "       Встановіть: https://www.python.org/downloads/"
    echo "       Або через Microsoft Store: 'python'"
  else
    echo "       Встановіть: sudo apt-get install python3"
  fi
  exit 1
fi

# =============================================================================
# 2. npm install
# =============================================================================
step "Встановлення npm залежностей"

if [ ! -d "$PROJECT_DIR/node_modules/electron" ]; then
  info "Запуск npm install..."
  info "(завантажує Electron ~100 MB, може зайняти 2-5 хв)"
  npm install 2>&1 | tee "$LOG_DIR/npm-install.log" \
    | grep -E "^added|^found|error|postinstall|Downloading" || true
  success "npm install завершено"
else
  success "node_modules вже є (пропускаємо)"
fi

# =============================================================================
# 3. pmtiles CLI (go-pmtiles)
# =============================================================================
step "pmtiles CLI"

if [ "$OS" = "windows" ]; then
  PMTILES_BIN="$TOOLS_DIR/pmtiles.exe"
  PMTILES_URL="https://github.com/protomaps/go-pmtiles/releases/download/v1.30.1/go-pmtiles_1.30.1_Windows_x86_64.zip"
  PMTILES_ARCHIVE="$TOOLS_DIR/pmtiles.zip"
elif [ "$OS" = "mac" ]; then
  PMTILES_BIN="$TOOLS_DIR/pmtiles"
  PMTILES_URL="https://github.com/protomaps/go-pmtiles/releases/download/v1.30.1/go-pmtiles-1.30.1_Darwin_x86_64.zip"
  PMTILES_ARCHIVE="$TOOLS_DIR/pmtiles.zip"
else
  PMTILES_BIN="$TOOLS_DIR/pmtiles"
  PMTILES_URL="https://github.com/protomaps/go-pmtiles/releases/download/v1.30.1/go-pmtiles_1.30.1_Linux_x86_64.tar.gz"
  PMTILES_ARCHIVE=""
fi

if [ ! -f "$PMTILES_BIN" ]; then
  info "Завантаження go-pmtiles CLI (~17 MB)..."
  if [ "$OS" = "windows" ] || [ "$OS" = "mac" ]; then
    curl -sL "$PMTILES_URL" -o "$PMTILES_ARCHIVE"
    if command -v unzip &>/dev/null; then
      unzip -oq "$PMTILES_ARCHIVE" -d "$TOOLS_DIR"
    else
      # Git Bash на Windows має unzip або можна використати Python
      "$PYTHON_CMD" -c "
import zipfile, sys
with zipfile.ZipFile('$PMTILES_ARCHIVE', 'r') as z:
    z.extractall('$TOOLS_DIR')
"
    fi
    rm -f "$PMTILES_ARCHIVE"
  else
    curl -sL "$PMTILES_URL" | tar xz -C "$TOOLS_DIR"
  fi
  chmod +x "$PMTILES_BIN" 2>/dev/null || true
  success "pmtiles встановлено: $PMTILES_BIN"
else
  success "pmtiles вже є: $PMTILES_BIN"
fi

# =============================================================================
# 4. Шрифти (Noto Sans, glyph PBF для підписів карти)
# =============================================================================
step "Шрифти карти (Noto Sans)"

FONTS_CHECK="$PROJECT_DIR/public/fonts/Noto Sans Regular/0-255.pbf"
if [ ! -f "$FONTS_CHECK" ]; then
  info "Завантаження Noto Sans (Latin + Кирилиця)..."
  node scripts/download_fonts.js 2>&1 | tee "$LOG_DIR/fonts.log"
  success "Шрифти завантажено"
else
  success "Шрифти вже є"
fi

# =============================================================================
# 5. Базова векторна карта України
# =============================================================================
step "Базова векторна карта (Protomaps / OpenStreetMap)"

if [ ! -f "$DATA_DIR/ukraine.pmtiles" ]; then
  info "Витягуємо Україну з Protomaps planet через HTTP range requests"
  info "Bbox: 22°E,44°N → 41°E,53°N | zoom 0-14 | ~2 GB"
  info "НЕ завантажується весь планет (125 GB) — тільки потрібні тайли!"
  info "Може зайняти 10-20 хв залежно від швидкості інтернету..."

  "$PMTILES_BIN" extract \
    https://build.protomaps.com/20260313.pmtiles \
    "$DATA_DIR/ukraine.pmtiles" \
    --bbox=22,44,41,53 \
    --maxzoom=14 \
    2>&1 | tee "$LOG_DIR/basemap.log"

  if [ -f "$DATA_DIR/ukraine.pmtiles" ]; then
    SIZE=$(du -sh "$DATA_DIR/ukraine.pmtiles" | cut -f1)
    success "Базова карта: $SIZE"
  else
    error "Помилка! Перевірте лог: $LOG_DIR/basemap.log"
    exit 1
  fi
else
  SIZE=$(du -sh "$DATA_DIR/ukraine.pmtiles" | cut -f1)
  success "Базова карта вже є: $SIZE"
fi

# =============================================================================
# 6. Тайли висот (Terrarium / AWS Open Data)
# =============================================================================
step "Тайли висот (AWS Open Data, Terrarium)"

if [ ! -f "$DATA_DIR/ukraine-terrain.pmtiles" ]; then
  info "Завантаження ~11,500 тайлів висот (zoom 0-11, ~78 м/піксель)"
  info "Джерело: AWS elevation-tiles-prod (безкоштовно, без API ключа)"
  info "Може зайняти 5-15 хв..."

  # Передаємо шлях до pmtiles binary через змінну середовища
  PMTILES_BIN="$PMTILES_BIN" "$PYTHON_CMD" scripts/fetch_terrain.py \
    2>&1 | tee "$LOG_DIR/terrain.log"

  if [ -f "$DATA_DIR/ukraine-terrain.pmtiles" ]; then
    SIZE=$(du -sh "$DATA_DIR/ukraine-terrain.pmtiles" | cut -f1)
    success "Terrain PMTiles: $SIZE"
  else
    error "Помилка! Перевірте лог: $LOG_DIR/terrain.log"
    exit 1
  fi
else
  SIZE=$(du -sh "$DATA_DIR/ukraine-terrain.pmtiles" | cut -f1)
  success "Terrain вже є: $SIZE"
fi

# =============================================================================
# 7. Збірка JS bundle
# =============================================================================
step "Збірка JavaScript (esbuild)"

node scripts/build.js 2>&1 | tee "$LOG_DIR/build.log"
success "Bundle зібрано: src/bundle.js, src/worker-bundle.js"

# =============================================================================
# 8. Підсумок
# =============================================================================
step "Готово — всі файли"

check_file() {
  local f="$1" label="$2"
  if [ -f "$f" ]; then
    local s; s=$(du -sh "$f" 2>/dev/null | cut -f1)
    success "$label ($s)"
  else
    warn "$label — ВІДСУТНІЙ"
  fi
}

check_file "$DATA_DIR/ukraine.pmtiles"         "data/ukraine.pmtiles"
check_file "$DATA_DIR/ukraine-terrain.pmtiles" "data/ukraine-terrain.pmtiles"
check_file "$PROJECT_DIR/src/bundle.js"        "src/bundle.js"
check_file "$PROJECT_DIR/src/worker-bundle.js" "src/worker-bundle.js"

# =============================================================================
# 9. Запуск Electron
# =============================================================================
step "Запуск застосунку"

# На Windows завжди використовуємо electron.exe напряму — .cmd через cmd.exe не працює в Git Bash
if [ "$OS" = "windows" ]; then
  ELECTRON_BIN="$PROJECT_DIR/node_modules/electron/dist/electron.exe"
elif [ "$OS" = "mac" ]; then
  ELECTRON_BIN="$PROJECT_DIR/node_modules/.bin/electron"
else
  ELECTRON_BIN="$PROJECT_DIR/node_modules/.bin/electron"
fi

if [ ! -f "$ELECTRON_BIN" ]; then
  error "Electron не знайдено: $ELECTRON_BIN"
  error "Спробуйте: npm install"
  exit 1
fi

echo ""
info "Запуск: $ELECTRON_BIN"
info "Логи: $LOG_DIR/"
echo ""

if [ "$OS" = "windows" ]; then
  # Запускаємо electron.exe напряму з поточної директорії
  # Git Bash автоматично конвертує /c/... → C:\...
  exec "$ELECTRON_BIN" .
elif [ "$OS" = "linux" ]; then
  # На Linux (Docker/Xvfb) потрібні додаткові прапори
  if [ -z "$DISPLAY" ]; then
    export DISPLAY=:99
    warn "DISPLAY не встановлено, використовуємо :99 (Xvfb)"
  fi
  exec "$ELECTRON_BIN" . \
    --no-sandbox \
    --disable-gpu \
    --enable-unsafe-swiftshader \
    2>>"$LOG_DIR/electron.log"
else
  # macOS
  exec "$ELECTRON_BIN" "$PROJECT_DIR"
fi
