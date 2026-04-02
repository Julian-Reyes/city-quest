Debug why a venue isn't showing correctly in City Quest: $ARGUMENTS

Walk through the 3-API enrichment pipeline to diagnose the issue. Read the relevant API modules first.

### Step 1: Overpass (OSM) — `src/api/overpass.js`
- Check if the venue exists in OpenStreetMap by examining the Overpass query for the venue's type
- Note the coordinates and tags OSM returns
- If the venue isn't in OSM at all, that's the root cause — it needs to be added to OpenStreetMap

### Step 2: Google Places — `src/api/google.js`
- Check how `fetchGooglePlaceDetails(name, lat, lng)` would match this venue
- The 300m distance gate: if Google's coordinates are >300m from OSM's coordinates, the venue is rejected
- If Google returns `null` or `businessStatus: "CLOSED_PERMANENTLY"`, the venue is filtered as a ghost
- Read `src/api/cache.js` — check `filterGhostVenues()` logic and whether a `null` result is cached (7-day TTL)

### Step 3: Foursquare — `src/api/foursquare.js`
- Check if Foursquare can match the venue for category data
- This goes through the Cloudflare Worker proxy at `fsq-proxy.city-quest.workers.dev`

### Common diagnoses:
- **Ghost venue**: OSM has it, but Google says it's closed or can't find it → filtered by `filterGhostVenues()`
- **Distance gate rejection**: OSM coords are inaccurate, Google match is >300m away → rejected in `fetchGooglePlaceDetails`
- **Stale cache**: A previous `null` result is cached → venue won't show until cache expires (7 days) or cache is cleared
- **Missing from OSM**: Venue doesn't exist in OpenStreetMap data → not returned by Overpass query
- **Wrong OSM tags**: Venue exists in OSM but tagged differently than what the Overpass query expects

Report the diagnosis clearly and suggest a fix.
