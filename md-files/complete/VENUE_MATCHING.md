# Venue Matching — Problem Analysis & Solution Options

## The Problem

OSM (OpenStreetMap) is our free venue discovery source, but its data has quality issues:

1. **Stale venues** — businesses that closed, changed names, or changed ownership still appear
2. **Wrong locations** — some venues are marked at incorrect coordinates
3. **Missing addresses** — many venues have no `addr:*` tags at all
4. **Ghost venues** — some entries don't correspond to any real-world business (can't be found on Google Maps)

We enrich venues with Google Places + Foursquare on click, but the **matching is fuzzy** — we search Google Text Search with just the venue name + a 500m location bias. This causes:
- Wrong venues returned (especially common names like "Starbucks", "The Local")
- Wrong addresses, ratings, or hours shown for a different business
- Google returning nothing because the OSM venue doesn't actually exist

## What's Currently Implemented

### Google Places matching (`src/api/google.js`)
- Uses Google Text Search with `textQuery: name` and `locationBias` (500m circle)
- Requests `places.location` to compute haversine distance between OSM and Google coords
- **Address-only gating**: Google's `formattedAddress` is only used if the result is within 300m
- Rating, hours, and price are returned regardless of distance (still useful from a nearby match)

### Ghost venue filtering (`src/api/cache.js` + `src/App.jsx`)
- `filterGhostVenues(venues)` in `src/api/cache.js` — batch filter that parses the localStorage cache once per array (not per venue, which caused crashes). Called during OSM fetch and `mergeVenues`.
- Ghost check in `typeVenues` useMemo in `App.jsx` — reads in-memory `v.googleData` (no localStorage hit) so both map and list instantly hide ghosts when they're identified.
- Google Places useEffect in `App.jsx` — when a ghost is detected (fresh fetch or cache hit), sets `googleData: null` on the venue, closes the venue card, and shows a toast.
- Definition: ghost = `googleData === null` AND `address === " "` (no OSM address tags)

### Client-side API cache (`src/api/cache.js`)
- Google + Foursquare API responses cached in localStorage under key `cityquest_api_cache`
- 7-day TTL — entries auto-expire and re-fetch from API
- `null` results cached too (prevents re-fetching ghost venues)
- `undefined` = cache miss, `null` = API returned no match (important distinction)

## Root Cause

The core issue is **OSM data quality**, not just matching accuracy. Many venues that show "no address" or "wrong address" simply don't exist in Google's database because they're closed or mislocated. No amount of matching improvement will fix venues that aren't real.

---

## Solution Options

### Option A: OSM + Lazy Google Filtering + Caching (Recommended — partially done)

**Keep OSM for free discovery, use Google/Foursquare clicks to progressively filter stale venues.**

**Phases:**
- **Phase 1** — Better matching (client-side only, no infra):
  - ✅ Ghost venue filtering (hide venues Google can't match + no OSM address)
  - ✅ Address-only gating at 300m distance
  - ❌ Preserve `osmTags` on venue objects so we can build richer queries
  - ❌ Build `textQuery` with address context: `"Starbucks, 123 Main St"` instead of `"Starbucks"`
  - ❌ Add `places.displayName` to field mask and validate name similarity
  - ❌ Reject results where Google's name doesn't match OSM's name
  - ❌ Add `&radius=500` to Foursquare search
- **Phase 2** — Client-side cache: ✅ **Done**
  - localStorage cache with 7-day TTL in `src/api/cache.js`
  - Caches `null` for no-match results to avoid re-fetching ghost venues
- **Phase 3** — Shared Cloudflare Worker + KV cache: ❌ **Not done**
  - First user to look up a venue pays $0.032, all others get cached result for free
  - Extend existing `workers/fsq-proxy/worker.js` with `GET /venue/{osmId}` endpoint
  - Cloudflare KV free tier: 100K reads/day, 1K writes/day

### Option B: Switch to Google Nearby Search for Discovery

**Replace OSM entirely with Google as the venue source.**

**Pros:**
- Data is always current — no stale venues
- Addresses, ratings, hours all included from the start
- No matching problem (it's Google's own data)

**Cons:**
- $0.032 per API call, max 20 results per call (need pagination for dense areas)
- 4 venue types × multiple searches × users burns through $200/mo free credit fast
- At ~50 searches/day across all users, hits ~$192/month
- Less venue coverage than OSM in some areas

### Option C: OSM + Batch Verify with Google Nearby Search

**Fetch from OSM (free), then cross-reference with Google Nearby Search to filter stale venues before showing them.**

**Pros:** Keeps OSM's broader dataset, filters stale data proactively
**Cons:** Same cost as Option B (~$0.032 per search per type), more complex matching logic

### Option D: Alternative Free Data Sources

| Source | Free Tier | Pros | Cons |
|--------|-----------|------|------|
| **Yelp Fusion** | 500 calls/day | Very current data, ratings, prices included | Strict TOS (must show Yelp branding, limited caching) |
| **HERE Places** | 250K req/month | Very generous free tier | Less venue coverage in some areas |
| **Foursquare** (expanded) | ~50 calls/day (personal) | Already integrated | Very limited free tier |

None match OSM's coverage. Best used as cross-validation signals rather than primary sources.

---

## Open Questions

- Should we switch entirely to Google for discovery, or keep OSM + filter?
- Is the remaining Phase 1 matching work (richer textQuery, name validation) worth doing, or is ghost filtering good enough?
- Is Cloudflare KV shared cache (Phase 3) worth the effort at current user scale?
