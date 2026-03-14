# City Quest — Project Guide

## What This App Is
A mobile-first PWA that gamifies exploring your city. Users discover bars, coffee shops, ice cream shops, and restaurants on a map, check in when they visit, and unlock achievements. Think Pokémon GO but for real-world venues.

**Live at**: https://julianreyes.dev/city-quest/
**Repo**: Julian-Reyes/city-quest

---

## What's Already Built

### File: `src/App.jsx`
A single-file React app (Vite project) with the following working:

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
  - Optional photo (wired to `<input capture="environment">` for camera)
  - Confirm button that marks venue as visited with timestamp

**Achievements Panel**
- 5 achievements based on total visit count (1, 5, 10, 20, 50)
- Full-screen celebration animation when one is unlocked
- Progress shown for locked achievements

**Persistence**
- All check-in state saved to localStorage (survives page refresh)
- Venue visits, notes, and photos persist across sessions

**PWA Support**
- Installable on iPhone/Android via vite-plugin-pwa
- Service worker for offline caching
- App manifest with theme color and icons

**Other**
- Toast notifications on check-in
- Inline styles throughout (no CSS files or Tailwind)
- Cloudflare Worker proxy for Foursquare API (CORS workaround)

---

## Architecture

### APIs

1. **OpenStreetMap / Overpass API** — Free, no key needed. Fetches real venue locations based on map viewport.

2. **Google Places API (New)** — Enriches venues with rating, rating count, price level, and opening hours.
   - Direct browser calls in production (CORS supported)
   - API key in GitHub repo secret `VITE_GOOGLE_PLACES_KEY`
   - HTTP referrer restrictions: `julian-reyes.github.io/*`, `julianreyes.dev/*`, `localhost:5174/*`
   - `GOOGLE_BASE` constant switches between `/api/google` (dev proxy) and `https://places.googleapis.com` (prod direct)

3. **Foursquare Places API** — Provides human-readable venue categories.
   - Proxied via Cloudflare Worker in production (Foursquare blocks CORS)
   - Worker URL: `https://fsq-proxy.city-quest.workers.dev`
   - Worker source: `workers/fsq-proxy/worker.js`
   - API key stored as Cloudflare secret `FSQ_API_KEY` (NOT in GitHub secrets — worker handles auth)
   - `FSQ_BASE` constant switches between `/api/fsq` (dev proxy) and the worker URL (prod)
   - Redeploy worker: `cd workers/fsq-proxy && wrangler deploy`
   - Allowed origins: `julian-reyes.github.io`, `julianreyes.dev`, `localhost:5174`, `localhost:5173`

### Photos & Reviews — CURRENTLY DISABLED
Photos and reviews are commented out to save API costs. See `REIMPLEMENT_PHOTOS_REVIEWS.md` for a step-by-step guide to re-enable them (with cost breakdown and partial re-enable options). When re-enabled, also apply CSS image filters (TODO in that file).

### API Response Cache
- Google + Foursquare API responses cached in localStorage under key `cityquest_api_cache`
- 7-day TTL — entries auto-expire and re-fetch from API
- `null` results cached too (prevents re-fetching venues that don't exist in Google/Foursquare)
- Helpers: `getApiCache(venueId, source)` / `setApiCache(venueId, source, data)` in App.jsx
- `undefined` = cache miss, `null` = API returned no match (important distinction)

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
- `REIMPLEMENT_PHOTOS_REVIEWS.md` — Guide to re-enable photos and reviews (with cost breakdown)
- `SCALING_PLAN.md` — Future scaling plan: freemium model, caching, cost projections
- `workers/fsq-proxy/` — Cloudflare Worker source for Foursquare proxy
- `.env.example` — Template for required env vars


## TO DO
### 1. Persistent Storage
Currently all check-in state is lost on page refresh. Add persistence using `localStorage`:
- Key: `cityquest_visited`
- Value: JSON array of `{ id, visitedAt, note, photo }`
- On app load, merge saved visits into venue state
- On check-in, update localStorage immediately


### 1. Persistent Storage
Currently all check-in state is lost on page refresh. Add persistence using `localStorage`:
- Key: `cityquest_visited`
- Value: JSON array of `{ id, visitedAt, note, photo }`
- On app load, merge saved visits into venue state
- On check-in, update localStorage immediately
- Allow user to check in to the same venu multiple times, should display total times visited on card
