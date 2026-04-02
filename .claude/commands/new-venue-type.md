Add a new venue type to City Quest: $ARGUMENTS

This requires changes across multiple files. Read each file before modifying.

### Step 1: `src/constants.js`
Add a new entry to the VENUE_TYPES array:
```js
{ id: "snake_case", label: "Display Name", emoji: "🏪", color: "#hexcolor" }
```
- The `id` is used as the stat key for visits and achievements
- Pick a color that's visually distinct from existing types (amber #f59e0b, brown #92400e, pink #ec4899, green #10b981)

### Step 2: `src/api/overpass.js`
Read the file and find where OSM tags are mapped to venue types. Add the appropriate OpenStreetMap tags for the new type. Look up correct OSM tags at https://wiki.openstreetmap.org/wiki/Map_features if unsure.

### Step 3: `src/api/visits.js`
Read `getVisitStats()` and verify the new venue type's id will be counted correctly. The function should already handle it dynamically via VENUE_TYPES, but confirm.

### Step 4 (optional): `src/constants.js`
Consider adding a category achievement for the new type in the ACHIEVEMENTS array (e.g., "Visit 5 [type]s").

### Step 5: Verify
- Run `npm run build` to ensure no build errors
- Check that the Overpass API returns results for the chosen OSM tags by reviewing the query structure
