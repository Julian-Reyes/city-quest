/**
 * cache.js — Client-side API response cache (localStorage)
 *
 * Caches Google Places and Foursquare responses under the key "cityquest_api_cache"
 * with a 7-day TTL. This avoids redundant network calls when users tap the same
 * venue multiple times or revisit the app.
 *
 * Also contains filterGhostVenues() — the batch filter that removes "ghost" venues
 * (stale OSM entries with no real Google match and no OSM address). It parses
 * localStorage ONCE for the whole array to avoid the per-venue parse crash that
 * happened before this optimization.
 *
 * Cache value semantics:
 *   undefined = cache miss (never fetched)
 *   null      = API returned no match (don't re-fetch, venue doesn't exist there)
 */

export const CACHE_KEY = "cityquest_api_cache";
export const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export function getApiCache(venueId, source) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    const entry = cache[`${source}_${venueId}`];
    if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  } catch {}
  return undefined;
}

export function setApiCache(venueId, source, data) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    cache[`${source}_${venueId}`] = { data, ts: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

export function filterGhostVenues(venues) {
  let cache;
  try {
    cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return venues;
  }
  const now = Date.now();
  return venues.filter((v) => {
    // If venue already has googleData in memory, use that
    if (v.googleData !== undefined) {
      const noGoogleAddr =
        v.googleData === null || (v.googleData && !v.googleData.address);
      return !(noGoogleAddr && (!v.address || v.address.trim() === ""));
    }
    // Otherwise check localStorage cache
    const entry = cache[`google_${v.id}`];
    if (entry && now - entry.ts < CACHE_TTL) {
      const noGoogleAddr =
        entry.data === null || (entry.data && !entry.data.address);
      if (noGoogleAddr && (!v.address || v.address.trim() === "")) return false;
    }
    return true;
  });
}
