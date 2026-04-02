Add a new achievement to City Quest: $ARGUMENTS

Read `src/constants.js` and add a new entry to the ACHIEVEMENTS array.

Achievement shape:
```js
{
  id: "snake_case_id",    // unique identifier
  label: "Display Name",  // short title shown to user
  desc: "Description",    // what the user needs to do
  emoji: "🎯",            // single emoji for the achievement
  stat: "total",          // which stat to track (see valid values below)
  threshold: 5,           // number needed to unlock
  section: "global",      // which panel section (see valid values below)
}
```

Valid `stat` values: `total`, `bar`, `cafe`, `ice_cream`, `restaurant`, `photos`, `notes`
Valid `section` values: `global` (milestones), `category` (per-type), `activity` (photos/notes)

Rules:
- Place the new achievement in the correct section group within the array
- The `stat` must match a key from `getVisitStats()` in `src/api/visits.js`
- No other files need modification — `AchievementsPanel.jsx` reads from ACHIEVEMENTS dynamically
- Pick a fitting emoji and write a concise, fun description
- Keep the `id` unique and snake_case
