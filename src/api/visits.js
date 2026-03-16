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

export function addVisit(venueId, visit, photoBase64) {
  try {
    const data = getVisits();
    if (!data[venueId]) data[venueId] = { visits: [] };

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
