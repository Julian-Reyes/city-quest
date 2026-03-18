/**
 * google.js — Google Places API (New) integration
 *
 * Enriches venues with rating, rating count, price level, opening hours,
 * and a formatted address (used to override blank OSM addresses).
 *
 * In dev, calls go through Vite proxy. In prod, calls go direct to
 * places.googleapis.com (Google supports browser CORS with referrer restrictions).
 *
 * The distance check (googleDist <= 300m) prevents using a Google address
 * from a different business that happens to share the same name.
 *
 * Photos and reviews are commented out to save API costs.
 * See REIMPLEMENT_PHOTOS_REVIEWS.md for re-enabling.
 */

const isDev = import.meta.env.DEV;
const GOOGLE_BASE = isDev ? "/api/google" : "https://places.googleapis.com";

const GOOGLE_PRICE_MAP = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// Strip zip code and country from Google's formatted address
// "123 Main St, Austin, TX 78701, USA" → "123 Main St, Austin, TX"
function cleanAddress(raw) {
  if (!raw) return null;
  // Remove country suffix (last comma-separated part)
  const parts = raw.split(",").map((s) => s.trim());
  if (parts.length >= 3) parts.pop(); // remove country
  // Remove zip code from the state part (e.g. "TX 78701" → "TX")
  const last = parts[parts.length - 1];
  parts[parts.length - 1] = last.replace(/\s+\d{5}(-\d{4})?$/, "");
  return parts.join(", ");
}

export async function fetchGooglePlaceDetails(name, lat, lng) {
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_KEY;
  if (!apiKey) return null;

  try {
    const searchRes = await fetch(`${GOOGLE_BASE}/v1/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          // "places.id,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours,places.photos,places.reviews",
          "places.id,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours,places.formattedAddress,places.location,places.businessStatus",
      },
      body: JSON.stringify({
        textQuery: name,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 500.0,
          },
        },
        maxResultCount: 1,
      }),
    });
    if (!searchRes.ok) return null;
    const data = await searchRes.json();
    const place = data.places?.[0];
    if (!place) return null;

    // Compute distance between OSM coords and Google's result
    let googleDist = null;
    if (place.location) {
      const R = 6371000;
      const dLat = ((place.location.latitude - lat) * Math.PI) / 180;
      const dLng = ((place.location.longitude - lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((place.location.latitude * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      googleDist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // let photo = null;
    // if (place.photos?.[0]?.name) {
    //   const photoRes = await fetch(
    //     `${GOOGLE_BASE}/v1/${place.photos[0].name}/media?maxHeightPx=300&skipHttpRedirect=true`,
    //     { headers: { "X-Goog-Api-Key": apiKey } },
    //   );
    //   if (photoRes.ok) {
    //     const photoData = await photoRes.json();
    //     photo = photoData.photoUri || null;
    //   }
    // }

    let hours = null;
    if (place.currentOpeningHours) {
      const dayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
      hours = {
        open_now: place.currentOpeningHours.openNow,
        display:
          place.currentOpeningHours.weekdayDescriptions?.[dayIndex] || null,
      };
    }

    // let review = null;
    // if (place.reviews?.[0]?.text?.text) {
    //   review = place.reviews[0].text.text;
    // }

    // Reject permanently closed businesses — always treat as ghost
    if (place.businessStatus === "CLOSED_PERMANENTLY")
      return { closed: true };

    // Hole 2 fix: if Google's result is >300m from OSM coords, reject entirely.
    // A far-away match is a different business — don't pollute with its data.
    if (googleDist !== null && googleDist > 300) return null;

    return {
      // photo,
      rating: place.rating || null,
      ratingCount: place.userRatingCount || null,
      price: GOOGLE_PRICE_MAP[place.priceLevel] ?? null,
      hours,
      // review,
      address: cleanAddress(place.formattedAddress),
    };
  } catch (err) {
    console.error("Google Places fetch error:", err);
    return null;
  }
}
