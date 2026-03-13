#!/usr/bin/env python3
"""
Fetches Terrarium elevation tiles for Ukraine from AWS Open Data
and packages them into an MBTiles file, then converts to PMTiles.

Source: https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
Free, no API key required (AWS Open Data).
"""

import math
import os
import sqlite3
import sys
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
# Ukraine bounding box
BBOX = (22.0, 44.0, 41.0, 53.0)  # west, south, east, north
MIN_ZOOM = 0
MAX_ZOOM = 11
MAX_WORKERS = 64

# Paths — визначаємо відносно скрипту, підтримує Windows і Linux
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_DIR = os.path.dirname(_SCRIPT_DIR)
_DATA_DIR = os.path.join(_PROJECT_DIR, "data")
_TOOLS_DIR = os.path.join(_PROJECT_DIR, "tools")

OUTPUT_MBTILES = os.path.join(_DATA_DIR, "ukraine-terrain.mbtiles")
OUTPUT_PMTILES = os.path.join(_DATA_DIR, "ukraine-terrain.pmtiles")

# pmtiles binary: env змінна має пріоритет (встановлюється з dev.sh)
_pmtiles_exe = "pmtiles.exe" if sys.platform == "win32" else "pmtiles"
PMTILES_BIN = os.environ.get(
    "PMTILES_BIN",
    os.path.join(_TOOLS_DIR, _pmtiles_exe)
)


def lon_to_tile_x(lon, zoom):
    return int((lon + 180.0) / 360.0 * (1 << zoom))


def lat_to_tile_y(lat, zoom):
    lat_r = math.radians(lat)
    return int((1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * (1 << zoom))


def get_tile_range(bbox, zoom):
    west, south, east, north = bbox
    x1 = lon_to_tile_x(west, zoom)
    x2 = lon_to_tile_x(east, zoom)
    y1 = lat_to_tile_y(north, zoom)  # north = smaller y
    y2 = lat_to_tile_y(south, zoom)  # south = larger y
    return x1, y1, min(x2, (1 << zoom) - 1), min(y2, (1 << zoom) - 1)


def count_tiles(bbox, min_zoom, max_zoom):
    total = 0
    for z in range(min_zoom, max_zoom + 1):
        x1, y1, x2, y2 = get_tile_range(bbox, z)
        total += (x2 - x1 + 1) * (y2 - y1 + 1)
    return total


def fetch_tile(z, x, y):
    url = TILE_URL.format(z=z, x=x, y=y)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ukraine-map-app/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            return z, x, y, resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return z, x, y, None  # Ocean/no data tile
        print(f"  HTTP error {e.code} for {z}/{x}/{y}", file=sys.stderr)
        return z, x, y, None
    except Exception as e:
        print(f"  Error fetching {z}/{x}/{y}: {e}", file=sys.stderr)
        return z, x, y, None


def create_mbtiles(path):
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE IF NOT EXISTS metadata (name TEXT, value TEXT)")
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tiles "
        "(zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB)"
    )
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS tile_index "
        "ON tiles (zoom_level, tile_column, tile_row)"
    )
    conn.execute("INSERT OR REPLACE INTO metadata VALUES ('name', 'Ukraine Terrain')")
    conn.execute("INSERT OR REPLACE INTO metadata VALUES ('type', 'baselayer')")
    conn.execute("INSERT OR REPLACE INTO metadata VALUES ('version', '1')")
    conn.execute("INSERT OR REPLACE INTO metadata VALUES ('description', 'Terrarium elevation tiles for Ukraine')")
    conn.execute("INSERT OR REPLACE INTO metadata VALUES ('format', 'png')")
    conn.execute("INSERT OR REPLACE INTO metadata VALUES ('bounds', '22,44,41,53')")
    conn.execute(f"INSERT OR REPLACE INTO metadata VALUES ('minzoom', '{MIN_ZOOM}')")
    conn.execute(f"INSERT OR REPLACE INTO metadata VALUES ('maxzoom', '{MAX_ZOOM}')")
    conn.commit()
    return conn


def tms_y(y, z):
    """Convert XYZ tile y to TMS y (MBTiles uses TMS)."""
    return (1 << z) - 1 - y


def main():
    os.makedirs(os.path.dirname(OUTPUT_MBTILES), exist_ok=True)

    total = count_tiles(BBOX, MIN_ZOOM, MAX_ZOOM)
    print(f"Fetching {total:,} terrain tiles for Ukraine (zoom {MIN_ZOOM}-{MAX_ZOOM})...")
    print(f"Source: AWS Open Data Terrain Tiles (Terrarium format)")
    print(f"Output: {OUTPUT_MBTILES}")
    print()

    conn = create_mbtiles(OUTPUT_MBTILES)
    fetched = 0
    errors = 0

    for z in range(MIN_ZOOM, MAX_ZOOM + 1):
        x1, y1, x2, y2 = get_tile_range(BBOX, z)
        tiles_at_zoom = (x2 - x1 + 1) * (y2 - y1 + 1)
        print(f"  Zoom {z:2d}: {tiles_at_zoom:6,} tiles ({x2-x1+1}x{y2-y1+1})", flush=True)

        work = [(z, x, y) for x in range(x1, x2 + 1) for y in range(y1, y2 + 1)]

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = [executor.submit(fetch_tile, z, x, y) for z, x, y in work]
            batch = []
            for future in as_completed(futures):
                z_, x_, y_, data = future.result()
                if data:
                    batch.append((z_, x_, tms_y(y_, z_), data))
                    fetched += 1
                else:
                    errors += 1

                if len(batch) >= 200:
                    conn.executemany(
                        "INSERT OR REPLACE INTO tiles VALUES (?, ?, ?, ?)", batch
                    )
                    conn.commit()
                    batch = []

                total_done = fetched + errors
                if total_done % 500 == 0:
                    print(f"    Progress: {total_done}/{total} ({100*total_done//total}%)", flush=True)

            if batch:
                conn.executemany("INSERT OR REPLACE INTO tiles VALUES (?, ?, ?, ?)", batch)
                conn.commit()

    conn.close()
    print(f"\nDone! Fetched {fetched:,} tiles, {errors:,} missing/errors")
    print(f"MBTiles saved: {OUTPUT_MBTILES}")

    # Convert to PMTiles
    if os.path.exists(PMTILES_BIN):
        print(f"\nConverting to PMTiles...")
        os.system(f"{PMTILES_BIN} convert {OUTPUT_MBTILES} {OUTPUT_PMTILES}")
        if os.path.exists(OUTPUT_PMTILES):
            size = os.path.getsize(OUTPUT_PMTILES) / (1024 ** 3)
            print(f"PMTiles saved: {OUTPUT_PMTILES} ({size:.2f} GB)")
            os.remove(OUTPUT_MBTILES)
            print("Removed intermediate MBTiles file.")
    else:
        print(f"pmtiles binary not found at {PMTILES_BIN}")
        print(f"Run manually: {PMTILES_BIN} convert {OUTPUT_MBTILES} {OUTPUT_PMTILES}")


if __name__ == "__main__":
    main()
