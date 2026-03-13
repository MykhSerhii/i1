let workerInstance = null;
let pendingRequests = new Map();
let requestIdCounter = 0;
let workerReady = false;
let pendingQueue = [];

/**
 * Creates a unique request ID.
 */
function nextId() {
  return ++requestIdCounter;
}

/**
 * Sends a message to the worker and returns a Promise for the response.
 */
function sendToWorker(type, data) {
  return new Promise((resolve, reject) => {
    const id = nextId();

    const send = () => {
      pendingRequests.set(id, { resolve, reject });
      workerInstance.postMessage({ type, data, id });
    };

    if (workerReady) {
      send();
    } else {
      pendingQueue.push(send);
    }
  });
}

/**
 * Initializes the terrain Web Worker.
 * @param {string} terrainUrl - URL of the terrain PMTiles file
 * @returns {Promise<void>}
 */
export function initWorker(terrainUrl) {
  return new Promise((resolve, reject) => {
    try {
      workerInstance = new Worker(new URL('./worker-bundle.js', import.meta.url));
    } catch (err) {
      reject(new Error('Failed to create terrain worker: ' + err.message));
      return;
    }

    workerInstance.onmessage = (event) => {
      const { type, id, data, error } = event.data;

      if (type === 'ready') {
        workerReady = true;
        // Flush queued messages
        for (const send of pendingQueue) {
          send();
        }
        pendingQueue = [];
        resolve();
        return;
      }

      if (type === 'error' && !id) {
        reject(new Error(error));
        return;
      }

      if (id && pendingRequests.has(id)) {
        const { resolve, reject } = pendingRequests.get(id);
        pendingRequests.delete(id);
        if (error) {
          reject(new Error(error));
        } else {
          resolve(data);
        }
      }
    };

    workerInstance.onerror = (err) => {
      const msg = err.message || 'Worker error';
      if (!workerReady) {
        reject(new Error(msg));
      }
    };

    // Send init message — response will be 'ready'
    const id = nextId();
    pendingRequests.set(id, {
      resolve: () => {},
      reject
    });
    workerInstance.postMessage({ type: 'init', data: { terrainUrl }, id });
  });
}

/**
 * Queries the terrain elevation at a specific location.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<number|null>} Elevation in meters, or null if unavailable
 */
export async function getElevationAt(lat, lng) {
  if (!workerInstance) return null;
  try {
    const result = await sendToWorker('get_elevation', { lat, lng });
    return result ? result.elevation : null;
  } catch {
    return null;
  }
}

let overlayUpdateTimeout = null;

/**
 * Updates the elevation overlay on the map.
 * Debounced to avoid excessive computation.
 * @param {maplibregl.Map} map
 * @param {Array} pins - Array of pin objects
 * @param {number} defaultRadius - Default radius in km
 */
export function updateOverlay(map, pins, defaultRadius) {
  if (overlayUpdateTimeout) {
    clearTimeout(overlayUpdateTimeout);
  }

  overlayUpdateTimeout = setTimeout(async () => {
    await _doUpdateOverlay(map, pins, defaultRadius);
  }, 300);
}

async function _doUpdateOverlay(map, pins, defaultRadius) {
  if (!workerInstance || !workerReady) return;

  if (pins.length === 0) {
    clearOverlay(map);
    return;
  }

  // Show loading indicator
  const loadingEl = document.getElementById('overlay-loading');
  if (loadingEl) loadingEl.classList.remove('hidden');

  try {
    const result = await sendToWorker('compute_overlay', { pins, defaultRadius });

    if (!result) {
      clearOverlay(map);
      return;
    }

    const { imageData, width, height, coordinates } = result;

    // Convert ArrayBuffer back to Uint8ClampedArray
    const pixels = new Uint8ClampedArray(imageData);

    // Create ImageData
    const imgData = new ImageData(pixels, width, height);

    // Draw to OffscreenCanvas and get data URL
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imgData, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');

    // Update or create the image source
    if (map.getSource('elevation-overlay')) {
      map.getSource('elevation-overlay').updateImage({ url: dataUrl, coordinates });
    } else {
      map.addSource('elevation-overlay', {
        type: 'image',
        url: dataUrl,
        coordinates
      });

      // Find the first label layer to insert the overlay below labels
      const labelLayerId = findFirstLabelLayer(map);

      map.addLayer(
        {
          id: 'elevation-overlay-layer',
          type: 'raster',
          source: 'elevation-overlay',
          paint: {
            'raster-opacity': 1,
            'raster-fade-duration': 200
          }
        },
        labelLayerId
      );
    }
  } catch (err) {
    console.error('Overlay update failed:', err);
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
  }
}

/**
 * Finds the ID of the first symbol/label layer in the map style.
 */
function findFirstLabelLayer(map) {
  const layers = map.getStyle().layers;
  for (const layer of layers) {
    if (layer.type === 'symbol') {
      return layer.id;
    }
  }
  return undefined;
}

/**
 * Removes the elevation overlay from the map.
 * @param {maplibregl.Map} map
 */
export function clearOverlay(map) {
  if (map.getLayer('elevation-overlay-layer')) {
    map.removeLayer('elevation-overlay-layer');
  }
  if (map.getSource('elevation-overlay')) {
    map.removeSource('elevation-overlay');
  }
}

/**
 * Terminates the worker.
 */
export function terminateWorker() {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
    workerReady = false;
  }
}
