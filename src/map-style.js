/**
 * MapLibre GL style for Protomaps basemap schema.
 * Layers: earth, water, landcover, landuse, roads, boundaries, places, buildings, pois, natural
 */
export function createStyle({ basemapUrl, terrainUrl, fontsUrl }) {
  return {
    version: 8,
    name: 'Ukraine Topo',
    glyphs: `${fontsUrl}/{fontstack}/{range}.pbf`,
    sprite: '',
    sources: {
      basemap: {
        type: 'vector',
        url: basemapUrl,
        maxzoom: 14,
      },
      'terrain-src': {
        type: 'raster-dem',
        url: terrainUrl,
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 12,
      },
    },
    layers: [
      // Background = land color. Any gap in the earth polygon will look
      // like land (beige), not water (blue) — prevents false "water" artifacts.
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#eae6dd' },
      },

      // Land fill (same color as background — earth polygons confirm coverage)
      {
        id: 'earth',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'earth',
        paint: { 'fill-color': '#eae6dd' },
      },

      // Water bodies
      {
        id: 'water',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'water',
        filter: ['!=', 'kind', 'river'],   // exclude rivers — handled separately below
        paint: { 'fill-color': '#a8ccdf' },
      },

      // River polygons — only at zoom 14+ where OSM data is detailed enough
      {
        id: 'water-river',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'water',
        filter: ['==', 'kind', 'river'],
        minzoom: 14,
        paint: { 'fill-color': '#a8ccdf' },
      },

      // Rivers as lines at zoom < 14 (avoids badly-shaped OSM river polygons)
      {
        id: 'waterway-river',
        type: 'line',
        source: 'basemap',
        'source-layer': 'water',
        filter: ['==', 'kind', 'river'],
        maxzoom: 14,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#a8ccdf',
          'line-width': ['interpolate', ['linear'], ['zoom'],
            6, 1,
            8, 2,
            10, 4,
            12, 8,
            14, 14,
          ],
        },
      },

      // Water outline (thin shoreline stroke for cleaner edges)
      {
        id: 'water-outline',
        type: 'line',
        source: 'basemap',
        'source-layer': 'water',
        filter: ['!in', 'kind', 'river', 'stream', 'canal', 'drain', 'ditch'],
        paint: {
          'line-color': '#8ab8d0',
          'line-width': 0.5,
          'line-opacity': 0.6,
        },
      },

      // Small waterways as lines (streams, canals only — NOT rivers,
      // because wide rivers are already fill polygons and drawing a
      // centerline on top creates a straight-edge artifact at tile seams)
      {
        id: 'waterway-small',
        type: 'line',
        source: 'basemap',
        'source-layer': 'water',
        filter: ['in', 'kind', 'stream', 'canal', 'drain', 'ditch'],
        minzoom: 11,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#a8ccdf',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 16, 2],
        },
      },

      // Forests / woods
      {
        id: 'landcover-forest',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'landcover',
        filter: ['in', 'kind', 'forest', 'wood'],
        paint: { 'fill-color': '#b8d4a0', 'fill-opacity': 0.75 },
      },

      // Grass / farmland / scrub
      {
        id: 'landcover-grass',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'landcover',
        filter: ['in', 'kind', 'grass', 'scrub', 'farmland', 'crop'],
        paint: { 'fill-color': '#d8e8c0', 'fill-opacity': 0.6 },
      },

      // Residential areas — clearly visible grey blocks
      {
        id: 'landuse-residential',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'landuse',
        filter: ['in', 'kind', 'residential', 'suburb', 'neighbourhood'],
        paint: { 'fill-color': '#dedad2', 'fill-opacity': 0.8 },
      },

      // Industrial / commercial
      {
        id: 'landuse-industrial',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'landuse',
        filter: ['in', 'kind', 'industrial', 'commercial', 'retail'],
        paint: { 'fill-color': '#d4cec8', 'fill-opacity': 0.7 },
      },

      // Parks / recreation
      {
        id: 'landuse-park',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'landuse',
        filter: ['in', 'kind', 'park', 'garden', 'recreation_ground', 'golf_course'],
        paint: { 'fill-color': '#c4dca8', 'fill-opacity': 0.7 },
      },

      // Hillshade — terrain shading
      {
        id: 'hillshade',
        type: 'hillshade',
        source: 'terrain-src',
        paint: {
          'hillshade-illumination-direction': 315,
          'hillshade-exaggeration': 0.4,
          'hillshade-shadow-color': '#3a3530',
          'hillshade-highlight-color': '#ffffff',
        },
      },

      // ── ROADS ─────────────────────────────────────────────

      // Road casings (outlines) for main roads
      {
        id: 'road-primary-casing',
        type: 'line',
        source: 'basemap',
        'source-layer': 'roads',
        filter: ['in', 'kind', 'primary', 'secondary'],
        minzoom: 10,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#c8a060',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 9],
          'line-gap-width': 0,
        },
      },

      {
        id: 'road-motorway-casing',
        type: 'line',
        source: 'basemap',
        'source-layer': 'roads',
        filter: ['in', 'kind', 'motorway', 'trunk'],
        minzoom: 6,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#b87820',
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 3, 14, 13],
        },
      },

      // Service / path / track
      {
        id: 'road-service',
        type: 'line',
        source: 'basemap',
        'source-layer': 'roads',
        filter: ['in', 'kind', 'service', 'track', 'path', 'footway', 'cycleway'],
        minzoom: 13,
        paint: {
          'line-color': '#f8f4ee',
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 16, 2],
        },
      },

      // Minor roads
      {
        id: 'road-minor',
        type: 'line',
        source: 'basemap',
        'source-layer': 'roads',
        filter: ['in', 'kind', 'minor_road', 'tertiary', 'unclassified', 'residential'],
        minzoom: 12,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 15, 4],
        },
      },

      // Secondary roads
      {
        id: 'road-secondary',
        type: 'line',
        source: 'basemap',
        'source-layer': 'roads',
        filter: ['==', 'kind', 'secondary'],
        minzoom: 9,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#fdeea0',
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.5, 14, 6],
        },
      },

      // Primary roads
      {
        id: 'road-primary',
        type: 'line',
        source: 'basemap',
        'source-layer': 'roads',
        filter: ['==', 'kind', 'primary'],
        minzoom: 7,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#fbd360',
          'line-width': ['interpolate', ['linear'], ['zoom'], 7, 2, 14, 8],
        },
      },

      // Motorway / trunk
      {
        id: 'road-motorway',
        type: 'line',
        source: 'basemap',
        'source-layer': 'roads',
        filter: ['in', 'kind', 'motorway', 'trunk'],
        minzoom: 6,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#f0a030',
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2, 14, 10],
        },
      },

      // ── BUILDINGS ─────────────────────────────────────────

      // Building fill (zoom 14+)
      {
        id: 'building-fill',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'buildings',
        minzoom: 14,
        paint: {
          'fill-color': [
            'interpolate', ['linear'], ['zoom'],
            14, '#d0cac0',
            17, '#c4bcb0',
          ],
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.6, 15, 0.9],
          'fill-outline-color': '#b0a898',
        },
      },

      // Building outline for more detail at high zoom
      {
        id: 'building-outline',
        type: 'line',
        source: 'basemap',
        'source-layer': 'buildings',
        minzoom: 15,
        paint: {
          'line-color': '#b0a898',
          'line-width': 0.5,
        },
      },

      // ── BOUNDARIES ────────────────────────────────────────

      // Country borders
      {
        id: 'boundary-country',
        type: 'line',
        source: 'basemap',
        'source-layer': 'boundaries',
        filter: ['==', 'kind', 'country'],
        paint: {
          'line-color': '#8a6020',
          'line-width': 2,
          'line-dasharray': [4, 2],
        },
      },

      // Oblast (region) borders
      {
        id: 'boundary-region',
        type: 'line',
        source: 'basemap',
        'source-layer': 'boundaries',
        filter: ['==', 'kind', 'region'],
        minzoom: 6,
        paint: {
          'line-color': '#aaaaaa',
          'line-width': 0.8,
          'line-dasharray': [3, 2],
        },
      },

      // ── ROAD LABELS ───────────────────────────────────────

      // Primary / secondary road labels
      {
        id: 'road-label',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'roads',
        filter: ['in', 'kind', 'motorway', 'trunk', 'primary', 'secondary'],
        minzoom: 12,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['coalesce', ['get', 'name:uk'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 13],
          'text-max-angle': 30,
          'symbol-spacing': 300,
        },
        paint: {
          'text-color': '#5a4020',
          'text-halo-color': '#fffdf0',
          'text-halo-width': 2,
        },
      },

      // Minor road labels
      {
        id: 'road-label-minor',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'roads',
        filter: ['in', 'kind', 'minor_road', 'tertiary', 'residential'],
        minzoom: 14,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['coalesce', ['get', 'name:uk'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 10,
          'text-max-angle': 30,
          'symbol-spacing': 200,
        },
        paint: {
          'text-color': '#666666',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      },

      // ── MOUNTAIN PEAKS ────────────────────────────────────
      // Circle background for elevation number
      {
        id: 'peak-circle',
        type: 'circle',
        source: 'basemap',
        'source-layer': 'natural',
        filter: ['==', 'kind', 'peak'],
        minzoom: 8,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 7, 12, 11],
          'circle-color': '#ffffff',
          'circle-stroke-color': '#8a5020',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.92,
        },
      },

      // Elevation number inside circle
      {
        id: 'peak-elevation',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'natural',
        filter: ['all', ['==', 'kind', 'peak'], ['has', 'ele']],
        minzoom: 8,
        layout: {
          'text-field': ['to-string', ['get', 'ele']],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 8, 12, 10],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#5a2c00',
        },
      },

      // Peak name below the circle
      {
        id: 'peak-name',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'natural',
        filter: ['==', 'kind', 'peak'],
        minzoom: 10,
        layout: {
          'text-field': ['coalesce', ['get', 'name:uk'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 10,
          'text-anchor': 'top',
          'text-offset': [0, 1.2],
          'text-max-width': 8,
        },
        paint: {
          'text-color': '#5a2c00',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      },

      // ── PLACE LABELS ──────────────────────────────────────

      // Country names (at low zoom)
      {
        id: 'place-country',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'places',
        filter: ['==', 'kind', 'country'],
        maxzoom: 6,
        layout: {
          'text-field': ['coalesce', ['get', 'name:uk'], ['get', 'name']],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 6, 16],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.1,
        },
        paint: {
          'text-color': '#555555',
          'text-halo-color': 'rgba(255,255,255,0.7)',
          'text-halo-width': 2,
        },
      },

      // Cities — large dot + name
      {
        id: 'place-city-dot',
        type: 'circle',
        source: 'basemap',
        'source-layer': 'places',
        filter: ['in', 'kind', 'city'],
        minzoom: 5,
        maxzoom: 11,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3, 10, 5],
          'circle-color': '#444444',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      },

      {
        id: 'place-city',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'places',
        filter: ['in', 'kind', 'city'],
        minzoom: 5,
        layout: {
          'text-field': ['coalesce', ['get', 'name:uk'], ['get', 'name']],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 12, 12, 20],
          'text-offset': [0, 0.5],
          'text-anchor': 'top',
          'text-max-width': 10,
        },
        paint: {
          'text-color': '#111111',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2.5,
        },
      },

      // Towns
      {
        id: 'place-town-dot',
        type: 'circle',
        source: 'basemap',
        'source-layer': 'places',
        filter: ['in', 'kind', 'town'],
        minzoom: 8,
        maxzoom: 13,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 2.5, 12, 4],
          'circle-color': '#555555',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
        },
      },

      {
        id: 'place-town',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'places',
        filter: ['in', 'kind', 'town'],
        minzoom: 8,
        layout: {
          'text-field': ['coalesce', ['get', 'name:uk'], ['get', 'name']],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 11, 14, 15],
          'text-offset': [0, 0.4],
          'text-anchor': 'top',
          'text-max-width': 8,
        },
        paint: {
          'text-color': '#222222',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      },

      // Villages / suburbs
      {
        id: 'place-village-dot',
        type: 'circle',
        source: 'basemap',
        'source-layer': 'places',
        filter: ['in', 'kind', 'village', 'hamlet'],
        minzoom: 11,
        maxzoom: 15,
        paint: {
          'circle-radius': 2,
          'circle-color': '#666666',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
        },
      },

      {
        id: 'place-village',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'places',
        filter: ['in', 'kind', 'village', 'hamlet', 'suburb'],
        minzoom: 11,
        layout: {
          'text-field': ['coalesce', ['get', 'name:uk'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10, 15, 13],
          'text-offset': [0, 0.4],
          'text-anchor': 'top',
          'text-max-width': 6,
        },
        paint: {
          'text-color': '#333333',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      },

      // Suburb / neighbourhood labels (high zoom)
      {
        id: 'place-suburb',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'places',
        filter: ['in', 'kind', 'suburb', 'neighbourhood', 'quarter'],
        minzoom: 13,
        layout: {
          'text-field': ['coalesce', ['get', 'name:uk'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.07,
          'text-max-width': 8,
        },
        paint: {
          'text-color': '#666666',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      },
    ],
  };
}
