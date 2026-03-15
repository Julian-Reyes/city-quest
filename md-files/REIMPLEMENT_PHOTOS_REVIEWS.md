# Re-enabling Photos & Reviews Guide

This guide covers how to uncomment the photos and reviews features that were disabled to save API costs. All the code is still in `src/App.jsx` — nothing was deleted, just commented out.

---

## Cost Impact of Re-enabling

| Feature | API Call | Cost per 1,000 |
|---|---|---|
| Photos (Google) | `GET /v1/{photo}/media` | $7 |
| Reviews (Google) | Included in Text Search | Upgrades Text Search from Pro ($32/1K) to Enterprise ($35/1K) |
| Photos (Foursquare) | `GET /places/{id}/photos` | Requires paid Foursquare credits |
| Tips (Foursquare) | `GET /places/{id}/tips` | Requires paid Foursquare credits |

**Total per-click increase**: ~$0.01 (from ~$0.032 back to ~$0.042)

---

## Step-by-step: Google Places API

### 1. Restore the field mask (~line 194)

**Find this:**
```js
// "places.id,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours,places.photos,places.reviews",
"places.id,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours",
```

**Change to:**
```js
"places.id,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours,places.photos,places.reviews",
```

Delete the line without `places.photos,places.reviews`.

### 2. Uncomment the photo fetch (~line 212)

**Find this:**
```js
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
```

**Remove the `//` from each line** so it becomes:
```js
let photo = null;
if (place.photos?.[0]?.name) {
  const photoRes = await fetch(
    `${GOOGLE_BASE}/v1/${place.photos[0].name}/media?maxHeightPx=300&skipHttpRedirect=true`,
    { headers: { "X-Goog-Api-Key": apiKey } },
  );
  if (photoRes.ok) {
    const photoData = await photoRes.json();
    photo = photoData.photoUri || null;
  }
}
```

### 3. Uncomment the review extraction (~line 235)

**Find this:**
```js
// let review = null;
// if (place.reviews?.[0]?.text?.text) {
//   review = place.reviews[0].text.text;
// }
```

**Remove the `//`** so it becomes:
```js
let review = null;
if (place.reviews?.[0]?.text?.text) {
  review = place.reviews[0].text.text;
}
```

### 4. Uncomment the return values (~line 240)

**Find this:**
```js
return {
  // photo,
  rating: place.rating || null,
  ratingCount: place.userRatingCount || null,
  price: GOOGLE_PRICE_MAP[place.priceLevel] ?? null,
  hours,
  // review,
};
```

**Uncomment `photo` and `review`:**
```js
return {
  photo,
  rating: place.rating || null,
  ratingCount: place.userRatingCount || null,
  price: GOOGLE_PRICE_MAP[place.priceLevel] ?? null,
  hours,
  review,
};
```

---

## Step-by-step: Foursquare API

### 5. Uncomment photo & tips API calls (~line 131)

**Find this:**
```js
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
```

**Remove all the `//`** to restore the full block.

### 6. Uncomment the Foursquare return values (~line 159)

**Find this:**
```js
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
```

**Uncomment `photo` and `tip`:**
```js
return {
  photo,
  category: place.categories?.[0]?.name || null,
  price: place.price || null,
  rating: place.rating || null,
  hours: place.hours
    ? { open_now: place.hours.open_now, display: place.hours.display }
    : null,
  tip,
};
```

---

## Step-by-step: Rendering (VenueCard component)

### 7. Uncomment the data variables (~line 394)

**Find this:**
```js
// const venuePhoto = goog?.photo || fsq?.photo;
// const tip = goog?.review || fsq?.tip;
```

**Uncomment both lines:**
```js
const venuePhoto = goog?.photo || fsq?.photo;
const tip = goog?.review || fsq?.tip;
```

### 8. Uncomment the JSX rendering (~line 470)

**Find this:**
```jsx
{/* venuePhoto and tip/review commented out to save API costs
{venuePhoto && (
  <img
    src={venuePhoto}
    alt=""
    style={{
      width: "100%",
      borderRadius: 8,
      marginBottom: 10,
      maxHeight: 200,
      objectFit: "cover",
    }}
  />
)}
{tip && (
  <div
    style={{
      fontSize: 12,
      color: "rgba(255,255,255,0.5)",
      fontStyle: "italic",
      marginBottom: 12,
      lineHeight: 1.4,
    }}
  >
    &ldquo;{tip}&rdquo;
  </div>
)}
*/}
```

**Replace the whole block with just the JSX (remove the `{/* ... */}` wrapper):**
```jsx
{venuePhoto && (
  <img
    src={venuePhoto}
    alt=""
    style={{
      width: "100%",
      borderRadius: 8,
      marginBottom: 10,
      maxHeight: 200,
      objectFit: "cover",
    }}
  />
)}
{tip && (
  <div
    style={{
      fontSize: 12,
      color: "rgba(255,255,255,0.5)",
      fontStyle: "italic",
      marginBottom: 12,
      lineHeight: 1.4,
    }}
  >
    &ldquo;{tip}&rdquo;
  </div>
)}
```

---

## Checklist

After uncommenting, verify:

- [ ] `npm run build` succeeds with no errors
- [ ] Clicking a venue shows a photo (if one exists)
- [ ] A review/tip quote appears below the photo
- [ ] Google Cloud Console shows Photo requests appearing in usage
- [ ] Monitor costs in Google Cloud Billing — you're now back to ~$0.042/click

## Partial Re-enable Options

You can re-enable features independently:

| Want just... | Do steps... | Extra cost |
|---|---|---|
| Google photos only | 1, 2, 4, 7, 8 | +$7/1K clicks |
| Google reviews only | 1, 3, 4, 7, 8 | +$3/1K clicks (Pro→Enterprise) |
| Google photos + reviews | 1, 2, 3, 4, 7, 8 | +$10/1K clicks |
| Foursquare photos + tips | 5, 6, 7, 8 | Requires paid Foursquare plan |
| Everything | All steps (1–8) | Full ~$0.042/click |

---

## TODO: Add Photo Filters

When photos are re-enabled, they'll look out of place against the dark/moody UI. Add a CSS `filter` to all `<img>` style objects to give them a grungy, film-camera aesthetic.

**Implementation plan:**
1. Add a `PHOTO_FILTER` constant in the CONSTANTS section of `App.jsx` with 3 swappable options (comment/uncomment to compare):
   ```js
   const PHOTO_FILTER = "contrast(1.15) saturate(0.85) brightness(0.9) sepia(0.15)";  // Grungy film camera
   // const PHOTO_FILTER = "contrast(1.3) saturate(0.6) brightness(0.85)";              // High contrast noir
   // const PHOTO_FILTER = "contrast(1.1) saturate(0.7) brightness(0.95) sepia(0.25)";  // Faded analog
   ```
2. Add `filter: PHOTO_FILTER,` to the style object of all 3 `<img>` tags:
   - API-fetched venue photo in VenueCard (~line 472)
   - User-uploaded visited venue photo in VenueCard (~line 516)
   - Photo preview in check-in modal (~line 1667)
3. Test visually by swapping between the 3 filter constants to pick the best one
