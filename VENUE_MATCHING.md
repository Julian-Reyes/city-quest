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

In `src/App.jsx`, `fetchGooglePlaceDetails` (line ~188):
- Uses Google Text Search with `textQuery: name` and `locationBias` (500m circle)
- Requests `places.location` to compute haversine distance between OSM and Google coords
- **Address-only gating**: Google's `formattedAddress` is only used if the result is within 300m
- Rating, hours, and price are returned regardless of distance (they're still useful from a nearby match)

## Root Cause

The core issue is **OSM data quality**, not just matching accuracy. Many venues that show "no address" or "wrong address" simply don't exist in Google's database because they're closed or mislocated. No amount of matching improvement will fix venues that aren't real.

---

## Solution Options (Not Yet Implemented)

### Option A: OSM + Lazy Google Filtering + Caching (Recommended)

**Keep OSM for free discovery, use Google/Foursquare clicks to progressively filter stale venues.**

**How it works:**
1. OSM fetches all venues (free, unlimited)
2. When user clicks a venue, Google + Foursquare lookups happen (already implemented)
3. If Google can't match (no result or name mismatch) → mark venue as unverified
4. Unverified venues get hidden from the map on future loads
5. Cache results so each venue is only looked up once across all users

**Cost: ~$36/month for 200 unique venues, regardless of user count (with shared caching)**

**Phases:**
- **Phase 1** — Better matching (client-side only, no infra):
  - Preserve `osmTags` on venue objects so we can build richer queries
  - Build `textQuery` with address context: `"Starbucks, 123 Main St"` instead of `"Starbucks"`
  - Add `places.displayName` to field mask and validate name similarity
  - Reject results where Google's name doesn't match OSM's name
  - Add `&radius=500` to Foursquare search
- **Phase 2** — ~~Per-user IndexedDB cache~~ ✅ Done via localStorage (simpler, sufficient for now):
  - API responses cached under `cityquest_api_cache` with 7-day TTL
  - Caches `null` for no-match results to avoid re-fetching ghost venues
  - IndexedDB not needed at this scale
- **Phase 3** — Shared Cloudflare Worker + KV cache:
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

**Budget math:**
- $200/month ÷ $0.032 = 6,250 API calls/month
- Each "Search this area" = 1 call per venue type (returns max 20 venues)
- ~208 searches/day max

### Option C: OSM + Batch Verify with Google Nearby Search

**Fetch from OSM (free), then cross-reference with Google Nearby Search to filter stale venues before showing them.**

**How it works:**
1. Fetch all venues from OSM (free)
2. Run Google Nearby Search for the same area/type
3. Cross-reference: only keep OSM venues that have a nearby Google match
4. Show only verified venues on the map

**Pros:** Keeps OSM's broader dataset, filters stale data proactively
**Cons:** Same cost as Option B (~$0.032 per search per type), more complex matching logic

### Option D: Alternative Free Data Sources

Other free venue APIs that could replace or supplement OSM:

| Source | Free Tier | Pros | Cons |
|--------|-----------|------|------|
| **Yelp Fusion** | 500 calls/day | Very current data, ratings, prices included | Strict TOS (must show Yelp branding, limited caching) |
| **HERE Places** | 250K req/month | Very generous free tier | Less venue coverage in some areas |
| **Foursquare** (expanded) | ~50 calls/day (personal) | Already integrated | Very limited free tier |

None match OSM's coverage. Best used as cross-validation signals rather than primary sources.

### Option E: Multi-Source Cross-Validation

**Use multiple free sources to validate venue existence.** If a venue appears in both OSM and Foursquare (already called on click), it's very likely real and current. If neither Google nor Foursquare can find it, it's probably stale.

---

## Recommended Approach

**Option A (OSM + lazy filtering + caching)** is the best balance of cost, accuracy, and simplicity:
- Discovery remains free and comprehensive
- Stale venues get filtered out organically as users interact
- Caching eliminates redundant API costs
- Can be implemented incrementally (Phase 1 → 2 → 3)

## Testing Strategy

To compare approaches side-by-side, use **feature branches** rather than pushing to prod:
- `main` — current production code
- `feature/matching-improvements` — Phase 1 client-side matching fixes
- `feature/google-discovery` — experimental branch using Google Nearby Search
- Deploy branches to separate Vercel/Netlify preview URLs or test locally

---

## Open Questions (Julian to investigate)

- Should we switch entirely to Google for discovery, or keep OSM + filter?
- Is Yelp or HERE worth exploring as an alternative/supplement to OSM?
- What's the acceptable threshold for hiding stale venues? (e.g., hide after Google fails to match, or require multiple failed lookups?)
- How many unique venues per city are we realistically dealing with? (Affects caching cost estimates)

## Branch Preview Deployments (TODO)

Set up a platform that gives auto-preview URLs per branch so we can test approaches side-by-side without pushing to prod. Options:
- **Vercel** — easiest for Vite, free tier, auto-detects framework
- **Cloudflare Pages** — keeps everything in Cloudflare (already using Workers)
- **Netlify** — similar to Vercel

GitHub Pages only supports one branch at a time, so it won't work for this.

---

## Current State of the Code (as of 2026-03-13)

Already implemented in `fetchGooglePlaceDetails`:
- `places.formattedAddress` in field mask
- `places.location` in field mask
- Haversine distance computation (`googleDist`)
- Address-only gating at 300m (rating/hours/price still returned regardless)
- `locationBias` with 500m radius (NOT `locationRestriction` — that broke things at 200m)

NOT yet implemented:
- `osmTags` preservation on venue objects
- Richer `textQuery` with address context
- Name similarity validation (`places.displayName`)
- ~~Any caching (IndexedDB or Cloudflare KV)~~ → Client-side localStorage cache implemented (7-day TTL). Cloudflare KV (Phase 3) NOT yet done.
- Stale venue filtering/hiding
