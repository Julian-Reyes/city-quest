/**
 * distance.js — Haversine distance calculation
 *
 * Used by ListPanel (show "X mi" next to each venue) and MapMoveDetector
 * (trigger "Search this area" when user pans >3 miles from fetch center).
 *
 * Extracted from App.jsx to avoid duplicating math in multiple components.
 */

export function distanceMiles(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
