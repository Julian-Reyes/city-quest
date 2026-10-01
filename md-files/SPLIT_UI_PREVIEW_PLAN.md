# Split the connected UI preview into separate files

Status: **future task — not started**.

## Purpose

`ui-preview.html` now contains the connected preview's shell, styling, React
components, and orchestration. Keeping these together allowed the UI work to stay
within the requested single-file scope. As the preview grows, separating these
responsibilities will make it easier to maintain and prepare for production use.

The preview already imports shared venue APIs, visit storage, caching, map
dependencies, and components from `src`. Reuse these modules during the split.

## Proposed structure

- Keep `ui-preview.html` as a small entry page with metadata, a mount point, and
  a module script.
- Add a dedicated preview entry module and root React component under
  `src/preview/`.
- Move preview styling into CSS files, with shared preview design tokens.
- Extract the navigation, quest browser, passport journal and stamp cards,
  loading indicator, check-in dialog, and map controls into React components.
- Extract stateful venue search, check-in orchestration, and city lookup/cache
  behavior into hooks or small modules where useful.
- Use readable JSX source instead of generated `React.createElement` blocks in
  the HTML file.

Adjust the exact file names and component boundaries to the implementation;
avoid duplicating the existing shared APIs or storage utilities.

## Preserve existing behavior

- Live venue searches, geolocation, map selection and controls, retry behavior,
  and cancellable area searches.
- Google/Foursquare detail fetching and the existing API cache.
- Saved visits, repeat check-ins, notes, photo library uploads, camera capture,
  and achievement unlocks.
- Global and city filters for passports and quest progress, including cached
  city identification for older check-ins.
- The passport journal design, theme toggle, unselected quest button borders,
  and animated loading dots with reduced-motion support.
- Desktop maps beside Explore, Passport, and Quests.
- Mobile passport above its map and mobile Quests without a map.
- The **Achievements** navigation label.
- Existing storage keys and saved data, including
  `cityquest_preview_cities_v1`.

## Implementation and validation

1. Inspect the current preview and shared modules before choosing boundaries.
2. Move styling and the entry module first, then extract components and logic
   in small steps without changing behavior.
3. Keep the production entry page and unrelated HTML files unchanged. Confirm
   the existing Vite preview build entry and PWA routing still work.
4. Run the production build and appropriate lint checks. Separate existing
   repository lint failures from any introduced by the split.
5. Verify phone and desktop layouts, city/global counts and map pins, passport
   selection, persisted visits, photo/note check-ins, achievements, loading
   states, retries, and both themes using isolated test storage.
6. Record any checks requiring a physical device, especially installed iOS
   camera behavior.

This note records future work only. Creating it does not expand the current UI
editing scope or perform the refactor, deployment, or production migration.
