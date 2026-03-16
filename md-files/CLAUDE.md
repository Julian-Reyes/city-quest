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
- Header with venue type name, visited count, and completion percentage
- Venue type switcher (Bars 🍺 / Coffee ☕ / Ice Cream 🍦 / Food 🍔)
- Animated progress bar showing % of venues visited
- Bottom nav with Map / List / Achievements tabs
- Responsive layout: mobile (stacked) and desktop (two-column with sidebar)

**Map View**
- Leaflet map via `react-leaflet` with CartoDB dark tiles
- Shows venue pins (amber = unvisited, green = visited) with user's blue location dot
- "Search this area" button to load venues when panning to new areas
- Geolocation requested on load

**Real Venue Data (3 API sources)**
- **Overpass API (OpenStreetMap)** — fetches real venue locations (name, address, coords) based on map viewport. Free, no key needed.
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
- `backfillVisitTypes(venues)` in visits.js patches old localStorage entries that lack a `type` field using venue data; called after venue fetches to fix per-category undercounting

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
│   └── visits.js                — Persistent check-in storage (getVisits, addVisit, getVisitedVenues, backfillVisitTypes, photo helpers)
├── components/
│   ├── MapView.jsx              — Leaflet map, venue pins, user dot, pan detection
│   ├── VenueCard.jsx            — Venue detail card (shared mobile overlay + desktop sidebar)
│   ├── ListPanel.jsx            — Scrollable venue list with distance
│   ├── AchievementsPanel.jsx    — Achievement milestones display
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

1. **OpenStreetMap / Overpass API** — Free, no key needed. Fetches real venue locations based on map viewport.

2. **Google Places API (New)** — Enriches venues with rating, rating count, price level, and opening hours.
   - Direct browser calls in production (CORS supported)
   - API key in GitHub repo secret `VITE_GOOGLE_PLACES_KEY`
   - HTTP referrer restrictions: `julian-reyes.github.io/*`, `julianreyes.dev/*`, `localhost:5174/*`
   - `GOOGLE_BASE` constant in `src/api/google.js` switches between `/api/google` (dev proxy) and `https://places.googleapis.com` (prod direct)

3. **Foursquare Places API** — Provides human-readable venue categories.
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
OSM returns stale/extinct venues that don't correspond to real businesses. A venue is a **ghost** when Google returns `null` AND it has no OSM address (`address === " "`).

**Distance gate (google.js):** If Google's best text match is >300m from the OSM coordinates, the entire result is rejected (returns `null`). This prevents showing rating/hours/price from a different business that happens to share a similar name. Previously only the address was nulled — now the full result is discarded.

**How it works:**
- `filterGhostVenues(venues)` in `src/api/cache.js` — batch filter used during OSM fetch and `mergeVenues`. Parses localStorage cache **once** for the whole array (not per-venue, which caused crashes).
- `typeVenues` useMemo in `App.jsx` — checks `v.googleData === null && no address` in-memory (fast, no localStorage). Hides ghosts from both map and list instantly.
- Google Places useEffect in `App.jsx` — when a ghost is detected (fresh API call or cache hit), sets `googleData: null` on the venue, closes the venue card, and shows a toast.
- Ghost venues are never visible but stay in the raw `venues` array until the next OSM fetch filters them out.

**Flow:**
1. First tap on ghost → Google API called, returns null (no match or >300m) → venue card closes with toast, ghost hidden in `typeVenues`
2. Reload / revisit area → `filterGhostVenues` reads cache and strips ghost before it enters state

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

**Passport UI** — Replace achievements panel with a visual stamp-book. Each stamp = a completed milestone or category. More tactile than a progress list.
