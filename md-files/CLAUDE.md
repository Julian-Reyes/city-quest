# City Quest — Project Guide

## What This App Is
A mobile-first PWA that gamifies exploring your city. Users discover bars, coffee shops, ice cream shops, and restaurants on a map, check in when they visit, and unlock achievements. Think Pokémon GO but for real-world venues.

**Live at**: https://julianreyes.dev/city-quest/
**Repo**: Julian-Reyes/city-quest

---

## What's Already Built

The app was originally a single-file `App.jsx` (~2000 lines) and has been split into modules.
See **File Structure** below for the full layout. Features:

**UI & Navigation**
- Header with venue type name, city edition subtitle, visited count, and completion percentage
- City edition text (e.g. "— San Diego Edition") uses non-breaking spaces (`\u00A0`) so it stays as one unit — fits on line 1 with "Bar Hunter" if short, wraps entirely to line 2 if long
- Venue type switcher (Bars 🍺 / Coffee ☕ / Ice Cream 🍦 / Food 🍔)
- Animated progress bar showing % of venues visited
- Bottom nav with List / Awards / Passport tabs
- Responsive layout: mobile (stacked) and desktop (two-column with sidebar)

**Map View**
- Leaflet map via `react-leaflet` with CartoDB dark tiles
- Shows venue pins (amber = unvisited, green = visited) with user's blue location dot
- "Search this area" button to load venues when panning to new areas
- Geolocation requested on load

**Real Venue Data (3 API sources)**
- **Overpass API (OpenStreetMap)** — fetches real venue locations (name, address, coords) based on map viewport. Free, no key needed. Returns street-only addresses (e.g., "123 Main St"); city/state enrichment happens in App.jsx via Nominatim.
- **Foursquare Places API** — enriches venues with human-readable categories (e.g., "Cocktail Bar", "Dive Bar", "Speakeasy")
- **Google Places API (New)** — enriches venues with rating, rating count, price level, and opening hours
- All API data is fetched on venue click and cached on the venue object

**List View**
- Shows all venues for the active type
- Visited venues shown with green highlight and checkmark
- Tapping a venue switches to map and selects it

**Check-in Flow**
- Venue card slides up from bottom when a pin is tapped
- Shows name, address, category, price, rating, and hours (from APIs)
- "Check In Here" button opens a modal with:
  - Optional text note
  - Optional photo via two side-by-side buttons: "Take Photo" (custom `getUserMedia` camera) and "Library" (file input for gallery). Labels change to "Retake" / "Change" when photo exists.
  - Confirm button that marks venue as visited with timestamp
- Repeat check-ins: visited venues show visit count ("Visited 3x") and a "+ Again" button
- `visitStats` state tracks stats across all types (drives achievements)
- Previously visited venues always shown on map, even outside current search radius (venue lat/lng/name persisted in localStorage at check-in time)

**Passport Panel**
- Visual stamp-book showing all visited venues across all types
- Header card with total stamped count, type breakdown pills (emoji + count per type)
- Circular ink-stamp design: 130px dashed-border circles with subtle color tint, grouped by type in flex-wrap centered layout
- Each stamp has a deterministic slight rotation (via `stampRotation` hash), type emoji (24px), venue name (9px uppercase, 2-line clamp), and passport-style date ("15 MAR 2026")
- Visit count badge positioned inside the circle (`bottom: 14px, right: 14px`); photo thumbnail overlaps top-right edge
- When passport tab is active, map shows only visited pins (all types, no unvisited)
- "Search this area" button hidden in passport mode
- Tapping a stamp selects the venue on the map
- Empty state when no venues visited
- `getAllVisitedVenues()` in visits.js returns all visited venues without type filter (does not require lat/lng — stamps show even for old check-ins missing coordinates)
- Visited venues skip ghost detection (never "removed from map")

**Achievements Panel**
- 11 achievements in three sections:
  - **Milestones** (global): First Sip (1), Night Owl (5), Bar Hopper (10), Local Legend (20), City Conqueror (50)
  - **Categories** (per-type): Bar Fly (15 bars), Coffee Snob (10 cafes), Sweet Tooth (5 ice cream), Food Critic (15 restaurants)
  - **Activity**: Photographer (10 photos), Chronicler (10 notes)
- Each achievement has a `stat` key that maps to a field in the stats object (`total`, `bar`, `cafe`, `ice_cream`, `restaurant`, `photos`, `notes`)
- Full-screen celebration animation when achievements are unlocked; multiple simultaneous unlocks queue and show sequentially (tap to advance)
- Progress shown for locked achievements ("X more to go")
- Unlock detection compares stats before/after check-in, so photo/note achievements trigger on repeat visits too

**Persistence**
- All check-in state saved to localStorage (survives page refresh)
- Venue visits, notes, and photos persist across sessions
- Visit data stored under `cityquest_visited` key (never expires — user content); each venue entry includes `type`, `name`, `lat`, `lng` for per-category stats and out-of-area display
- Photos stored in separate keys (`cityquest_photo_{venueId}_{index}`) to avoid hitting 5MB limit
- Photos compressed via canvas before storage (800px max, JPEG 0.7 quality → ~100-200KB)
- `visitsRef` in App.jsx parsed once on mount, hydrated into venues after ghost filter
- `getVisitStats()` in visits.js computes `{total, bar, cafe, ice_cream, restaurant, photos, notes}` from stored data
- `getVisitedVenues(type)` in visits.js reconstructs full venue objects from saved visits for a given type — used to inject visited venues into the map regardless of search area
- `getAllVisitedVenues()` in visits.js returns all visited venues across all types (no lat/lng requirement) — used by Passport panel
- `backfillVisitTypes(venues)` in visits.js patches old localStorage entries that lack `type`, `name`, or `lat`/`lng` fields using venue data; called after venue fetches to fix missing metadata

**PWA Support**
- Installable on iPhone/Android via vite-plugin-pwa
- Service worker for offline caching
- App manifest with theme color and icons
- Custom `getUserMedia` camera overlay (`CameraOverlay.jsx`) bypasses iOS standalone PWA black screen bug with native `<input capture>`. Requires HTTPS or localhost (`navigator.mediaDevices` unavailable in insecure contexts). Graceful fallback: permission denied → toast with Settings guidance; insecure context → toast explaining HTTPS requirement.

**Other**
- Toast notifications on check-in
- Inline styles throughout (no CSS files or Tailwind)
- Cloudflare Worker proxy for Foursquare API (CORS workaround)

---

## File Structure

```
src/
├── App.jsx                      — Main orchestration: all state, effects, JSX layout
├── constants.js                 — VENUE_TYPES (type switcher), ACHIEVEMENTS (gamification)
├── api/
│   ├── cache.js                 — localStorage cache (7-day TTL) + ghost venue filter
│   ├── overpass.js              — OpenStreetMap venue fetching (free, no key)
│   ├── foursquare.js            — Foursquare categories (proxied via Cloudflare Worker)
│   ├── google.js                — Google Places ratings, hours, price (direct in prod)
│   └── visits.js                — Persistent check-in storage (getVisits, addVisit, getVisitedVenues, getAllVisitedVenues, backfillVisitTypes, photo helpers)
├── components/
│   ├── MapView.jsx              — Leaflet map, venue pins, user dot, pan detection
│   ├── VenueCard.jsx            — Venue detail card (shared mobile overlay + desktop sidebar)
│   ├── ListPanel.jsx            — Scrollable venue list with distance
│   ├── AchievementsPanel.jsx    — Achievement milestones display
│   ├── PassportPanel.jsx        — Stamp-book of all visited venues (cross-type)
│   ├── BottomSheet.jsx          — Draggable bottom sheet (mobile only)
│   └── CameraOverlay.jsx       — Full-screen getUserMedia camera (iOS PWA fix)
├── hooks/
│   └── useIsDesktop.js          — Responsive breakpoint hook (≥768px)
└── utils/
    ├── distance.js              — Haversine distance calculation
    └── photo.js                 — Canvas-based photo compression (800px max, JPEG 0.7)
```

**Key principle:** State-dependent logic (effects, handlers, mergeVenues) stays in App.jsx.
Pure functions, API calls, and self-contained UI components are in their own modules.
All files use named exports; only App uses a default export.

---

## Architecture

### APIs

1. **OpenStreetMap / Overpass API** — Free, no key needed. Fetches real venue locations based on map viewport. `buildAddress()` returns street-only addresses or `" "` (space) for venues with no OSM address tags.

2. **Nominatim Reverse Geocode** — Single call per `fetchCenter` change. Returns city name (for header) and builds an `areaSuffix` string (e.g., "Austin, TX") used to enrich OSM addresses. US state names are abbreviated via a `STATE_ABBREV` map in App.jsx. The `enrichAddress(address, suffix)` helper appends the suffix only to non-blank, comma-free addresses — blank/space addresses pass through unchanged so ghost filtering still works. Enrichment runs after `filterGhostVenues()`. A `useEffect` watching `areaSuffix` re-enriches existing venues when Nominatim resolves after the venue fetch.

3. **Google Places API (New)** — Enriches venues with rating, rating count, price level, and opening hours.
   - Direct browser calls in production (CORS supported)
   - API key in GitHub repo secret `VITE_GOOGLE_PLACES_KEY`
   - HTTP referrer restrictions: `julian-reyes.github.io/*`, `julianreyes.dev/*`, `localhost:5174/*`
   - `GOOGLE_BASE` constant in `src/api/google.js` switches between `/api/google` (dev proxy) and `https://places.googleapis.com` (prod direct)

4. **Foursquare Places API** — Provides human-readable venue categories.
   - Proxied via Cloudflare Worker in production (Foursquare blocks CORS)
   - Worker URL: `https://fsq-proxy.city-quest.workers.dev`
   - Worker source: `workers/fsq-proxy/worker.js`
   - API key stored as Cloudflare secret `FSQ_API_KEY` (NOT in GitHub secrets — worker handles auth)
   - `FSQ_BASE` constant in `src/api/foursquare.js` switches between `/api/fsq` (dev proxy) and the worker URL (prod)
   - Redeploy worker: `cd workers/fsq-proxy && wrangler deploy`
   - Allowed origins: `julian-reyes.github.io`, `julianreyes.dev`, `localhost:5174`, `localhost:5173`

### Photos & Reviews — CURRENTLY DISABLED
Photos and reviews are commented out to save API costs. See `REIMPLEMENT_PHOTOS_REVIEWS.md` for a step-by-step guide to re-enable them (with cost breakdown and partial re-enable options). When re-enabled, also apply CSS image filters (TODO in that file).

### API Response Cache
- Google + Foursquare API responses cached in localStorage under key `cityquest_api_cache`
- 7-day TTL — entries auto-expire and re-fetch from API
- `null` results cached too (prevents re-fetching venues that don't exist in Google/Foursquare)
- Helpers: `getApiCache(venueId, source)` / `setApiCache(venueId, source, data)` in `src/api/cache.js`
- `undefined` = cache miss, `null` = API returned no match (important distinction)

### Ghost Venue Filtering
OSM returns stale/extinct venues that don't correspond to real businesses. A venue is a **ghost** when Google returns `null` (no match or >300m distance rejection) or `{ closed: true }` (permanently closed). Any venue without a valid Google match is hidden — OSM address alone is not enough to keep a venue visible.

**Rejection rules (google.js):**
- **Distance gate:** If Google's best text match is >300m from the OSM coordinates, the entire result is rejected (returns `null`). Prevents showing data from a different business with a similar name.
- **Permanently closed:** If `businessStatus === "CLOSED_PERMANENTLY"`, returns `{ closed: true }` (distinct from `null` for cache differentiation).

**How it works:**
- `filterGhostVenues(venues)` in `src/api/cache.js` — batch filter used during OSM fetch and `mergeVenues`. Parses localStorage cache **once** for the whole array. Removes venues where cached Google data is `null` or `{ closed: true }`.
- `typeVenues` useMemo in `App.jsx` — checks `v.googleData === null || v.googleData?.closed` in-memory (fast, no localStorage). Hides ghosts from both map and list instantly.
- Google Places useEffect in `App.jsx` — when a ghost is detected (fresh API call or cache hit) and venue is not already visited, sets `googleData` on the venue, closes the venue card, and shows a toast. Visited venues are never hidden.
- Ghost venues are never visible but stay in the raw `venues` array until the next OSM fetch filters them out.

**Flow:**
1. First tap on ghost → Google API called, returns `null` or `{ closed: true }` → venue card closes with toast, ghost hidden in `typeVenues`
2. Reload / revisit area → `filterGhostVenues` reads cache and strips ghost before it enters state

**Critical ordering — city/state enrichment:** `enrichAddress()` must run AFTER `filterGhostVenues()`. Ghost venues have `address: " "` (space). If enriched first, they'd get a city/state suffix and survive the `address.trim() === ""` check. The `enrichAddress` helper also guards this by returning blank addresses unchanged, but the ordering provides defense in depth.

**Remaining gap — name validation:** Google text search can match a different business with a similar name within 300m. `places.displayName` is not currently requested in the field mask, so there's no way to verify the name matches. Adding name validation would require requesting `displayName` and implementing fuzzy name comparison.

### Env Setup (local dev)
- `.env` lives in `../secret/` (sibling directory to repo) — keeps keys out of git
- `vite.config.js` uses `envDir: process.env.CI ? "." : "../secret"` — reads from repo root in CI, sibling folder locally
- Required env vars: `VITE_FOURSQUARE_API_KEY`, `VITE_GOOGLE_PLACES_KEY`

### Dev Proxies (vite.config.js)
- `/api/fsq` → `https://places-api.foursquare.com`
- `/api/google` → `https://places.googleapis.com`

### Deployment
- GitHub Pages via `.github/workflows/deploy.yml`
- Custom domain: `julianreyes.dev`
- Workflow injects API keys from GitHub repo secrets into `.env` before build
- Only `VITE_GOOGLE_PLACES_KEY` is required as a GitHub repo secret (Foursquare key handled by Cloudflare Worker)

---

## Tech Stack
- **Framework**: React (Vite)
- **Styling**: Inline styles (no CSS files, no Tailwind)
- **Map**: react-leaflet + leaflet, CartoDB dark tiles
- **Venue data**: Overpass API + Google Places API + Foursquare Places API
- **Storage**: localStorage
- **Photo EXIF**: exifr
- **Font**: DM Mono (monospace)
- **PWA**: vite-plugin-pwa

---

## Key Design Decisions
- Dark theme (`#0f0f1a` background)
- Amber (`#f59e0b`) primary accent
- Monospace font (`DM Mono`) for arcade/game feel
- Green (`#22c55e`) for visited/completed states
- Glassmorphism: `rgba(255,255,255,0.05)` backgrounds + `backdropFilter: blur()`
- All animations via CSS keyframes (slideUp, pop, fadeIn, spin)
- No external UI component libraries

---

## Project Files
- `src/` — App source code (see File Structure above)
- `REIMPLEMENT_PHOTOS_REVIEWS.md` — Guide to re-enable photos and reviews (with cost breakdown)
- `SCALING_PLAN.md` — Future scaling plan: freemium model, caching, cost projections
- `SPLIT_APP_PLAN.md` — Original plan for splitting App.jsx into modules (completed)
- `workers/fsq-proxy/` — Cloudflare Worker source for Foursquare proxy
- `.env.example` — Template for required env vars


## TO DO

### 1. Persistent Storage — DONE
Check-ins persist to localStorage via `src/api/visits.js` and `src/utils/photo.js`. Venues hydrated from storage on mount, support repeat check-ins with visit count display. See **Persistence** section above for details.

### 2. Per-Category & Activity Achievements — DONE
Category-specific milestones (Bar Fly, Coffee Snob, Sweet Tooth, Food Critic) and activity achievements (Photographer, Chronicler) implemented alongside global milestones. Achievements panel now renders in three sections. Visit data stores `venueType` for per-category counting. See **Achievements Panel** section above for full list.

### 3. Gamification Ideas (not yet implemented)

**Streaks** — Track consecutive daily check-ins in localStorage (`lastCheckinDate`, `currentStreak`). Show 🔥 streak counter in header. Add achievements for 3/7/30-day streaks.

**XP / Level System** — Replace raw visit count with XP points. Base XP per check-in + bonuses: photo (+5), note (+3), first visit of a type (+10), revisit (+2). Display player level (Explorer → Veteran → Legend) in header.

**Time / Combo Badges** — One-off badges using existing visit timestamps: Night Owl (check in after midnight), Early Bird (before 9am), City Sampler (all 4 types in one day).

**Neighborhood Completion** — Group venues by lat/lng grid tile. Show per-neighborhood progress in list view (e.g. "Downtown: 4/12").

**Rarity Tiers** — Use Foursquare sub-categories to tag rare venues (Speakeasy, Jazz Bar, Roastery) as ⭐ rare — worth bonus XP or a special card badge.

### 4. Fix Inaccurate OSM Coordinates
Some OSM venues (especially from bulk imports like SanGIS) have inaccurate coordinates. When Google finds the correct business but it's >300m from the OSM pin, the distance gate rejects the result, causing the venue to be ghost-filtered.

**Proposed fix:**
- Request `places.displayName` in the Google field mask
- If the Google name fuzzy-matches the OSM name, allow a larger distance threshold (e.g., 2km instead of 300m)
- When a match is accepted, relocate the venue's map pin to Google's coordinates (more accurate)
- This fixes venues like "Kellys Pub" where OSM has bad coords but Google knows the real location

**Example:** Kelly's Pub (OSM node 365318102) — OSM coords are off, Google finds the real location but >300m away, distance gate rejects → venue loses Google data → ghost-filtered because no OSM address.

### 5. Cache Version Invalidation
When ghost filter logic changes, browsers with old cached Google data can show stale results (e.g., ghost venues appearing with old rating/hours). Currently requires manual `localStorage.removeItem('cityquest_api_cache')`.

**Proposed fix:**
- Add a `CACHE_VERSION` constant to `src/api/cache.js`
- Store version as `_version` key inside the cache object
- On read (`getApiCache`, `filterGhostVenues`): if version mismatch, wipe cache and return miss
- On write (`setApiCache`): stamp `_version` on every write
- Bump `CACHE_VERSION` whenever ghost filter logic changes to auto-invalidate old entries

### 6. Passport UI — DONE
Stamp-book panel showing all visited venues across all types. Circular ink-stamp design with dashed borders and per-stamp rotation. Grouped by type in flex-wrap layout, type breakdown pills, and map mode showing only visited pins. See **Passport Panel** section above for details.
