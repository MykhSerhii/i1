import { haversineDistance } from './geo-utils.js';

const SOURCE_LINE = 'measure-line';
const SOURCE_POINTS = 'measure-points';
const LAYER_LINE = 'measure-line-layer';
const LAYER_POINTS = 'measure-points-layer';

/**
 * Distance measurement tool.
 * Click to add measurement points; displays total distance.
 */
export class MeasureTool {
  constructor(map) {
    this.map = map;
    this.active = false;
    this.points = [];
    this._clickHandler = this._onClick.bind(this);
    this._initLayers();
  }

  _initLayers() {
    // Line source and layer
    if (!this.map.getSource(SOURCE_LINE)) {
      this.map.addSource(SOURCE_LINE, {
        type: 'geojson',
        data: this._buildLineGeoJSON()
      });

      this.map.addLayer({
        id: LAYER_LINE,
        type: 'line',
        source: SOURCE_LINE,
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': '#ffdd00',
          'line-width': 2.5,
          'line-dasharray': [2, 1.5]
        }
      });
    }

    // Points source and layer
    if (!this.map.getSource(SOURCE_POINTS)) {
      this.map.addSource(SOURCE_POINTS, {
        type: 'geojson',
        data: this._buildPointsGeoJSON()
      });

      this.map.addLayer({
        id: LAYER_POINTS,
        type: 'circle',
        source: SOURCE_POINTS,
        paint: {
          'circle-radius': 5,
          'circle-color': '#ffffff',
          'circle-stroke-color': '#ffdd00',
          'circle-stroke-width': 2
        }
      });
    }
  }

  _buildLineGeoJSON() {
    if (this.points.length < 2) {
      return { type: 'FeatureCollection', features: [] };
    }
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: this.points.map(p => [p.lng, p.lat])
        },
        properties: {}
      }]
    };
  }

  _buildPointsGeoJSON() {
    return {
      type: 'FeatureCollection',
      features: this.points.map((p, i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { index: i }
      }))
    };
  }

  _updateSources() {
    const lineSource = this.map.getSource(SOURCE_LINE);
    const pointsSource = this.map.getSource(SOURCE_POINTS);
    if (lineSource) lineSource.setData(this._buildLineGeoJSON());
    if (pointsSource) pointsSource.setData(this._buildPointsGeoJSON());
  }

  _computeTotalDistance() {
    if (this.points.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < this.points.length; i++) {
      const prev = this.points[i - 1];
      const curr = this.points[i];
      total += haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    }
    return total;
  }

  _formatDistance(meters) {
    if (meters < 1000) {
      return `${Math.round(meters)} м`;
    }
    return `${(meters / 1000).toFixed(2)} км`;
  }

  _updateDisplay() {
    const display = document.getElementById('distance-display');
    const valueEl = document.getElementById('distance-value');

    if (!display || !valueEl) return;

    if (!this.active) {
      display.classList.add('hidden');
      return;
    }

    display.classList.remove('hidden');

    const total = this._computeTotalDistance();
    valueEl.textContent = this._formatDistance(total);
  }

  _onClick(e) {
    if (!this.active) return;
    const { lat, lng } = e.lngLat;
    this.points.push({ lat, lng });
    this._updateSources();
    this._updateDisplay();
  }

  /**
   * Activates the measurement tool.
   */
  activate() {
    if (this.active) return;
    this.active = true;
    this.points = [];
    document.body.classList.add('measure-active');
    this.map.on('click', this._clickHandler);
    this._updateDisplay();

    const btn = document.getElementById('btn-measure');
    if (btn) btn.classList.add('active');
  }

  /**
   * Deactivates the measurement tool and clears all measurements.
   */
  deactivate() {
    if (!this.active) return;
    this.active = false;
    this.points = [];
    document.body.classList.remove('measure-active');
    this.map.off('click', this._clickHandler);
    this._updateSources();
    this._updateDisplay();

    const btn = document.getElementById('btn-measure');
    if (btn) btn.classList.remove('active');
  }

  /**
   * Clears measurement points without deactivating.
   */
  clear() {
    this.points = [];
    this._updateSources();
    this._updateDisplay();
  }

  /**
   * Returns whether the tool is currently active.
   * @returns {boolean}
   */
  isActive() {
    return this.active;
  }
}
