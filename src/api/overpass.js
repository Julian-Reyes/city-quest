/**
 * overpass.js — OpenStreetMap venue fetching via Overpass API
 *
 * Free, no API key needed. Fetches real venue locations (name, address, coords)
 * within ~8km of a given lat/lng for a specific amenity type (bar, cafe, etc.).
 *
 * buildAddress() assembles a human-readable address from OSM's fragmented addr:* tags.
 * Returns " " (space) when no address info exists — this signals "no OSM address"
 * to the ghost venue filter (important: empty string would also work, but the space
 * is the existing convention).
 */

function buildAddress(tags) {
  const num = tags["addr:housenumber"] || "";
  const street = tags["addr:street"] || "";
  if (num && street) return `${num} ${street}`;
  if (street) return street;
  if (tags["addr:full"]) return tags["addr:full"];
  const city = tags["addr:city"] || "";
  const state = tags["addr:state"] || "";
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (tags["addr:suburb"]) return tags["addr:suburb"];
  if (tags["addr:neighbourhood"]) return tags["addr:neighbourhood"];
  if (tags["addr:place"]) return tags["addr:place"];
  if (tags["addr:district"]) return tags["addr:district"];
  if (tags["addr:postcode"]) return `Zip ${tags["addr:postcode"]}`;
  return " "; //removed "Address not listed"
}

export async function fetchVenues(lat, lng, type, signal) {
  const query = `[out:json][timeout:10];nwr["amenity"="${type}"](around:8000,${lat},${lng});out center body;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal,
  });
  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
  const data = await res.json();
  return data.elements
    .filter((el) => el.tags?.name && (el.lat || el.center?.lat))
    .map((el) => ({
      id: `osm-${el.id}`,
      name: el.tags.name,
      type,
      lat: el.lat ?? el.center.lat,
      lng: el.lon ?? el.center.lon,
      address: buildAddress(el.tags),
      visited: false,
      visitedAt: null,
      photo: null,
      note: "",
    }));
}
