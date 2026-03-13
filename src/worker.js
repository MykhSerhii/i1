import { PMTiles } from 'pmtiles';

let pmtiles = null;
let tileCache = new Map();

// Hypsometric color scale: elevation (meters) → [R, G, B]
const COLOR_SCALE = [
  { elev: -Infinity, color: [70, 130, 180] },  // sea blue
  { elev: 0,         color: [148, 210, 135] }, // low green
  { elev: 100,       color: [186, 224, 162] }, // light green
  { elev: 300,       color: [237, 220, 153] }, // yellow-green
  { elev: 600,       color: [210, 166, 107] }, // tan
  { elev: 900,       color: [185, 136, 90] },  // brown
  { elev: 1200,      color: [165, 100, 73] },  // dark brown
  { elev: 1600,      color: [200, 160, 140] }, // light gray-pink
  { elev: 2500,      color: [240, 240, 240] }  // white
];

/**
 * Decodes Terrarium RGB encoding to elevation in meters.
 * Formula: elevation = R * 256 + G + B / 256 - 32768
 */
function terrariumToElevation(r, g, b) {
  return r * 256 + g + b / 256 - 32768;
}

/**
 * Interpolates between two colors based on a factor (0-1).
 */
function lerpColor(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t)
  ];
}

/**
 * Returns hypsometric color for a given elevation.
 */
function elevationToColor(elevation) {
  if (elevation < COLOR_SCALE[0].elev) return COLOR_SCALE[0].color;

  for (let i = 1; i < COLOR_SCALE.length; i++) {
    if (elevation <= COLOR_SCALE[i].elev) {
      const prev = COLOR_SCALE[i - 1];
      const curr = COLOR_SCALE[i];
      const range = curr.elev - prev.elev;
      if (range <= 0) return curr.color;
      const t = (elevation - prev.elev) / range;
      return lerpColor(prev.color, curr.color, t);
    }
  }

  return COLOR_SCALE[COLOR_SCALE.length - 1].color;
}

/**
 * Converts lng/lat to tile x,y at given zoom.
 */
function lngLatToTile(lng, lat, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latR = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n);
  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y))
  };
}

/**
 * Converts tile + pixel offset to lng/lat.
 */
function pixelToLngLat(tileX, tileY, pixelX, pixelY, zoom, tileSize) {
  const n = Math.pow(2, zoom);
  const globalX = (tileX * tileSize + pixelX) / (tileSize * n);
  const globalY = (tileY * tileSize + pixelY) / (tileSize * n);
  const lng = globalX * 360 - 180;
  const latR = Math.atan(Math.sinh(Math.PI * (1 - 2 * globalY)));
  return { lng, lat: latR * 180 / Math.PI };
}

/**
 * Haversine distance in meters.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Decodes a PNG tile from ArrayBuffer using OffscreenCanvas.
 * Returns Uint8ClampedArray of RGBA pixel data.
 */
async function decodeTilePng(buffer, tileSize) {
  const blob = new Blob([buffer], { type: 'image/png' });
  const imageBitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(tileSize, tileSize);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageBitmap, 0, 0, tileSize, tileSize);
  return ctx.getImageData(0, 0, tileSize, tileSize).data;
}

/**
 * Gets elevation at a given lng/lat from the PMTiles terrain source.
 */
async function getElevationAt(lat, lng) {
  if (!pmtiles) return null;

  const zoom = 11;
  const tileSize = 512;
  const { x: tileX, y: tileY } = lngLatToTile(lng, lat, zoom);

  const cacheKey = `${zoom}/${tileX}/${tileY}`;
  let pixelData = tileCache.get(cacheKey);

  if (!pixelData) {
    try {
      const result = await pmtiles.getZxy(zoom, tileX, tileY);
      if (!result || !result.data) return null;
      pixelData = await decodeTilePng(result.data, tileSize);
      tileCache.set(cacheKey, pixelData);
    } catch (err) {
      console.error('Failed to fetch tile:', err);
      return null;
    }
  }

  // Find sub-pixel position within the tile
  const n = Math.pow(2, zoom);
  const globalPixelX = ((lng + 180) / 360) * n * tileSize;
  const globalPixelY = (() => {
    const latR = lat * Math.PI / 180;
    return (1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n * tileSize;
  })();

  const px = Math.floor(globalPixelX - tileX * tileSize);
  const py = Math.floor(globalPixelY - tileY * tileSize);

  if (px < 0 || px >= tileSize || py < 0 || py >= tileSize) return null;

  const idx = (py * tileSize + px) * 4;
  const r = pixelData[idx];
  const g = pixelData[idx + 1];
  const b = pixelData[idx + 2];

  return terrariumToElevation(r, g, b);
}

/**
 * Computes the visibility overlay image for all pins.
 */
async function computeOverlay(pins, defaultRadius) {
  if (!pmtiles || pins.length === 0) {
    return null;
  }

  // Compute union bounding box with radius padding
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  const R = 6371000;
  for (const pin of pins) {
    const radiusM = (pin.radius || defaultRadius) * 1000;
    const latDelta = (radiusM / R) * (180 / Math.PI);
    const lngDelta = (radiusM / R) * (180 / Math.PI) / Math.cos(pin.lat * Math.PI / 180);
    minLat = Math.min(minLat, pin.lat - latDelta);
    maxLat = Math.max(maxLat, pin.lat + latDelta);
    minLng = Math.min(minLng, pin.lng - lngDelta);
    maxLng = Math.max(maxLng, pin.lng + lngDelta);
  }

  // Clamp to valid range
  minLat = Math.max(-85, minLat);
  maxLat = Math.min(85, maxLat);
  minLng = Math.max(-180, minLng);
  maxLng = Math.min(180, maxLng);

  const zoom = 9;
  const tileSize = 512;

  // Get tile range
  const topLeft = lngLatToTile(minLng, maxLat, zoom);
  const bottomRight = lngLatToTile(maxLng, minLat, zoom);

  const xMin = Math.max(0, topLeft.x);
  const xMax = Math.min(Math.pow(2, zoom) - 1, bottomRight.x);
  const yMin = Math.max(0, topLeft.y);
  const yMax = Math.min(Math.pow(2, zoom) - 1, bottomRight.y);

  const tilesX = xMax - xMin + 1;
  const tilesY = yMax - yMin + 1;

  // Limit output image size
  const maxPixels = 2048;
  const rawWidth = tilesX * tileSize;
  const rawHeight = tilesY * tileSize;
  const scale = Math.min(1, maxPixels / Math.max(rawWidth, rawHeight));
  const outputWidth = Math.round(rawWidth * scale);
  const outputHeight = Math.round(rawHeight * scale);

  // Fetch all tiles in parallel
  const tilePromises = [];
  for (let ty = yMin; ty <= yMax; ty++) {
    for (let tx = xMin; tx <= xMax; tx++) {
      tilePromises.push(
        (async () => {
          const cacheKey = `${zoom}/${tx}/${ty}`;
          if (tileCache.has(cacheKey)) {
            return { tx, ty, data: tileCache.get(cacheKey) };
          }
          try {
            const result = await pmtiles.getZxy(zoom, tx, ty);
            if (!result || !result.data) return { tx, ty, data: null };
            const data = await decodeTilePng(result.data, tileSize);
            tileCache.set(cacheKey, data);
            return { tx, ty, data };
          } catch {
            return { tx, ty, data: null };
          }
        })()
      );
    }
  }

  const tiles = await Promise.all(tilePromises);

  // Build a lookup map for quick access
  const tileMap = new Map();
  for (const t of tiles) {
    if (t.data) {
      tileMap.set(`${t.tx},${t.ty}`, t.data);
    }
  }

  // Render output image
  const imageData = new Uint8ClampedArray(outputWidth * outputHeight * 4);

  for (let py = 0; py < outputHeight; py++) {
    for (let px = 0; px < outputWidth; px++) {
      // Map pixel to geographic coordinate
      const normX = (px + 0.5) / outputWidth;
      const normY = (py + 0.5) / outputHeight;

      // Top-left and bottom-right corners in global tile pixels
      const globalPxLeft = xMin * tileSize;
      const globalPxTop = yMin * tileSize;
      const globalPxRight = (xMax + 1) * tileSize;
      const globalPxBottom = (yMax + 1) * tileSize;

      const globalPx = globalPxLeft + normX * (globalPxRight - globalPxLeft);
      const globalPy = globalPxTop + normY * (globalPxBottom - globalPxTop);

      // Convert global pixel to lng/lat
      const n = Math.pow(2, zoom);
      const lng = (globalPx / (tileSize * n)) * 360 - 180;
      const latR = Math.atan(Math.sinh(Math.PI * (1 - 2 * globalPy / (tileSize * n))));
      const lat = latR * 180 / Math.PI;

      // Get the tile that contains this pixel
      const tileX = Math.floor(globalPx / tileSize);
      const tileY = Math.floor(globalPy / tileSize);
      const localPx = Math.floor(globalPx - tileX * tileSize);
      const localPy = Math.floor(globalPy - tileY * tileSize);

      const tileData = tileMap.get(`${tileX},${tileY}`);

      let elevation = null;
      if (tileData && localPx >= 0 && localPx < tileSize && localPy >= 0 && localPy < tileSize) {
        const idx = (localPy * tileSize + localPx) * 4;
        elevation = terrariumToElevation(tileData[idx], tileData[idx + 1], tileData[idx + 2]);
      }

      const outIdx = (py * outputWidth + px) * 4;

      // Check against each pin
      let isInAnyRadius = false;
      let isAboveAnyObserver = false;

      for (const pin of pins) {
        const radiusM = (pin.radius || defaultRadius) * 1000;
        const dist = haversineDistance(lat, lng, pin.lat, pin.lng);

        if (dist <= radiusM) {
          isInAnyRadius = true;
          const observerElevation = (pin.elevation || 0) + (pin.height || 10);
          if (elevation !== null && elevation > observerElevation) {
            isAboveAnyObserver = true;
          }
          break;
        }
      }

      if (!isInAnyRadius) {
        // Outside all radii: transparent
        imageData[outIdx] = 0;
        imageData[outIdx + 1] = 0;
        imageData[outIdx + 2] = 0;
        imageData[outIdx + 3] = 0;
      } else if (isAboveAnyObserver) {
        // Above observer's line of sight: semi-transparent gray
        imageData[outIdx] = 128;
        imageData[outIdx + 1] = 128;
        imageData[outIdx + 2] = 128;
        imageData[outIdx + 3] = 180;
      } else {
        // Visible: hypsometric color
        const color = elevation !== null ? elevationToColor(elevation) : [200, 200, 200];
        imageData[outIdx] = color[0];
        imageData[outIdx + 1] = color[1];
        imageData[outIdx + 2] = color[2];
        imageData[outIdx + 3] = 220;
      }
    }
  }

  // Convert bounding box corners to geographic coordinates for MapLibre
  const topLeftCoord = pixelToLngLat(xMin, yMin, 0, 0, zoom, tileSize);
  const topRightCoord = pixelToLngLat(xMax + 1, yMin, 0, 0, zoom, tileSize);
  const bottomRightCoord = pixelToLngLat(xMax + 1, yMax + 1, 0, 0, zoom, tileSize);
  const bottomLeftCoord = pixelToLngLat(xMin, yMax + 1, 0, 0, zoom, tileSize);

  return {
    imageData: imageData.buffer,
    width: outputWidth,
    height: outputHeight,
    coordinates: [
      [topLeftCoord.lng, topLeftCoord.lat],
      [topRightCoord.lng, topRightCoord.lat],
      [bottomRightCoord.lng, bottomRightCoord.lat],
      [bottomLeftCoord.lng, bottomLeftCoord.lat]
    ]
  };
}

// Message handler
self.onmessage = async (event) => {
  const { type, data, id } = event.data;

  switch (type) {
    case 'init': {
      try {
        pmtiles = new PMTiles(data.terrainUrl);
        // Test access
        await pmtiles.getMetadata();
        tileCache.clear();
        self.postMessage({ type: 'ready', id });
      } catch (err) {
        self.postMessage({ type: 'error', id, error: err.message });
      }
      break;
    }

    case 'get_elevation': {
      try {
        const elevation = await getElevationAt(data.lat, data.lng);
        self.postMessage({ type: 'elevation', id, data: { lat: data.lat, lng: data.lng, elevation } });
      } catch (err) {
        self.postMessage({ type: 'elevation', id, data: { lat: data.lat, lng: data.lng, elevation: null }, error: err.message });
      }
      break;
    }

    case 'compute_overlay': {
      try {
        const result = await computeOverlay(data.pins, data.defaultRadius);
        if (result) {
          self.postMessage(
            { type: 'overlay_result', id, data: result },
            [result.imageData]
          );
        } else {
          self.postMessage({ type: 'overlay_result', id, data: null });
        }
      } catch (err) {
        self.postMessage({ type: 'overlay_result', id, data: null, error: err.message });
      }
      break;
    }

    case 'clear_cache': {
      tileCache.clear();
      self.postMessage({ type: 'cache_cleared', id });
      break;
    }

    default:
      console.warn('Unknown message type:', type);
  }
};
