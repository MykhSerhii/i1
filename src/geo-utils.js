const EARTH_RADIUS_M = 6371000;

/**
 * Calculates the great-circle distance between two points using the Haversine formula.
 * @param {number} lat1 - Latitude of point 1 in degrees
 * @param {number} lon1 - Longitude of point 1 in degrees
 * @param {number} lat2 - Latitude of point 2 in degrees
 * @param {number} lon2 - Longitude of point 2 in degrees
 * @returns {number} Distance in meters
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/**
 * Calculates the initial bearing from point 1 to point 2.
 * @param {number} lat1 - Latitude of point 1 in degrees
 * @param {number} lon1 - Longitude of point 1 in degrees
 * @param {number} lat2 - Latitude of point 2 in degrees
 * @param {number} lon2 - Longitude of point 2 in degrees
 * @returns {number} Bearing in degrees (0-360, clockwise from North)
 */
export function bearing(lat1, lon1, lat2, lon2) {
  const dLon = toRad(lon2 - lon1);
  const lat1R = toRad(lat1);
  const lat2R = toRad(lat2);
  const y = Math.sin(dLon) * Math.cos(lat2R);
  const x = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Calculates the destination point from a starting point, bearing and distance.
 * @param {number} lat - Starting latitude in degrees
 * @param {number} lon - Starting longitude in degrees
 * @param {number} bearingDeg - Bearing in degrees (clockwise from North)
 * @param {number} distanceM - Distance in meters
 * @returns {{lat: number, lng: number}} Destination coordinates
 */
export function destinationPoint(lat, lon, bearingDeg, distanceM) {
  const latR = toRad(lat);
  const lonR = toRad(lon);
  const bearingR = toRad(bearingDeg);
  const angularDist = distanceM / EARTH_RADIUS_M;

  const sinLat = Math.sin(latR) * Math.cos(angularDist) +
    Math.cos(latR) * Math.sin(angularDist) * Math.cos(bearingR);
  const destLatR = Math.asin(sinLat);
  const y = Math.sin(bearingR) * Math.sin(angularDist) * Math.cos(latR);
  const x = Math.cos(angularDist) - Math.sin(latR) * sinLat;
  const destLonR = lonR + Math.atan2(y, x);

  return {
    lat: toDeg(destLatR),
    lng: ((toDeg(destLonR) + 540) % 360) - 180
  };
}

/**
 * Creates a GeoJSON Polygon representing a circle on the map.
 * @param {number} lat - Center latitude in degrees
 * @param {number} lon - Center longitude in degrees
 * @param {number} radiusM - Radius in meters
 * @param {number} [steps=64] - Number of polygon vertices
 * @returns {Object} GeoJSON Feature with Polygon geometry
 */
export function circleToGeoJSON(lat, lon, radiusM, steps = 64) {
  const coordinates = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 360;
    const point = destinationPoint(lat, lon, angle, radiusM);
    coordinates.push([point.lng, point.lat]);
  }
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates]
    },
    properties: {}
  };
}

/**
 * Converts longitude/latitude to tile coordinates at a given zoom level.
 * @param {number} lng - Longitude in degrees
 * @param {number} lat - Latitude in degrees
 * @param {number} zoom - Zoom level (integer)
 * @returns {{x: number, y: number, z: number}} Tile coordinates
 */
export function lngLatToTile(lng, lat, zoom) {
  const z = Math.floor(zoom);
  const n = Math.pow(2, z);
  const x = Math.floor((lng + 180) / 360 * n);
  const latR = toRad(lat);
  const y = Math.floor((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n);
  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y)),
    z
  };
}

/**
 * Converts tile coordinates to the longitude/latitude of the tile's top-left corner.
 * @param {number} x - Tile X coordinate
 * @param {number} y - Tile Y coordinate
 * @param {number} z - Zoom level
 * @returns {{lng: number, lat: number}} Coordinates of the tile's origin (top-left corner)
 */
export function tileToLngLat(x, y, z) {
  const n = Math.pow(2, z);
  const lng = (x / n) * 360 - 180;
  const latR = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
  return {
    lng,
    lat: toDeg(latR)
  };
}

/**
 * Converts a pixel position within a tile to longitude/latitude.
 * @param {number} tileX - Tile X coordinate
 * @param {number} tileY - Tile Y coordinate
 * @param {number} pixelX - Pixel X within tile (0-255)
 * @param {number} pixelY - Pixel Y within tile (0-255)
 * @param {number} zoom - Zoom level
 * @returns {{lng: number, lat: number}} Geographic coordinates
 */
export function pixelToLngLat(tileX, tileY, pixelX, pixelY, zoom) {
  const tileSize = 256;
  const n = Math.pow(2, zoom);
  const globalX = (tileX * tileSize + pixelX) / (tileSize * n);
  const globalY = (tileY * tileSize + pixelY) / (tileSize * n);
  const lng = globalX * 360 - 180;
  const latR = Math.atan(Math.sinh(Math.PI * (1 - 2 * globalY)));
  return {
    lng,
    lat: toDeg(latR)
  };
}

function toRad(deg) {
  return deg * Math.PI / 180;
}

function toDeg(rad) {
  return rad * 180 / Math.PI;
}
