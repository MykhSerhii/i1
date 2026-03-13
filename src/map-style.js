/**
 * MapLibre GL style for Protomaps basemap schema.
 * Layer names: earth, water, landcover, landuse, roads, boundaries, places, buildings, pois
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
      // Ocean background
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#a8c8e8' },
      },

      // Land (earth layer replaces background for land areas)
      {
        id: 'earth',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'earth',
        paint: { 'fill-color': '#f0ece3' },
      },

      // Water fill
      {
        id: 'water',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'water',
        paint: { 'fill-color': '#a8c8e8' },
      },

      // Waterways (rivers/canals stored as lines in water layer)
      {
        id: 'waterway',
        type: 'line',
        source: 'basemap',
        'source-layer': 'water',
        filter: ['in', 'kind', 'river', 'stream', 'canal', 'drain', 'ditch'],
        paint: {
          'line-color': '#a8c8e8',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 2.5],
        },
      },

      // Landcover – forest
      {
        id: 'landcover-forest',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'landcover',
        filter: ['in', 'kind', 'forest', 'wood'],
        paint: { 'fill-color': '#c8dbb3', 'fill-opacity': 0.7 },
      },

      // Landcover – grass / scrub / farmland
      {
        id: 'landcover-grass',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'landcover',
        filter: ['in', 'kind', 'grass', 'scrub', 'farmland', 'crop'],
        paint: { 'fill-color': '#dcecc5', 'fill-opacity': 0.5 },
      },

      // Landuse – residential
      {
        id: 'landuse-residential',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'landuse',
        filter: ['in', 'kind', 'residential', 'suburb', 'neighbourhood'],
        paint: { 'fill-color': '#e8e4dc', 'fill-opacity': 0.6 },
      },

      // Landuse – industrial / commercial
      {
        id: 'landuse-industrial',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'landuse',
        filter: ['in', 'kind', 'industrial', 'commercial', 'retail'],
        paint: { 'fill-color': '#ddd8cc', 'fill-opacity': 0.5 },
      },

      // Hillshade – visible in both 2D and 3D
      {
        id: 'hillshade',
        type: 'hillshade',
        source: 'terrain-src',
        paint: {
          'hillshade-illumination-direction': 315,
          'hillshade-exaggeration': 0.35,
          'hillshade-shadow-color': '#3a3a3a',
          'hillshade-highlight-color': '#ffffff',
        },
      },

      // Roads – service / path / track
      {
        id: 'road-service',
        type: 'line',
        source: 'basemap',
        'source-layer': 'roads',
        filter: ['in', 'kind', 'service', 'track', 'path', 'footway', 'cycleway'],
        minzoom: 13,
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 16, 1.5],
        },
      },

      // Roads – minor / tertiary
      {
        id: 'road-minor',
        type: 'line',
        source: 'basemap',
        'source-layer': 'roads',
        filter: ['in', 'kind', 'minor_road', 'tertiary'],
        minzoom: 11,
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 14, 3],
        },
      },

      // Roads – secondary
      {
        id: 'road-secondary',
        type: 'line',
        source: 'basemap',
        'source-layer': 'roads',
        filter: ['==', 'kind', 'secondary'],
        minzoom: 9,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1, 14, 5],
        },
      },

      // Roads – primary
      {
        id: 'road-primary',
        type: 'line',
        source: 'basemap',
        'source-layer': 'roads',
        filter: ['==', 'kind', 'primary'],
        minzoom: 7,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#f9d84b',
          'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.5, 14, 7],
        },
      },

      // Roads – motorway / trunk
      {
        id: 'road-motorway',
        type: 'line',
        source: 'basemap',
        'source-layer': 'roads',
        filter: ['in', 'kind', 'motorway', 'trunk'],
        minzoom: 6,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#e8a020',
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 14, 9],
        },
      },

      // Boundaries – country
      {
        id: 'boundary-country',
        type: 'line',
        source: 'basemap',
        'source-layer': 'boundaries',
        filter: ['==', 'kind', 'country'],
        paint: {
          'line-color': '#a06010',
          'line-width': 2,
          'line-dasharray': [4, 2],
        },
      },

      // Boundaries – region (oblast)
      {
        id: 'boundary-region',
        type: 'line',
        source: 'basemap',
        'source-layer': 'boundaries',
        filter: ['==', 'kind', 'region'],
        minzoom: 6,
        paint: {
          'line-color': '#999999',
          'line-width': 0.8,
          'line-dasharray': [3, 2],
        },
      },

      // Cities
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
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 12, 12, 18],
          'text-max-width': 8,
        },
        paint: {
          'text-color': '#222222',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      },

      // Towns
      {
        id: 'place-town',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'places',
        filter: ['in', 'kind', 'town'],
        minzoom: 8,
        layout: {
          'text-field': ['coalesce', ['get', 'name:uk'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 11, 14, 15],
          'text-max-width': 8,
        },
        paint: {
          'text-color': '#333333',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      },

      // Villages / suburbs
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
          'text-size': 11,
          'text-max-width': 6,
        },
        paint: {
          'text-color': '#555555',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      },
    ],
  };
}
