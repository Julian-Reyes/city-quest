/**
 * foursquare.js — Foursquare Places API integration
 *
 * Provides human-readable venue categories (e.g., "Cocktail Bar", "Dive Bar").
 * In dev, calls go through Vite proxy with the API key sent directly.
 * In prod, calls go through a Cloudflare Worker (fsq-proxy) that adds the key
 * server-side — this avoids CORS issues since Foursquare blocks browser CORS.
 *
 * Photos and tips endpoints are commented out to save API costs.
 * See REIMPLEMENT_PHOTOS_REVIEWS.md for re-enabling.
 */

const isDev = import.meta.env.DEV;
const FSQ_BASE = isDev
  ? "/api/fsq"
  : "https://fsq-proxy.city-quest.workers.dev";

export async function fetchFoursquareDetails(name, lat, lng) {
  const apiKey = import.meta.env.VITE_FOURSQUARE_API_KEY;
  if (!apiKey && isDev) return null; // In prod, worker handles auth — no key needed

  // In dev: send API key directly via Vite proxy. In prod: worker adds it server-side.
  const headers = isDev
    ? {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "X-Places-Api-Version": "2025-06-17",
      }
    : { Accept: "application/json" };

  try {
    const searchRes = await fetch(
      `${FSQ_BASE}/places/search?ll=${lat},${lng}&query=${encodeURIComponent(name)}&limit=1`,
      { headers },
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const place = searchData.results?.[0];
    if (!place) return null;

    const fsqId = place.fsq_place_id;

    // Photos and tips are premium endpoints — commented out to save API costs
    // const [photoRes, tipsRes] = await Promise.all([
    //   fetch(
    //     `${FSQ_BASE}/places/${fsqId}/photos?limit=1`,
    //     { headers },
    //   ).catch(() => null),
    //   fetch(
    //     `${FSQ_BASE}/places/${fsqId}/tips?limit=1`,
    //     { headers },
    //   ).catch(() => null),
    // ]);

    // let photo = null;
    // if (photoRes?.ok) {
    //   const photos = await photoRes.json();
    //   if (photos?.[0]) {
    //     photo = `${photos[0].prefix}300x200${photos[0].suffix}`;
    //   }
    // }

    // let tip = null;
    // if (tipsRes?.ok) {
    //   const tips = await tipsRes.json();
    //   if (tips?.[0]?.text) {
    //     tip = tips[0].text;
    //   }
    // }

    return {
      // photo,
      category: place.categories?.[0]?.name || null,
      price: place.price || null,
      rating: place.rating || null,
      hours: place.hours
        ? { open_now: place.hours.open_now, display: place.hours.display }
        : null,
      // tip,
    };
  } catch (err) {
    console.error("Foursquare fetch error:", err);
    return null;
  }
}
