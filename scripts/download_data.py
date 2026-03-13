#!/usr/bin/env python3
"""
Ukraine Elevation Data Download and Processing Script

This script downloads Copernicus DEM 30m tiles for Ukraine and
processes them into PMTiles format for offline use.

Requirements:
  - GDAL (gdal_merge.py, gdal2tiles.py)
  - rasterio
  - rio-rgbify (pip install rio-rgbify)
  - pmtiles CLI (pip install pmtiles)

Usage:
  python download_data.py
"""

import os
import sys
import subprocess
import urllib.request
import urllib.error
from pathlib import Path

# Ukraine bounding box
LAT_MIN, LAT_MAX = 44, 52
LON_MIN, LON_MAX = 22, 40

# AWS S3 base URL for Copernicus DEM 30m (no authentication required)
COP_DEM_URL = (
    "https://copernicus-dem-30m.s3.amazonaws.com/"
    "Copernicus_DSM_COG_10_N{lat:02d}_00_E{lon:03d}_00_DEM/"
    "Copernicus_DSM_COG_10_N{lat:02d}_00_E{lon:03d}_00_DEM.tif"
)

WORK_DIR = Path("dem_work")
DATA_DIR = Path("data")


def check_dependency(cmd, name):
    """Check if a command-line tool is available."""
    try:
        result = subprocess.run(
            [cmd, "--version"],
            capture_output=True,
            text=True,
            timeout=10
        )
        print(f"  [ok] {name} found")
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        print(f"  [missing] {name} not found")
        return False


def check_python_package(package):
    """Check if a Python package is installed."""
    try:
        __import__(package.replace("-", "_"))
        print(f"  [ok] {package} found")
        return True
    except ImportError:
        print(f"  [missing] {package} not installed")
        return False


def check_dependencies():
    """Check all required dependencies."""
    print("Checking dependencies...")
    ok = True

    # Check GDAL tools
    if not check_dependency("gdal_merge.py", "gdal_merge.py"):
        ok = False
    if not check_dependency("gdal2tiles.py", "gdal2tiles.py"):
        ok = False

    # Check Python packages
    if not check_python_package("rasterio"):
        ok = False
    if not check_python_package("rio_rgbify"):
        ok = False

    # Check pmtiles CLI
    if not check_dependency("pmtiles", "pmtiles CLI"):
        print("  Install with: pip install pmtiles")
        ok = False

    return ok


def download_tile(lat, lon, dest_dir):
    """Download a single DEM tile."""
    url = COP_DEM_URL.format(lat=lat, lon=lon)
    filename = f"N{lat:02d}_E{lon:03d}.tif"
    dest_path = dest_dir / filename

    if dest_path.exists():
        print(f"  [skip] {filename} already downloaded")
        return dest_path

    try:
        print(f"  Downloading {filename}...")
        urllib.request.urlretrieve(url, dest_path)
        print(f"  [ok] {filename}")
        return dest_path
    except urllib.error.HTTPError as e:
        if e.code == 404:
            # Some tiles don't exist (sea areas)
            return None
        print(f"  [warn] Failed to download {filename}: HTTP {e.code}")
        return None
    except Exception as e:
        print(f"  [warn] Failed to download {filename}: {e}")
        return None


def run_command(cmd, description):
    """Run a shell command and check result."""
    print(f"\n{description}...")
    print(f"  Command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  [error] Command failed:")
        print(f"  stdout: {result.stdout}")
        print(f"  stderr: {result.stderr}")
        sys.exit(1)
    print(f"  [ok] Done")
    return result


def main():
    print("=" * 60)
    print("Ukraine Elevation Data Download & Processing")
    print("=" * 60)
    print()

    # Check dependencies
    if not check_dependencies():
        print("\n[error] Missing dependencies. Please install them and try again.")
        print("\nInstall commands:")
        print("  sudo apt-get install gdal-bin python3-gdal  # Ubuntu/Debian")
        print("  pip install rasterio rio-rgbify pmtiles")
        sys.exit(1)

    print()

    # Create directories
    WORK_DIR.mkdir(exist_ok=True)
    DATA_DIR.mkdir(exist_ok=True)
    tiles_dir = WORK_DIR / "dem_tiles"
    tiles_dir.mkdir(exist_ok=True)
    terrain_tiles_dir = WORK_DIR / "terrain_tiles"

    # Step 1: Download DEM tiles
    print("Step 1: Downloading Copernicus DEM 30m tiles for Ukraine...")
    print(f"  Bounding box: lat {LAT_MIN}-{LAT_MAX}, lon {LON_MIN}-{LON_MAX}")
    downloaded = []
    total = (LAT_MAX - LAT_MIN) * (LON_MAX - LON_MIN)
    count = 0
    for lat in range(LAT_MIN, LAT_MAX):
        for lon in range(LON_MIN, LON_MAX):
            count += 1
            print(f"  [{count}/{total}] ", end="")
            tile = download_tile(lat, lon, tiles_dir)
            if tile:
                downloaded.append(str(tile))

    if not downloaded:
        print("[error] No tiles downloaded. Check your internet connection.")
        sys.exit(1)

    print(f"\nDownloaded {len(downloaded)} tiles.")

    # Step 2: Merge tiles
    merged_dem = WORK_DIR / "ukraine_dem.tif"
    if not merged_dem.exists():
        run_command(
            ["gdal_merge.py", "-o", str(merged_dem)] + downloaded,
            "Step 2: Merging DEM tiles"
        )
    else:
        print("\nStep 2: Merged DEM already exists, skipping.")

    # Step 3: Convert to Terrarium RGB encoding
    terrain_rgb = WORK_DIR / "ukraine_terrain_rgb.tif"
    if not terrain_rgb.exists():
        run_command(
            [
                "rio", "rgbify",
                "-b", "-32768",
                "-i", "1.0",
                str(merged_dem),
                str(terrain_rgb)
            ],
            "Step 3: Converting to Terrarium RGB encoding"
        )
    else:
        print("\nStep 3: Terrarium RGB already exists, skipping.")

    # Step 4: Create XYZ tiles
    if not terrain_tiles_dir.exists():
        run_command(
            [
                "gdal2tiles.py",
                "--xyz",
                "-z", "0-12",
                "--processes=4",
                str(terrain_rgb),
                str(terrain_tiles_dir)
            ],
            "Step 4: Creating XYZ tiles (zoom 0-12)"
        )
    else:
        print("\nStep 4: Terrain tiles already exist, skipping.")

    # Step 5: Package to PMTiles
    terrain_pmtiles = DATA_DIR / "ukraine-terrain.pmtiles"
    if not terrain_pmtiles.exists():
        run_command(
            ["pmtiles", "convert", str(terrain_tiles_dir), str(terrain_pmtiles)],
            "Step 5: Packaging to PMTiles"
        )
    else:
        print("\nStep 5: ukraine-terrain.pmtiles already exists, skipping.")

    print("\n" + "=" * 60)
    print("Terrain data processing complete!")
    print(f"Output: {terrain_pmtiles.absolute()}")
    print()
    print("IMPORTANT: You still need the basemap PMTiles file.")
    print()
    print("Download the Ukraine basemap:")
    print("  1. Go to: https://protomaps.com/downloads/osm")
    print("  2. Select 'Ukraine' region")
    print("  3. Download the .pmtiles file")
    print("  4. Save it as: data/ukraine.pmtiles")
    print()
    print("Alternatively, download the latest Protomaps daily build:")
    print("  https://maps.protomaps.com/builds/")
    print("  (Extract Ukraine region using: pmtiles extract)")
    print()
    print("Example extract command:")
    print("  pmtiles extract https://maps.protomaps.com/builds/latest.pmtiles \\")
    print("    data/ukraine.pmtiles \\")
    print("    --bbox=22.0,44.0,40.0,52.8")
    print("=" * 60)


if __name__ == "__main__":
    main()
