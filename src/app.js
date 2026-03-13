import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { createMapStyle } from './map-style.js';
import { initWorker, clearOverlay } from './elevation.js';
import { PinManager } from './pins.js';
import { MeasureTool } from './measure.js';

// Default settings
const DEFAULT_RADIUS_KM = 30;
const DEFAULT_HEIGHT_M = 10;
const UKRAINE_CENTER = [31.5, 49.0];
const UKRAINE_ZOOM = 6;

let map = null;
let pinManager = null;
let measureTool = null;
let is3DMode = false;
let contextMenuTarget = null; // 'map' | 'pin'
let pendingContextMenuLngLat = null;

/**
 * Shows a notification message.
 * @param {string} message
 * @param {'info'|'error'|'success'} type
 * @param {number} duration ms
 */
function showNotification(message, type = 'info', duration = 4000) {
  const container = document.getElementById('notifications');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `notification ${type}`;
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

/**
 * Shows the setup screen when data files are missing.
 */
function showSetupScreen(fileStatus) {
  const screen = document.getElementById('setup-screen');
  const toolbar = document.getElementById('toolbar');
  const panel = document.getElementById('pins-panel');
  const filesEl = document.getElementById('setup-missing-files');
  const dataDirEl = document.getElementById('setup-data-dir');

  if (screen) screen.classList.remove('hidden');
  if (toolbar) toolbar.classList.add('hidden');
  if (panel) panel.classList.add('hidden');

  if (filesEl) {
    filesEl.innerHTML = `
      <div class="${fileStatus.basemap ? 'setup-file-ok' : 'setup-file-missing'}">
        ukraine.pmtiles — базова векторна карта
        ${fileStatus.basemap ? '(знайдено)' : '(відсутній)'}
      </div>
      <div class="${fileStatus.terrain ? 'setup-file-ok' : 'setup-file-missing'}">
        ukraine-terrain.pmtiles — дані висот
        ${fileStatus.terrain ? '(знайдено)' : '(відсутній)'}
      </div>
    `;
  }

  if (dataDirEl) {
    dataDirEl.textContent = fileStatus.dataDir || 'data/';
  }

  const retryBtn = document.getElementById('setup-retry');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }
}

/**
 * Initializes the MapLibre GL map.
 */
function initMap(basemapUrl, terrainUrl, fontsUrl) {
  const style = createMapStyle({ basemapUrl, terrainUrl, fontsUrl });

  map = new maplibregl.Map({
    container: 'map',
    style,
    center: UKRAINE_CENTER,
    zoom: UKRAINE_ZOOM,
    maxZoom: 18,
    minZoom: 3,
    attributionControl: false
  });

  // Add navigation controls
  map.addControl(new maplibregl.NavigationControl(), 'top-left');
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 200, unit: 'metric' }), 'bottom-left');
  map.addControl(
    new maplibregl.AttributionControl({ compact: true }),
    'bottom-right'
  );

  return map;
}

/**
 * Enables 3D terrain mode.
 */
function enable3D() {
  if (!map) return;
  map.setTerrain({ source: 'terrain-src', exaggeration: 1.5 });
  map.setPitch(45);
  map.setBearing(0);
  is3DMode = true;

  const btn = document.getElementById('btn-toggle-3d');
  if (btn) {
    btn.classList.add('active');
    btn.title = 'Перемкнути в 2D режим';
  }
}

/**
 * Disables 3D terrain mode.
 */
function disable3D() {
  if (!map) return;
  map.setTerrain(null);
  map.setPitch(0);
  is3DMode = false;

  const btn = document.getElementById('btn-toggle-3d');
  if (btn) {
    btn.classList.remove('active');
    btn.title = 'Перемкнути в 3D режим';
  }
}

/**
 * Shows the context menu at the specified position.
 */
function showContextMenu(x, y, lngLat) {
  const menu = document.getElementById('context-menu');
  const items = document.getElementById('context-menu-items');
  if (!menu || !items) return;

  pendingContextMenuLngLat = lngLat;

  items.innerHTML = `
    <li class="context-menu-item" data-action="add-pin">
      <span>📍</span> Додати пін тут
    </li>
    <li class="context-menu-separator"></li>
    <li class="context-menu-item" data-action="cancel">
      <span>✕</span> Скасувати
    </li>
  `;

  // Position the menu, keeping it within viewport
  const menuWidth = 200;
  const menuHeight = 100;
  const vpWidth = window.innerWidth;
  const vpHeight = window.innerHeight;

  let left = x;
  let top = y;
  if (left + menuWidth > vpWidth) left = vpWidth - menuWidth - 8;
  if (top + menuHeight > vpHeight) top = vpHeight - menuHeight - 8;

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.classList.remove('hidden');
}

/**
 * Hides the context menu.
 */
function hideContextMenu() {
  const menu = document.getElementById('context-menu');
  if (menu) menu.classList.add('hidden');
  pendingContextMenuLngLat = null;
}

/**
 * Shows the Add Pin by Coordinates modal.
 */
function showCoordsModal(lat, lng) {
  const modal = document.getElementById('coords-modal');
  if (!modal) return;

  if (lat !== undefined) {
    const latInput = document.getElementById('input-lat');
    const lngInput = document.getElementById('input-lng');
    if (latInput) latInput.value = lat.toFixed(6);
    if (lngInput) lngInput.value = lng.toFixed(6);
  }

  modal.classList.remove('hidden');

  // Focus latitude input
  setTimeout(() => {
    const latInput = document.getElementById('input-lat');
    if (latInput) latInput.focus();
  }, 50);
}

/**
 * Hides the coords modal.
 */
function hideCoordsModal() {
  const modal = document.getElementById('coords-modal');
  if (modal) modal.classList.add('hidden');
}

/**
 * Submits pin from the coordinates modal.
 */
async function submitCoordsModal() {
  const latInput = document.getElementById('input-lat');
  const lngInput = document.getElementById('input-lng');
  const heightInput = document.getElementById('input-height');
  const radiusInput = document.getElementById('input-radius');

  const lat = parseFloat(latInput?.value);
  const lng = parseFloat(lngInput?.value);
  const height = parseFloat(heightInput?.value) || DEFAULT_HEIGHT_M;
  const radius = parseFloat(radiusInput?.value) || DEFAULT_RADIUS_KM;

  if (isNaN(lat) || isNaN(lng)) {
    showNotification('Введіть коректні координати', 'error');
    return;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    showNotification('Координати поза допустимим діапазоном', 'error');
    return;
  }

  hideCoordsModal();

  try {
    await pinManager.addPinByCoords(lat, lng, { height, radius });
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 9) });
    showNotification(`Пін додано: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'success');
  } catch (err) {
    showNotification('Помилка при додаванні піна: ' + err.message, 'error');
  }
}

/**
 * Wires up all UI event listeners.
 */
function initUI() {
  // 2D/3D toggle
  const btn3D = document.getElementById('btn-toggle-3d');
  if (btn3D) {
    btn3D.addEventListener('click', () => {
      if (is3DMode) {
        disable3D();
        showNotification('Режим 2D', 'info', 2000);
      } else {
        enable3D();
        showNotification('Режим 3D з перебільшенням рельєфу', 'info', 2000);
      }
    });
  }

  // Measure tool
  const btnMeasure = document.getElementById('btn-measure');
  if (btnMeasure) {
    btnMeasure.addEventListener('click', () => {
      if (measureTool.isActive()) {
        measureTool.deactivate();
        showNotification('Вимірювання завершено', 'info', 2000);
      } else {
        measureTool.activate();
        showNotification('Режим вимірювання: клацайте на карті для додавання точок', 'info', 3000);
      }
    });
  }

  // Measure clear button
  const btnMeasureClear = document.getElementById('btn-measure-clear');
  if (btnMeasureClear) {
    btnMeasureClear.addEventListener('click', () => {
      measureTool.clear();
    });
  }

  // Measure done button
  const btnMeasureDone = document.getElementById('btn-measure-done');
  if (btnMeasureDone) {
    btnMeasureDone.addEventListener('click', () => {
      measureTool.deactivate();
    });
  }

  // Add pin by coordinates button
  const btnAddCoords = document.getElementById('btn-add-coords');
  if (btnAddCoords) {
    btnAddCoords.addEventListener('click', () => {
      showCoordsModal();
    });
  }

  // Clear all pins button
  const btnClearPins = document.getElementById('btn-clear-pins');
  if (btnClearPins) {
    btnClearPins.addEventListener('click', () => {
      if (pinManager.getAllPins().length === 0) return;
      pinManager.clearAll();
      clearOverlay(map);
      showNotification('Всі піни видалено', 'info', 2000);
    });
  }

  // Modal close/cancel
  const modalClose = document.getElementById('modal-close');
  const modalCancel = document.getElementById('modal-cancel');
  if (modalClose) modalClose.addEventListener('click', hideCoordsModal);
  if (modalCancel) modalCancel.addEventListener('click', hideCoordsModal);

  // Modal submit
  const modalSubmit = document.getElementById('modal-submit');
  if (modalSubmit) {
    modalSubmit.addEventListener('click', submitCoordsModal);
  }

  // Modal: submit on Enter key
  const coordsModal = document.getElementById('coords-modal');
  if (coordsModal) {
    coordsModal.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitCoordsModal();
      if (e.key === 'Escape') hideCoordsModal();
    });

    // Close on overlay click
    coordsModal.addEventListener('click', (e) => {
      if (e.target === coordsModal) hideCoordsModal();
    });
  }

  // Context menu click handler
  const contextMenu = document.getElementById('context-menu');
  if (contextMenu) {
    contextMenu.addEventListener('click', async (e) => {
      const item = e.target.closest('[data-action]');
      if (!item) return;

      const action = item.dataset.action;
      hideContextMenu();

      if (action === 'add-pin' && pendingContextMenuLngLat) {
        const { lat, lng } = pendingContextMenuLngLat;
        try {
          await pinManager.addPin(lat, lng);
          showNotification(`Пін додано: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'success');
        } catch (err) {
          showNotification('Помилка при додаванні піна', 'error');
        }
      }
    });
  }

  // Close context menu on outside click
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('context-menu');
    if (menu && !menu.contains(e.target)) {
      hideContextMenu();
    }
  });

  // Prevent context menu from showing browser default
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
}

/**
 * Main entry point.
 */
async function main() {
  // Check if Electron API is available
  if (!window.electronAPI) {
    console.error('electronAPI not available — not running in Electron?');
    showNotification('Помилка: electronAPI недоступний', 'error');
    return;
  }

  // Get the local server port
  const port = await window.electronAPI.getDataPort();
  if (!port) {
    showNotification('Помилка: не вдалося отримати порт сервера', 'error');
    return;
  }

  const baseUrl = `http://127.0.0.1:${port}`;
  const basemapUrl = `pmtiles://${baseUrl}/data/ukraine.pmtiles`;
  const terrainUrl = `pmtiles://${baseUrl}/data/ukraine-terrain.pmtiles`;
  const fontsUrl = `${baseUrl}/fonts`;

  // Register PMTiles protocol
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile.bind(protocol));

  // Check if data files exist
  const fileStatus = await window.electronAPI.checkDataFiles();

  if (!fileStatus.allPresent) {
    showSetupScreen(fileStatus);
    return;
  }

  // Show UI
  const toolbar = document.getElementById('toolbar');
  const panel = document.getElementById('pins-panel');
  if (toolbar) toolbar.classList.remove('hidden');
  if (panel) panel.classList.remove('hidden');

  // Initialize map
  initMap(basemapUrl, terrainUrl, fontsUrl);

  map.on('error', (e) => {
    // Filter out tile loading errors (common during pan/zoom)
    if (e.error && e.error.status === 404) return;
    console.warn('Map error:', e.error);
  });

  map.on('load', async () => {
    // Initialize elevation worker
    try {
      await initWorker(terrainUrl);
    } catch (err) {
      console.warn('Terrain worker initialization failed:', err.message);
      showNotification(
        'Увага: не вдалося завантажити дані висот. Перевірте файл ukraine-terrain.pmtiles',
        'error',
        8000
      );
    }

    // Initialize tools
    pinManager = new PinManager(map, DEFAULT_RADIUS_KM);
    measureTool = new MeasureTool(map);

    // Map right-click: show context menu
    map.on('contextmenu', (e) => {
      // Only show map context menu if measure tool is not active
      if (measureTool.isActive()) return;

      e.preventDefault();
      const { x, y } = e.point;
      const lngLat = e.lngLat;
      showContextMenu(x, y, lngLat);
    });

    // Wire up UI
    initUI();

    // Expose to window for debugging
    window.map = map;
    window.pinManager = pinManager;
    window.measureTool = measureTool;
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
});
