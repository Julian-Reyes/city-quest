/**
 * visits.js — Persistent check-in storage (localStorage)
 *
 * Stores venue visit history under "cityquest_visited". This is user-generated
 * content that must never expire (unlike the API cache which has a 7-day TTL).
 *
 * Data model:
 *   { "osm-12345678": { visits: [{ at, note, hasPhoto }, ...] } }
 *
 * Photos are stored in separate localStorage keys (cityquest_photo_{venueId}_{index})
 * to keep the main visits object small and avoid hitting the 5MB limit.
 */

const VISITS_KEY = "cityquest_visited";

export function getVisits() {
  try {
    return JSON.parse(localStorage.getItem(VISITS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function addVisit(venueId, visit, photoBase64, venueType, venueInfo) {
  try {
    const data = getVisits();
    if (!data[venueId]) data[venueId] = { visits: [] };
    if (venueType) data[venueId].type = venueType;
    if (venueInfo) {
      data[venueId].name = venueInfo.name;
      data[venueId].lat = venueInfo.lat;
      data[venueId].lng = venueInfo.lng;
    }

    const visitIndex = data[venueId].visits.length;
    let hasPhoto = false;
    if (photoBase64) {
      hasPhoto = saveVisitPhoto(venueId, visitIndex, photoBase64);
    }

    data[venueId].visits.push({ ...visit, hasPhoto });
    localStorage.setItem(VISITS_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save visit:", e);
  }
}

export function saveVisitPhoto(venueId, visitIndex, base64) {
  const key = `cityquest_photo_${venueId}_${visitIndex}`;
  try {
    localStorage.setItem(key, base64);
    return true;
  } catch {
    console.warn("Could not save photo — storage full");
    return false;
  }
}

export function getVisitPhoto(venueId, visitIndex) {
  try {
    return localStorage.getItem(`cityquest_photo_${venueId}_${visitIndex}`);
  } catch {
    return null;
  }
}

export function backfillVisitTypes(venues) {
  const data = getVisits();
  let changed = false;
  for (const venue of venues) {
    const entry = data[venue.id];
    if (entry && !entry.type && venue.type) {
      entry.type = venue.type;
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem(VISITS_KEY, JSON.stringify(data));
  }
  return changed;
}

export function getVisitedVenues(type) {
  const data = getVisits();
  const venues = [];
  for (const [id, entry] of Object.entries(data)) {
    if (!entry.visits?.length || !entry.lat || entry.type !== type) continue;
    const latest = entry.visits[entry.visits.length - 1];
    const latestPhoto = latest.hasPhoto
      ? getVisitPhoto(id, entry.visits.length - 1)
      : null;
    venues.push({
      id,
      name: entry.name || "Unknown venue",
      type: entry.type,
      lat: entry.lat,
      lng: entry.lng,
      address: "",
      visited: true,
      visitCount: entry.visits.length,
      visits: entry.visits,
      latestVisit: latest,
      visitedAt: latest.at,
      note: latest.note || "",
      photo: latestPhoto,
    });
  }
  return venues;
}

export function getVisitStats() {
  const data = getVisits();
  const stats = { total: 0, bar: 0, cafe: 0, ice_cream: 0, restaurant: 0, photos: 0, notes: 0 };
  for (const entry of Object.values(data)) {
    if (!entry.visits || entry.visits.length === 0) continue;
    stats.total++;
    if (entry.type && stats[entry.type] !== undefined) stats[entry.type]++;
    for (const v of entry.visits) {
      if (v.hasPhoto) stats.photos++;
      if (v.note) stats.notes++;
    }
  }
  return stats;
}
