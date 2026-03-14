# City Quest

## City Quest is a website that gamifies Bars, Restaurants, Cafes, even Ice Cream Shops in your local area, turning into a fun interactive experience. Inspired by traveling to different cities and wanting to hit all the bars, cafes, and gelato shops within walking distance of my AirBnbs. Check into different venues and unlock achievements    

**Live at**: https://julianreyes.dev/city-quest/

---

## Features

- **Interactive map** — Leaflet map with CartoDB dark tiles, amber/green venue pins, and a blue user location dot
- **4 venue types** — Bars, Coffee, Ice Cream, Food (toggle between them)
- **Real venue data** — OpenStreetMap for discovery, enriched with Google Places (rating, hours, price) and Foursquare (categories) on tap
- **Ghost venue filtering** — Stale/extinct OSM venues are automatically hidden when Google can't find a match
- **Check-in flow** — Tap a pin, view the venue card, check in with an optional note and photo
- **Achievements** — 5 milestones unlocked by total visit count, with full-screen celebration animations
- **Persistent state** — Check-ins saved to localStorage, survive page refresh
- **"Search this area"** — Button appears when you pan the map, loads venues for the new area
- **PWA** — Installable on iPhone/Android, service worker for offline caching
- **Responsive** — Mobile (full-screen map + bottom sheet) and desktop (two-column map + sidebar)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React (Vite) |
| Map | react-leaflet + leaflet, CartoDB dark tiles |
| Venue discovery | Overpass API (OpenStreetMap) — free, no key |
| Venue enrichment | Google Places API (New), Foursquare Places API |
| Styling | Inline styles (no CSS files, no Tailwind) |
| Storage | localStorage |
| Font | DM Mono |
| PWA | vite-plugin-pwa |
| Foursquare proxy | Cloudflare Worker (`workers/fsq-proxy/`) |

---

## Local Development

```bash
npm install
npm run dev
```

Env vars go in `../secret/.env` (a sibling directory to the repo — keeps keys out of git):

```
VITE_FOURSQUARE_API_KEY=your_key
VITE_GOOGLE_PLACES_KEY=your_key
```

Dev proxies are configured in `vite.config.js`:
- `/api/fsq` → Foursquare
- `/api/google` → Google Places

---

## Deployment

GitHub Pages via `.github/workflows/deploy.yml`. The workflow injects `VITE_GOOGLE_PLACES_KEY` from GitHub repo secrets. Custom domain: `julianreyes.dev`.

Foursquare API key is stored as a Cloudflare secret on the Worker — not in GitHub. To redeploy the worker: `cd workers/fsq-proxy && wrangler deploy`.

---

## Project Docs

| File | Purpose |
|---|---|
| `CLAUDE.md` | Full architecture guide for AI-assisted development |
| `VENUE_MATCHING.md` | OSM data quality problem + solution options |
| `SCALING_PLAN.md` | Cost projections and freemium model plan |
| `SPLIT_APP_PLAN.md` | Plan to break App.jsx into modules |
| `REIMPLEMENT_PHOTOS_REVIEWS.md` | How to re-enable photos/reviews (currently disabled to save API costs) |
| `GOOGLE_CLOUD_BILLING.md` | API quota and billing setup |
