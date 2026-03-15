# Split App.jsx into Modules — COMPLETED

> This plan has been fully implemented. Kept as a reference for the decisions made during the split.

## Context
`src/App.jsx` was ~2000 lines — a single-file React app containing all constants, API functions, components, hooks, utilities, and the main App component. It was split into 12 modules to improve navigability and maintainability.

## Final File Structure

```
src/
├── App.jsx              (1036 lines) — orchestration: all state, effects, handlers, JSX layout
├── constants.js            (53 lines) — VENUE_TYPES, ACHIEVEMENTS
├── api/
│   ├── cache.js            (62 lines) — localStorage cache + ghost venue filter
│   ├── overpass.js          (55 lines) — buildAddress, fetchVenues
│   ├── foursquare.js        (85 lines) — FSQ_BASE, fetchFoursquareDetails
│   └── google.js           (114 lines) — GOOGLE_BASE, GOOGLE_PRICE_MAP, fetchGooglePlaceDetails
├── components/
│   ├── MapView.jsx         (131 lines) — RecenterMap, MapMoveDetector, MapView, venueIcon, userIcon
│   ├── VenueCard.jsx       (202 lines) — VenueCard
│   ├── ListPanel.jsx       (116 lines) — ListPanel
│   ├── AchievementsPanel.jsx (106 lines) — AchievementsPanel
│   └── BottomSheet.jsx     (149 lines) — BottomSheet (drag-to-expand, mobile only)
├── hooks/
│   └── useIsDesktop.js      (24 lines) — useIsDesktop (≥768px breakpoint)
└── utils/
    └── distance.js          (19 lines) — distanceMiles (haversine)
```

## Rules Followed
- All files use `.js`/`.jsx` (no TypeScript — project doesn't use it)
- Named exports for everything, default export only for App
- All inline styles kept as-is (no CSS extraction — that's a separate task)
- `isDev` constant defined locally in both `foursquare.js` and `google.js` (one line each, not worth a shared util)
- State-dependent functions (`mergeVenues`, `handleCheckin`, `handleSearchArea`, `applyGoogleData`, effects) stay in App.jsx
- Each extracted file has a header comment explaining what it does and why it exists

## Dependencies Between Modules
```
constants.js          ← no deps (pure data)
utils/distance.js     ← no deps (pure function)
hooks/useIsDesktop.js ← React only
api/cache.js          ← no deps (localStorage only)
api/overpass.js       ← no deps (fetch only)
api/foursquare.js     ← api/cache.js
api/google.js         ← api/cache.js
components/MapView.jsx          ← constants, utils/distance, leaflet, react-leaflet
components/VenueCard.jsx        ← no deps (receives all data via props)
components/ListPanel.jsx        ← constants, utils/distance
components/AchievementsPanel.jsx ← constants
components/BottomSheet.jsx      ← React only
App.jsx ← imports all of the above
```
No circular dependencies.

## Verification
- `npx vite build` passes with clean output
- All 12 modules extracted, App.jsx reduced from ~2000 to ~1036 lines
