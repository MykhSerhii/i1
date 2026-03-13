import maplibregl from 'maplibre-gl';
import { getElevationAt, updateOverlay } from './elevation.js';
import { circleToGeoJSON } from './geo-utils.js';

const DEFAULT_RADIUS_KM = 30;
const DEFAULT_HEIGHT_M = 10;

let pinIdCounter = 0;

/**
 * Manages map pins with elevation-based visibility overlays.
 */
export class PinManager {
  constructor(map, defaultRadius = DEFAULT_RADIUS_KM) {
    this.map = map;
    this.defaultRadius = defaultRadius;
    this.pins = new Map();
    this._initRadiusLayer();
  }

  _initRadiusLayer() {
    if (!this.map.getSource('radius-circles')) {
      this.map.addSource('radius-circles', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      this.map.addLayer({
        id: 'radius-circles-fill',
        type: 'fill',
        source: 'radius-circles',
        paint: {
          'fill-color': 'rgba(66, 133, 244, 0.04)',
          'fill-outline-color': 'rgba(66, 133, 244, 0.5)'
        }
      });

      this.map.addLayer({
        id: 'radius-circles-line',
        type: 'line',
        source: 'radius-circles',
        paint: {
          'line-color': 'rgba(66, 133, 244, 0.7)',
          'line-width': 2,
          'line-dasharray': [4, 3]
        }
      });
    }
  }

  _updateRadiusLayer() {
    const features = Array.from(this.pins.values()).map(pin => {
      const radiusM = (pin.radius || this.defaultRadius) * 1000;
      return circleToGeoJSON(pin.lat, pin.lng, radiusM);
    });

    const source = this.map.getSource('radius-circles');
    if (source) {
      source.setData({ type: 'FeatureCollection', features });
    }
  }

  _updatePinsPanel() {
    const listEl = document.getElementById('pins-list');
    const countEl = document.getElementById('pins-count');
    if (!listEl) return;

    const pins = Array.from(this.pins.values());

    if (countEl) countEl.textContent = pins.length;

    if (pins.length === 0) {
      listEl.innerHTML = `
        <div class="pins-empty">
          <p>Немає активних пінів</p>
          <p class="hint">Клацніть правою кнопкою миші на карті, щоб додати пін</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = pins.map(pin => this._renderPinItem(pin)).join('');

    // Bind events for each pin item
    pins.forEach(pin => {
      const heightInput = document.getElementById(`pin-height-${pin.id}`);
      const radiusInput = document.getElementById(`pin-radius-${pin.id}`);
      const deleteBtn = document.getElementById(`pin-delete-${pin.id}`);

      if (heightInput) {
        heightInput.addEventListener('change', () => {
          const val = parseFloat(heightInput.value);
          if (!isNaN(val) && val >= 0) {
            this.updatePinHeight(pin.id, val);
          }
        });
      }

      if (radiusInput) {
        radiusInput.addEventListener('change', () => {
          const val = parseFloat(radiusInput.value);
          if (!isNaN(val) && val >= 1) {
            this.updatePinRadius(pin.id, val);
          }
        });
      }

      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          this.removePin(pin.id);
        });
      }
    });
  }

  _renderPinItem(pin) {
    const latStr = pin.lat.toFixed(5);
    const lngStr = pin.lng.toFixed(5);
    const elevStr = pin.elevation !== null ? `${Math.round(pin.elevation)} м` : 'н/д';

    return `
      <div class="pin-item" id="pin-item-${pin.id}">
        <div class="pin-item-header">
          <div class="pin-item-icon">${pin.num}</div>
          <div class="pin-item-coords">
            <div class="pin-item-name">Пін ${pin.num}</div>
            ${latStr}°, ${lngStr}°
          </div>
          <button class="pin-item-delete" id="pin-delete-${pin.id}" title="Видалити пін">✕</button>
        </div>
        <div class="pin-item-controls">
          <div class="pin-control-row">
            <span class="pin-control-label">Висота ост.</span>
            <input type="number" class="pin-control-input" id="pin-height-${pin.id}"
              value="${pin.height}" min="0" max="9999" step="1">
            <span class="pin-control-unit">м</span>
          </div>
          <div class="pin-control-row">
            <span class="pin-control-label">Радіус</span>
            <input type="number" class="pin-control-input" id="pin-radius-${pin.id}"
              value="${pin.radius}" min="1" max="500" step="1">
            <span class="pin-control-unit">км</span>
          </div>
        </div>
        <div class="pin-elevation-info">
          Висота рельєфу: ${elevStr}
          &nbsp;·&nbsp; Спостерігач: ${Math.round((pin.elevation || 0) + pin.height)} м
        </div>
      </div>
    `;
  }

  _createMarkerElement(num) {
    const el = document.createElement('div');
    el.className = 'custom-pin-marker';
    el.innerHTML = `
      <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow-${num}" x="-30%" y="-20%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.5)"/>
          </filter>
        </defs>
        <path
          d="M16 0 C7.163 0 0 7.163 0 16 C0 24 8 33 16 40 C24 33 32 24 32 16 C32 7.163 24.837 0 16 0Z"
          fill="#4285f4"
          filter="url(#shadow-${num})"
        />
        <circle cx="16" cy="15" r="8" fill="white" opacity="0.95"/>
        <text x="16" y="19" font-family="Arial,sans-serif" font-size="10" font-weight="700"
          fill="#4285f4" text-anchor="middle">${num}</text>
      </svg>
    `;
    return el;
  }

  async addPin(lat, lng, options = {}) {
    const num = this.pins.size + 1;
    const id = `pin-${++pinIdCounter}`;
    const height = options.height !== undefined ? options.height : DEFAULT_HEIGHT_M;
    const radius = options.radius !== undefined ? options.radius : this.defaultRadius;

    // Get terrain elevation
    let elevation = null;
    try {
      elevation = await getElevationAt(lat, lng);
    } catch {
      elevation = null;
    }

    const pin = {
      id,
      num,
      lat,
      lng,
      elevation,
      height,
      radius,
      marker: null
    };

    // Create marker element
    const el = this._createMarkerElement(num);

    // Right-click to delete
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._showPinContextMenu(e, id);
    });

    // Left click: fly to pin and show info
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.map.flyTo({ center: [lng, lat], zoom: Math.max(this.map.getZoom(), 10) });
    });

    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([lng, lat])
      .addTo(this.map);

    pin.marker = marker;
    this.pins.set(id, pin);

    this._updateRadiusLayer();
    this._updatePinsPanel();
    updateOverlay(this.map, this.getAllPins(), this.defaultRadius);

    return id;
  }

  async addPinByCoords(lat, lng, options = {}) {
    return this.addPin(lat, lng, options);
  }

  removePin(id) {
    const pin = this.pins.get(id);
    if (!pin) return;

    pin.marker.remove();
    this.pins.delete(id);

    // Renumber remaining pins
    let num = 1;
    for (const p of this.pins.values()) {
      p.num = num++;
      // Update the marker element
      const el = p.marker.getElement();
      if (el) {
        el.innerHTML = `
          <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="shadow-${p.num}" x="-30%" y="-20%" width="160%" height="160%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.5)"/>
              </filter>
            </defs>
            <path
              d="M16 0 C7.163 0 0 7.163 0 16 C0 24 8 33 16 40 C24 33 32 24 32 16 C32 7.163 24.837 0 16 0Z"
              fill="#4285f4"
              filter="url(#shadow-${p.num})"
            />
            <circle cx="16" cy="15" r="8" fill="white" opacity="0.95"/>
            <text x="16" y="19" font-family="Arial,sans-serif" font-size="10" font-weight="700"
              fill="#4285f4" text-anchor="middle">${p.num}</text>
          </svg>
        `;
      }
    }

    this._updateRadiusLayer();
    this._updatePinsPanel();
    updateOverlay(this.map, this.getAllPins(), this.defaultRadius);
  }

  updatePinHeight(id, height) {
    const pin = this.pins.get(id);
    if (!pin) return;
    pin.height = height;
    this._updatePinsPanel();
    updateOverlay(this.map, this.getAllPins(), this.defaultRadius);
  }

  updatePinRadius(id, radius) {
    const pin = this.pins.get(id);
    if (!pin) return;
    pin.radius = radius;
    this._updateRadiusLayer();
    this._updatePinsPanel();
    updateOverlay(this.map, this.getAllPins(), this.defaultRadius);
  }

  getPin(id) {
    return this.pins.get(id);
  }

  getAllPins() {
    return Array.from(this.pins.values()).map(pin => ({
      id: pin.id,
      lat: pin.lat,
      lng: pin.lng,
      elevation: pin.elevation,
      height: pin.height,
      radius: pin.radius
    }));
  }

  clearAll() {
    for (const pin of this.pins.values()) {
      pin.marker.remove();
    }
    this.pins.clear();
    this._updateRadiusLayer();
    this._updatePinsPanel();
    updateOverlay(this.map, [], this.defaultRadius);
  }

  _showPinContextMenu(event, pinId) {
    const menu = document.getElementById('context-menu');
    const items = document.getElementById('context-menu-items');
    if (!menu || !items) return;

    items.innerHTML = `
      <li class="context-menu-item danger" data-action="delete-pin" data-pin-id="${pinId}">
        <span>🗑</span> Видалити пін
      </li>
    `;

    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    menu.classList.remove('hidden');

    const onAction = (e) => {
      const item = e.target.closest('[data-action]');
      if (!item) return;
      if (item.dataset.action === 'delete-pin') {
        this.removePin(item.dataset.pinId);
      }
      menu.classList.add('hidden');
      menu.removeEventListener('click', onAction);
    };

    menu.addEventListener('click', onAction);
  }
}
