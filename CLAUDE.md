# City Quest — Project Brief for Claude Code

## What This App Is
A mobile-first web app that gamifies exploring your city. Users can discover bars, coffee shops, ice cream shops, and restaurants near them on a map, check in when they visit, and unlock achievements. Think Pokémon GO but for real-world venues.

---

## Current State (What's Already Built)

### File: `src/App.jsx`
A single-file React app (Vite project) with the following already working:

**UI & Navigation**
- Header with venue type name, visited count, and completion percentage
- Venue type switcher (Bars 🍺 / Coffee ☕ / Ice Cream 🍦 / Food 🍔)
- Animated progress bar showing % of venues visited
- Bottom nav with Map / List / Achievements tabs

**Map View**
- Leaflet map loads and works correctly via CDN script injection
- Shows venue pins (amber = unvisited, green = visited) with user's blue location dot
- Location is inaccurate on mobile (shows wrong city) — see fix in section 1

**List View**
- Shows all venues for the active type
- Visited venues shown with green highlight and checkmark
- Tapping a venue switches to map and selects it

**Check-in Flow**
- Venue card slides up from bottom when a pin is tapped
- Shows name, address, rating, review count
- "Check In Here" button opens a modal with:
  - Optional text note
  - Optional photo (wired to `<input capture="environment">` for camera)
  - Confirm button that marks venue as visited with timestamp

**Achievements Panel**
- 5 achievements based on total visit count (1, 5, 10, 20, 50)
- Full-screen celebration animation when one is unlocked
- Progress shown for locked achievements

**Other**
- Toast notifications on check-in
- Geolocation requested on load
- Inline styles throughout (no CSS files or Tailwind)
- Mock venue data generated around user's coordinates (fake names, randomized positions)

---

## What Still Needs To Be Built


### ✅ 1. Real Venue Data via Google Places API (HIGHEST PRIORITY)
Replace `generateMockVenues()` with real API calls. The function currently takes `(lat, lng, type)` and returns an array of venue objects shaped like:
```js
{
  id: string,
  name: string,
  type: "bar" | "cafe" | "ice_cream" | "restaurant",
  lat: number,
  lng: number,
  rating: number,
  reviews: number,
  address: string,
  visited: boolean,
  visitedAt: string | null,
  photo: string | null,
  note: string
}
```
Use Google Places Nearby Search API. Map Place types:
- `bar` → `bar`
- `cafe` → `cafe`
- `ice_cream` → `ice_cream_shop`
- `restaurant` → `restaurant`

API key should go in a `.env` file as `VITE_GOOGLE_PLACES_KEY`.


### ✅ 2. Responsive Desktop (and mobile) Layout
The app currently renders in a narrow mobile column on desktop. Fix this with a proper two-column desktop layout:
- Below `768px`: current mobile layout (full width, stacked)
- Above `768px`: two-column layout — map takes up the left ~60%, and the sidebar (venue list or achievements panel) takes the right ~40%
- On desktop, the List and Achievements panels should render in the sidebar permanently alongside the map, not replace it
- The venue card that slides up on mobile should instead appear in the sidebar on desktop
- Max width of ~1400px, centered, so it doesn't stretch absurdly wide on large monitors
- Use CSS media queries or a `useWindowSize` hook to detect breakpoint
- Note: Also has issues on mobile - on my iphone when I look at it on the localhost link it seemss to be getting cut off - the app doesn't stretch the width of the iphone screen.

### ✅ 3. Fix the Map 
The current map uses dynamic CDN script injection which may not work reliably becuase it depends on unpkg.com being online every time the app loads. If that CDN goes down, the map breaks. Replace with a proper Leaflet integration:
```bash
npm install leaflet react-leaflet
```
Use `react-leaflet` components (`MapContainer`, `TileLayer`, `Marker`, `Popup`) instead of the manual imperative approach in `MapView`. Use CartoDB dark tiles:
```
https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png
```
Custom markers: small colored circles (amber for unvisited, green for visited) using `L.divIcon`.

### 4. Fix Location Accuracy on Mobile 
The map itself is working. The issue is that on mobile (when I connect to localhost on my phone using my computer IP on the same wifi network) the geolocation returns an inaccurate position (shows San Francisco instead of actual location in San Diego)

### 5. Persistent Storage
Currently all check-in state is lost on page refresh. Add persistence using `localStorage`:
- Key: `cityquest_visited`
- Value: JSON array of `{ id, visitedAt, note, photo }`
- On app load, merge saved visits into venue state
- On check-in, update localStorage immediately

### ✅ 6. PWA Support
Add a `manifest.json` and service worker so the app installs on iPhone/Android:
- App name: "City Quest"
- Theme color: `#0f0f1a`
- Background color: `#0f0f1a`
- Display: `standalone`
- Icons: generate a simple emoji-based icon at 192x192 and 512x512

TODO: ### 7. Add venue details via Foursquare Places API (next session)                                        
                                                                                                       
 Context

 Venue cards currently only show name and address. Adding Foursquare data (photos, category, price,
 rating, hours, tips) will make venues feel real and help users decide where to go.

 File to modify

 /Users/apple/Documents/GitHub/city-quest/src/App.jsx

 Setup

 1. Sign up at https://foursquare.com/developers
 2. Create a project, get an API key
 3. Create .env file in project root:
 VITE_FOURSQUARE_API_KEY=your_key_here

 Implementation

 1. Foursquare fetch function

 Single function fetchFoursquareDetails(name, lat, lng) that:
 - Searches: GET /v3/places/search?ll={lat},{lng}&query={name}&limit=1
   - Returns: fsq_id, categories, price, rating, hours, location
 - Fetches photo: GET /v3/places/{fsq_id}/photos?limit=1
 - Fetches tips: GET /v3/places/{fsq_id}/tips?limit=1
 - Returns an object:
 {
   photo: "https://...",           // "300x200" sized photo URL
   category: "Cocktail Bar",      // primary category name
   price: 3,                      // 1-4 scale ($ to $$$$)
   rating: 8.4,                   // out of 10
   hours: { open_now: true, display: "Open until 2 AM" },
   tip: "Try the Old Fashioned",  // top user tip
 }

 2. Fetch on venue selection

 - When user taps a venue, check if it already has fsqData
 - If not, fetch from Foursquare and store on the venue object
 - Cache result so re-selecting doesn't re-fetch
 - Graceful fallback if API key missing or request fails

 3. Update VenueCard layout

 After venue name/address, add a details row:

 ┌─────────────────────────┐
 │ Venue Name            × │
 │ 123 Main Street         │
 │ Cocktail Bar · $$$ · 8.4│
 │ 🟢 Open until 2 AM      │
 │ ┌─────────────────────┐ │
 │ │     [photo]         │ │
 │ └─────────────────────┘ │
 │ "Try the Old Fashioned" │
 │ [📍 Check In Here]      │
 └─────────────────────────┘

 - Category + price: "Cocktail Bar · $$$" — price as dollar signs
 - Rating: small badge, e.g. "⭐ 8.4"
 - Hours: green/red dot + status text
 - Photo: full width, 200px max height (existing style)
 - Tip: italic quote below photo
 - All fields optional — only show what's available

 4. State management

 - Add fsqData field to venue objects (default null)
 - When fetched, update venue in venues array via setVenues
 - Persists in venueCacheRef

 Verification

 1. Add API key to .env, restart dev server
 2. Tap a venue — card should show category, price, rating, hours, photo, tip
 3. Fields that Foursquare doesn't have for a venue should gracefully not appear
 4. Re-selecting same venue loads instantly (cached)
 5. Works on both mobile and desktop
 6. No errors if API key is missing


---

## Tech Stack
- **Framework**: React (Vite)
- **Styling**: Inline styles (keep consistent, no Tailwind or CSS modules)
- **Map**: react-leaflet + leaflet
- **Venue data**: Google Places API
- **Storage**: localStorage
- **Photo EXIF**: exifr
- **Font**: DM Mono (already referenced in inline styles)

---

## Key Design Decisions to Preserve
- Dark theme (`#0f0f1a` background) throughout
- Amber (`#f59e0b`) as the primary accent color
- Monospace font (`DM Mono`) for the arcade/game feel
- Green (`#22c55e`) for visited/completed states
- All animations via CSS keyframes (slideUp, pop, fadeIn, spin)
- No external UI component libraries

---

## Suggested First Prompt for Claude Code
> "Start by doing #1 - Real Venue Data via Google Places API."
