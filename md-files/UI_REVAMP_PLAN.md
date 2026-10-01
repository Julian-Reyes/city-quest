# UI Revamp Implementation Plan

Status: **not started**. Mockups are done; this doc is the brief for implementing them in the real app.

## Reference mockups (repo root)
- `claude-revamp.html` — target design for **mobile / phone** (incl. installed iOS PWA)
- `claude-revamp-2.html` — target design for **desktop browsers**

Both are standalone HTML with dummy data. Nothing in them is imported by the app. Open them in a browser to see the target look and interactions.

## Design summary
- Dark "night map" UI (`--night #10201c`, cards `#1d3730`) with a warm paper passport (`--paper #f6efdf`).
- Gold = progress/XP, coral = new/unvisited, mint = visited, sky = you.
- Georgia for headings (journal feel), system sans for UI.
- Passport pages: paper texture, rotated ink stamps, dashed placeholders for locked venues. The global passport uses a teal cover.
- Mobile: bottom tab bar (Explore, Quests, Passport, Badges) replaces the top quest strip; venue info in a bottom sheet.
- Desktop: left sidebar nav + city picker + XP card; Explore is map + right-hand venue detail panel.
- Screens: Explore, Quests, Passport (city / global switcher), Badges (completion ring + hex badges).
- Full token list is in the `:root` block of each mockup.

## Task prompt (give this to Claude)

```
I want to implement the UI revamp from the two mockups in the repo root:
- claude-revamp.html is the target design for mobile / phone (incl. installed iOS PWA)
- claude-revamp-2.html is the target design for desktop browsers

Goal: restyle and restructure the real React app to match these mockups, with
NO changes to existing behavior or data logic (check-ins, API cache, Google/
Foursquare calls, visited-venue persistence, camera overlay, quest types,
achievements, city passports + global passport must all keep working).

Please:
1. Create a feature branch (e.g. ui-revamp). Do not touch main.
2. Read both mockups, then read src/App.jsx, App.css, index.css and src/components/*
   and give me a short plan before editing: how you'll map mockup screens to
   existing components, which components get restructured, and what you'll add.
3. Use ONE responsive codebase, not two apps: mobile layout (bottom tab bar,
   bottom-sheet venue card) below ~860px, desktop layout (left sidebar, map +
   right detail panel) above it. Share components and swap layout via CSS/
   a small useMediaQuery hook.
4. Move the design tokens (colors, fonts, radii) from the mockups into CSS
   variables in index.css so both layouts share them.
5. Wire mockup features to real data where it exists (XP/level, streak,
   quest progress, stamps, per-city and global passport). Where the mockup
   invents something we don't have yet (e.g. level names, global dot map,
   weekday streak dots), tell me and stub it cleanly rather than faking data.
6. Work in stages and commit after each: (a) tokens + shell/nav, (b) Explore,
   (c) Quests, (d) Passport, (e) Badges. Run the build/lint after each stage.
7. Test it with the run skill at a phone viewport and a desktop viewport, and
   tell me what you couldn't verify (e.g. iOS PWA camera behavior).
8. Don't push or deploy. When done, summarize changes and update CLAUDE.md
   (/prep-commit).
```

## Notes / decisions to make before starting
- **Invented features in the mockups** (not necessarily in the app today): XP and levels ("Level 7 · Wayfinder"), streak counter and weekday dots, "Explored %" per city, global dot map, per-category progress, badge tiers (gold/silver/bronze). Decide per feature: build for real, or stub. The default in the prompt is to stub and report.
- **Stage-by-stage option:** to start smaller, tell Claude to do only stages (a) and (b) first.
- **Branching:** use a feature branch and test before merging. Production is live on julianreyes.dev, so don't push experimental changes straight to main.
- **Don't regress:** the iOS standalone PWA camera overlay (`CameraOverlay.jsx`), the localStorage API cache (7-day TTL), and visited venues persisting outside the search area.
- **Housekeeping:** commit both mockup files so they stay in the repo as reference. `ui-preview.html` had uncommitted changes at the time of writing, so commit or discard it first.
