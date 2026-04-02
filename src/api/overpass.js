/**
 * overpass.js — OpenStreetMap venue fetching via Overpass API
 *
 * Free, no API key needed. Fetches real venue locations (name, address, coords)
 * within a given radius of a lat/lng for a specific category.
 *
 * Each category declares its own OSM tag/value pair (e.g. amenity=bar,
 * tourism=museum, leisure=park) via CATEGORY_MAP in constants.js.
 *
 * buildAddress() assembles a human-readable address from OSM's fragmented addr:* tags.
 * Returns " " (space) when no address info exists — this signals "no OSM address"
 * to the ghost venue filter (important: empty string would also work, but the space
 * is the existing convention).
 */

import { CATEGORY_MAP } from "../constants";

function buildAddress(tags) {
  const num = tags["addr:housenumber"] || "";
  const street = tags["addr:street"] || "";

  let base = "";
  if (num && street) base = `${num} ${street}`;
  else if (street) base = street;
  else if (tags["addr:full"]) base = tags["addr:full"];

  if (base) return base;
  if (tags["addr:suburb"]) return tags["addr:suburb"];
  if (tags["addr:neighbourhood"]) return tags["addr:neighbourhood"];
  if (tags["addr:place"]) return tags["addr:place"];
  if (tags["addr:district"]) return tags["addr:district"];
  if (tags["addr:postcode"]) return `Zip ${tags["addr:postcode"]}`;
  return " "; //removed "Address not listed"
}

export async function fetchVenues(lat, lng, type, signal, radius = 4000) {
  const cat = CATEGORY_MAP[type];
  let query;
  if (cat && Array.isArray(cat.osmValue)) {
    // Union query for multiple values (e.g. park + garden + playground)
    const parts = cat.osmValue.map(
      (v) => `nwr["${cat.osmTag}"="${v}"](around:${radius},${lat},${lng})`,
    );
    query = `[out:json][timeout:25];(${parts.join(";")};);out center body;`;
  } else {
    const tagFilter = cat
      ? `["${cat.osmTag}"="${cat.osmValue}"]${cat.osmExtraFilter || ""}`
      : `["amenity"="${type}"]`;
    query = `[out:json][timeout:25];nwr${tagFilter}(around:${radius},${lat},${lng});out center body;`;
  }

  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal,
    });
    if (res.status !== 429 && res.status !== 504) break;
    await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
  }

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
      visitCount: 0,
      visits: [],
      latestVisit: null,
      photo: null,
      note: "",
    }));
}
