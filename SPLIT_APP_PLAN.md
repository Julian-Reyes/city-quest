# Plan: Split App.jsx into Modules

## Context
`src/App.jsx` is 1938 lines — a single-file React app containing all constants, API functions, components, hooks, utilities, and the main App component. It's becoming hard to navigate and maintain. Time to split into logical modules while keeping the same behavior.

## File Structure

```
src/
├── App.jsx                  (~650 lines → orchestration, state, effects, JSX)
├── constants.js             — VENUE_TYPES, ACHIEVEMENTS
├── api/
│   ├── cache.js             — CACHE_KEY, CACHE_TTL, getApiCache, setApiCache
│   ├── overpass.js          — buildAddress, fetchVenues
│   ├── foursquare.js        — FSQ_BASE, fetchFoursquareDetails
│   └── google.js            — GOOGLE_BASE, GOOGLE_PRICE_MAP, fetchGooglePlaceDetails
├── components/
│   ├── MapView.jsx          — RecenterMap, MapMoveDetector, MapView, venueIcon, userIcon
│   ├── VenueCard.jsx        — VenueCard
│   ├── ListPanel.jsx        — ListPanel
│   ├── AchievementsPanel.jsx — AchievementsPanel
│   └── BottomSheet.jsx      — BottomSheet
├── hooks/
│   └── useIsDesktop.js      — useIsDesktop
└── utils/
    └── distance.js          — distanceMiles
```

## Approach

**Order of extraction** (each step: cut from App.jsx, create new file, add import, verify build):

1. `utils/distance.js` — standalone, no deps
2. `constants.js` — standalone
3. `hooks/useIsDesktop.js` — standalone
4. `api/cache.js` — standalone
5. `api/overpass.js` — depends on nothing external
6. `api/foursquare.js` — depends on cache
7. `api/google.js` — depends on cache
8. `components/BottomSheet.jsx` — standalone React component
9. `components/AchievementsPanel.jsx` — depends on constants
10. `components/ListPanel.jsx` — depends on distance
11. `components/VenueCard.jsx` — standalone
12. `components/MapView.jsx` — depends on distance (for icon sizing)

## What Goes Where

### `utils/distance.js` (lines 616–625)
- `distanceMiles(lat1, lng1, lat2, lng2)` — haversine distance calculation
- Named export

### `constants.js` (lines 13–56)
- `VENUE_TYPES` — array of 4 venue type objects
- `ACHIEVEMENTS` — array of 5 achievement objects
- Named exports

### `hooks/useIsDesktop.js` (lines 412–423)
- `useIsDesktop()` — media query hook (≥768px)
- Named export

### `api/cache.js` (lines 58–77)
- `CACHE_KEY = "cityquest_api_cache"`
- `CACHE_TTL = 7 * 24 * 60 * 60 * 1000`
- `getApiCache(venueId, source)` — retrieves cached data, respects TTL
- `setApiCache(venueId, source, data)` — stores data with timestamp
- Named exports

### `api/overpass.js` (lines 79–122)
- `buildAddress(tags)` — parses OSM address tags
- `fetchVenues(lat, lng, type, signal)` — queries Overpass API
- Named exports

### `api/foursquare.js` (lines 124–199)
- Define `isDev` locally (one line)
- `FSQ_BASE` constant
- `fetchFoursquareDetails(name, lat, lng)` — searches Foursquare
- Import `getApiCache`, `setApiCache` from `./cache`
- Named exports

### `api/google.js` (lines 201–296)
- Define `isDev` locally (one line)
- `GOOGLE_BASE` constant
- `GOOGLE_PRICE_MAP` constant
- `fetchGooglePlaceDetails(name, lat, lng)` — searches Google Places
- Import `getApiCache`, `setApiCache` from `./cache`
- Named exports

### `components/MapView.jsx` (lines 298–409)
- `venueIcon(venue, isSelected, isMobile)` — creates Leaflet divIcon
- `userIcon(isMobile)` — creates Leaflet divIcon for user dot
- `RecenterMap` component
- `MapMoveDetector` component
- `MapView` component (default or named export)
- Imports: leaflet, react-leaflet, distanceMiles (for haversine in MapMoveDetector)

### `components/VenueCard.jsx` (lines 425–613)
- `VenueCard` component with all inline styles
- Named export

### `components/ListPanel.jsx` (lines 628–730)
- `ListPanel` component
- Import `distanceMiles` from `../utils/distance`
- Named export

### `components/AchievementsPanel.jsx` (lines 732–824)
- `AchievementsPanel` component
- Import `ACHIEVEMENTS` from `../constants`
- Named export

### `components/BottomSheet.jsx` (lines 826–957)
- `BottomSheet` component (drag-to-expand bottom sheet)
- Named export

### `App.jsx` (remaining ~650 lines)
- All imports from new modules
- All `useState`, `useRef`, `useMemo`, `useCallback`, `useEffect` hooks
- `mergeVenues`, `handleSearchArea`, `handleCheckin`, `completionPct`, `showToast` (these use App state)
- All JSX (header, type switcher, progress bar, nav tabs, map section, bottom sheet, sidebar, modals, toast, global styles)
- Default export

## Key Rules
- All files use `.js`/`.jsx` (no TypeScript — project doesn't use it)
- Named exports for everything, default export only for App
- Keep all inline styles as-is (no CSS extraction — that's a separate task)
- `isDev` constant used by both `foursquare.js` and `google.js` — define in each file (one line, not worth a shared util)
- State-dependent functions stay in App.jsx

## Verification
1. `npx vite build` passes after each extraction
2. App runs locally with same behavior
3. No circular dependencies
