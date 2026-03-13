/**
 * Generates a MapLibre GL style for Ukraine using OpenMapTiles schema (Protomaps).
 * @param {Object} params
 * @param {string} params.basemapUrl - PMTiles URL for vector basemap
 * @param {string} params.terrainUrl - PMTiles URL for terrain raster-dem
 * @param {string} params.fontsUrl - Base URL for glyph fonts
 * @returns {Object} MapLibre GL style object
 */
export function createMapStyle({ basemapUrl, terrainUrl, fontsUrl }) {
  return {
    version: 8,
    glyphs: `${fontsUrl}/{fontstack}/{range}.pbf`,
    sources: {
      basemap: {
        type: 'vector',
        url: basemapUrl,
        attribution: '© OpenStreetMap contributors, Protomaps'
      },
      'terrain-src': {
        type: 'raster-dem',
        url: terrainUrl,
        encoding: 'terrarium',
        tileSize: 512
      }
    },
    terrain: null, // will be set in 3D mode
    layers: [
      // 1. Background
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#f5f3ef'
        }
      },

      // 2. Water fill
      {
        id: 'water',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'water',
        paint: {
          'fill-color': '#a8c8e8',
          'fill-opacity': 1
        }
      },

      // 3. Landcover grass
      {
        id: 'landcover-grass',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'landcover',
        filter: ['in', 'class', 'grass', 'meadow', 'farmland'],
        paint: {
          'fill-color': '#daf0c0',
          'fill-opacity': 0.8
        }
      },

      // 4. Landcover forest
      {
        id: 'landcover-forest',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'landcover',
        filter: ['in', 'class', 'wood', 'forest'],
        paint: {
          'fill-color': '#b8d4a0',
          'fill-opacity': 0.7
        }
      },

      // 5. Landuse residential
      {
        id: 'landuse-residential',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'landuse',
        filter: ['==', 'class', 'residential'],
        paint: {
          'fill-color': '#e8e4dc',
          'fill-opacity': 0.7
        }
      },

      // 6. Waterway lines
      {
        id: 'waterway',
        type: 'line',
        source: 'basemap',
        'source-layer': 'waterway',
        paint: {
          'line-color': '#7ab4d8',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            8, 0.5,
            12, 1.5,
            16, 3
          ]
        }
      },

      // 7. Hillshade
      {
        id: 'hillshade',
        type: 'hillshade',
        source: 'terrain-src',
        paint: {
          'hillshade-exaggeration': 0.35,
          'hillshade-illumination-direction': 315,
          'hillshade-shadow-color': 'rgba(0, 0, 0, 0.35)',
          'hillshade-highlight-color': 'rgba(255, 255, 255, 0.5)'
        }
      },

      // 8. Roads - service
      {
        id: 'road-service',
        type: 'line',
        source: 'basemap',
        'source-layer': 'transportation',
        minzoom: 13,
        filter: ['==', 'class', 'service'],
        paint: {
          'line-color': '#ffffff',
          'line-width': 1.5
        }
      },

      // 9. Roads - minor
      {
        id: 'road-minor',
        type: 'line',
        source: 'basemap',
        'source-layer': 'transportation',
        minzoom: 11,
        filter: ['in', 'class', 'minor', 'path', 'track'],
        paint: {
          'line-color': '#ffffff',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            11, 0.8,
            14, 2,
            18, 4
          ]
        }
      },

      // 10. Roads - secondary
      {
        id: 'road-secondary',
        type: 'line',
        source: 'basemap',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'secondary', 'tertiary'],
        paint: {
          'line-color': '#ffffff',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            8, 0.5,
            12, 2,
            16, 5
          ]
        }
      },

      // 11. Roads - primary
      {
        id: 'road-primary',
        type: 'line',
        source: 'basemap',
        'source-layer': 'transportation',
        filter: ['==', 'class', 'primary'],
        paint: {
          'line-color': '#f9d84b',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            6, 0.8,
            10, 2.5,
            16, 7
          ]
        }
      },

      // 12. Roads - motorway
      {
        id: 'road-motorway',
        type: 'line',
        source: 'basemap',
        'source-layer': 'transportation',
        minzoom: 6,
        filter: ['in', 'class', 'motorway', 'trunk'],
        paint: {
          'line-color': '#e8a020',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            6, 1,
            10, 3,
            16, 9
          ]
        }
      },

      // 13. Country boundary
      {
        id: 'boundary-country',
        type: 'line',
        source: 'basemap',
        'source-layer': 'boundary',
        filter: ['==', 'admin_level', 2],
        paint: {
          'line-color': '#9b7040',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            3, 1,
            8, 2.5
          ],
          'line-dasharray': [4, 3]
        }
      },

      // 14. Region/Oblast boundary
      {
        id: 'boundary-region',
        type: 'line',
        source: 'basemap',
        'source-layer': 'boundary',
        minzoom: 6,
        filter: ['==', 'admin_level', 4],
        paint: {
          'line-color': '#aaaaaa',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            6, 0.5,
            10, 1.5
          ],
          'line-dasharray': [3, 3]
        }
      },

      // 15. City labels
      {
        id: 'place-city',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'place',
        filter: ['in', 'class', 'city', 'capital'],
        layout: {
          'text-field': ['coalesce', ['get', 'name:uk'], ['get', 'name']],
          'text-font': ['Noto Sans Bold'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            5, 10,
            8, 13,
            12, 16
          ],
          'text-anchor': 'center',
          'text-max-width': 10
        },
        paint: {
          'text-color': '#1a1a2e',
          'text-halo-color': 'rgba(255, 255, 255, 0.85)',
          'text-halo-width': 1.5
        }
      },

      // 16. Town labels
      {
        id: 'place-town',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'place',
        minzoom: 8,
        filter: ['==', 'class', 'town'],
        layout: {
          'text-field': ['coalesce', ['get', 'name:uk'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            8, 10,
            12, 13
          ],
          'text-anchor': 'center',
          'text-max-width': 8
        },
        paint: {
          'text-color': '#333344',
          'text-halo-color': 'rgba(255, 255, 255, 0.8)',
          'text-halo-width': 1.2
        }
      },

      // 17. Village labels
      {
        id: 'place-village',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'place',
        minzoom: 11,
        filter: ['in', 'class', 'village', 'hamlet', 'suburb'],
        layout: {
          'text-field': ['coalesce', ['get', 'name:uk'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            11, 9,
            14, 12
          ],
          'text-anchor': 'center',
          'text-max-width': 6
        },
        paint: {
          'text-color': '#444455',
          'text-halo-color': 'rgba(255, 255, 255, 0.75)',
          'text-halo-width': 1
        }
      }
    ]
  };
}
