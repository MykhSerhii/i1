# Карта висот України

Офлайн-застосунок для Windows (та Linux) з інтерактивною картою висот України. Побудований на Electron + MapLibre GL JS. Всі дані зберігаються локально — жодних запитів до мережі під час роботи.

## Можливості

- **2D / 3D режими** — перемикання між плоскою картою та 3D-рельєфом
- **Піни-спостерігачі** — встановлення пінів правою кнопкою миші
  - Регулювання висоти спостерігача (наприклад, +10 м для вежі)
  - Регулювання радіусу (за замовчуванням 30 км)
- **Гіпсометричне забарвлення** — в межах радіусу кольори показують абсолютну висоту; зони вище спостерігача — сірі; поза радіусом — прозоро
- **Кілька пінів** — можна встановити необмежену кількість
- **Додавання за координатами** — введення точних lat/lng
- **Вимірювання відстані** — пряма горизонтальна лінія між точками
- **Повний офлайн** — карта, рельєф і шрифти зберігаються локально

## Технічний стек

| Компонент | Технологія |
|---|---|
| Десктоп | Electron 33 |
| Карта | MapLibre GL JS 4 |
| Офлайн тайли | PMTiles (Protomaps формат) |
| Базова карта | Protomaps OSM build |
| Висоти | AWS Open Data (Terrarium tiles) |
| Збірка | esbuild |
| Пакування | electron-builder → NSIS .exe |

## Швидкий старт

```bash
git clone https://github.com/MykhSerhii/i1.git
cd i1
chmod +x dev.sh
./dev.sh
```

Скрипт автоматично:
1. Встановить npm залежності
2. Завантажить `pmtiles` CLI (~17 MB)
3. Завантажить шрифти для підписів (Noto Sans, ~2 MB)
4. Завантажить базову векторну карту України (~2 GB)
5. Завантажить тайли висот (~540 MB)
6. Зберемо JS bundle
7. Запустить Electron

> Перший запуск займає **15–30 хвилин** через завантаження даних (~2.6 GB).
> Повторні запуски — миттєво (дані вже є).

## Структура проекту

```
ukraine-map/
├── main.js                  # Electron main process
├── preload.js               # IPC bridge
├── dev.sh                   # Скрипт автоматичного запуску
├── electron-builder.yml     # Конфіг збірки Windows .exe
├── package.json
│
├── src/
│   ├── index.html           # HTML shell
│   ├── style.css            # Стилі інтерфейсу
│   ├── app.js               # Точка входу (ES модуль)
│   ├── map.js               # Ініціалізація MapLibre
│   ├── map-style.js         # Стиль карти (Protomaps схема)
│   ├── pins.js              # Управління пінами
│   ├── elevation.js         # Overlay висот (гіпсометрія)
│   ├── worker.js            # Web Worker: обробка terrain тайлів
│   ├── measure.js           # Вимірювання відстані
│   ├── geo-utils.js         # Географічні утиліти
│   └── ui.js                # UI компоненти
│
├── scripts/
│   ├── build.js             # esbuild bundler
│   ├── download_fonts.js    # Завантаження glyph PBF шрифтів
│   └── fetch_terrain.py     # Завантаження terrain тайлів
│
├── public/
│   └── fonts/               # Noto Sans (Latin + Cyrillic), PBF формат
│
├── data/                    # Дані карти (не в git, ~2.6 GB)
│   ├── ukraine.pmtiles      # Векторна базова карта
│   └── ukraine-terrain.pmtiles  # Тайли висот (Terrarium)
│
└── tools/
    └── pmtiles              # go-pmtiles CLI бінарник
```

## Джерела даних

| Дані | Джерело | Ліцензія | Розмір |
|---|---|---|---|
| Базова карта (вектор) | [Protomaps](https://protomaps.com) / OpenStreetMap | ODbL | ~2 GB |
| Висоти (рельєф) | [AWS Open Data](https://registry.opendata.aws/terrain-tiles/) / Mapzen | Public Domain | ~540 MB |
| Шрифти | [OpenMapTiles Fonts](https://github.com/openmaptiles/fonts) | OFL | ~2 MB |

Всі дані **безкоштовні назавжди**. Жодних API ключів, підписок, реєстрацій.

## Збірка Windows .exe

```bash
# На Linux/macOS потрібен Wine або Windows-машина для підпису
npm run dist

# Результат:
# dist-electron/ukraine-map Setup.exe
```

## Управління

| Дія | Елемент |
|---|---|
| Додати пін | Правий клік на карті |
| Видалити пін | Правий клік на піні |
| Налаштувати пін | Клік на маркер → popup |
| Додати за координатами | Кнопка "Координати" |
| Увімкнути 3D | Кнопка "3D" |
| Виміряти відстань | Кнопка "Відстань" → клік 2 точки |

## Вимоги

- **Node.js** 18+ — [nodejs.org](https://nodejs.org)
- **Python** 3.8+ — для завантаження terrain тайлів
- **Інтернет** — тільки при першому запуску (завантаження ~2.6 GB)
- **Linux**: Xvfb для безголового запуску (`apt-get install xvfb`)
- **Windows**: запуск `.exe` без додаткових залежностей
