/**
 * revamp2/app.js — The main app (index.html): desktop + mobile revamp UI
 *
 * Plain DOM rendering (no React) on top of the same API and storage modules the
 * old React app uses, so check-ins made here show up in indexOld.html and vice versa.
 *
 * XP, levels and streaks don't exist in the real app yet; they are derived here
 * from visit history (see progress() and streakInfo()) and never stored.
 */

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  QUEST_TYPES,
  VENUE_CATEGORIES,
  CATEGORY_MAP,
  getCategoriesForQuest,
  ACHIEVEMENTS,
} from "../constants";
import { getApiCache, setApiCache, filterGhostVenues } from "../api/cache";
import { fetchVenues } from "../api/overpass";
import { fetchFoursquareDetails } from "../api/foursquare";
import { fetchGooglePlaceDetails } from "../api/google";
import {
  getVisits,
  addVisit,
  getVisitPhoto,
  getVisitStats,
  getVisitedVenues,
  getAllVisitedVenues,
  backfillVisitTypes,
} from "../api/visits";
import { resizePhoto } from "../utils/photo";
import { distanceMiles } from "../utils/distance";

const FALLBACK = { lat: 37.7749, lng: -122.4194 }; // San Francisco
const DEFAULT_RADIUS = 4000; // metres
const XP_PER_VISIT = 50;
const XP_PER_BADGE = 100;
const XP_PER_LEVEL = 500;
const STAMP_STYLES = ["s1", "s2", "s3", "s4", "s5"];
const CITY_COLORS = ["#f2b84b", "#7cc3e8", "#b58ae0", "#7fd6b0", "#ee6c4d"];
const PLURAL = {
  ice_cream: "ice cream shops", gallery: "galleries", library: "libraries", beach: "beaches",
  monument: "landmarks", nature_reserve: "trails", swimming_pool: "pools", climbing: "climbing gyms",
};

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plural = (type) => PLURAL[type] || `${(CATEGORY_MAP[type]?.label || "place").toLowerCase()}s`;
const fmtDist = (mi) => (mi < 0.1 ? `${Math.max(10, Math.round((mi * 5280) / 10) * 10)} ft` : `${mi.toFixed(mi < 10 ? 1 : 0)} mi`);
const fmtDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "No date" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

// ── Passport city lookup (Nominatim) ──
// Same cache key and format as ui-preview.html, so both pages reuse each other's lookups.
const CITIES_KEY = "cityquest_preview_cities_v1";
function readCities() {
  try {
    const saved = JSON.parse(localStorage.getItem(CITIES_KEY) || "{}");
    return Object.fromEntries(Object.entries(saved).filter(([, c]) => c?.id && c?.name));
  } catch {
    return {};
  }
}
const coordKey = (v) => (Number.isFinite(v?.lat) && Number.isFinite(v?.lng) ? `${v.lat},${v.lng}` : null);
function cityFromAddress(a) {
  const name = a?.city || a?.town || a?.village || a?.municipality || a?.county;
  if (!name) throw new Error("City not found for these coordinates");
  const state = a.state || "";
  const country = a.country_code || a.country || "";
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  return { id: `city:${[country, state, name].map(norm).join("|")}`, name, state, country };
}
const cityRequests = new Map();
let cityQueue = Promise.resolve();
let lastCityRequest = 0;
function resolveCity(point) {
  const key = coordKey(point);
  if (!key) return Promise.reject(new Error("Missing coordinates"));
  if (state.cityByCoord[key]) return Promise.resolve(state.cityByCoord[key]);
  if (cityRequests.has(key)) return cityRequests.get(key);
  // Nominatim allows ~1 request/second: serialize and space out lookups.
  const request = cityQueue.catch(() => {}).then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastCityRequest));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastCityRequest = Date.now();
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${point.lat}&lon=${point.lng}&format=json&zoom=10`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!res.ok) throw new Error(`City lookup failed: ${res.status}`);
    const city = cityFromAddress((await res.json()).address);
    state.cityByCoord = { ...state.cityByCoord, [key]: city };
    try {
      localStorage.setItem(CITIES_KEY, JSON.stringify(state.cityByCoord));
    } catch { /* In-memory results still work when storage is full. */ }
    return city;
  });
  cityRequests.set(key, request);
  cityQueue = request;
  request.finally(() => cityRequests.delete(key)).catch(() => {});
  return request;
}
const cityLabel = (c) => (c ? c.name + (c.state && c.state !== c.name ? `, ${c.state}` : "") : "");

// ── State ──

const state = {
  view: "explore",
  category: "cafe",
  venues: [], // every venue loaded for the active category (all searched areas + saved check-ins)
  selId: null,
  query: "",
  sheetOpen: false,
  user: null,
  center: null, // { lat, lng, radius? } of the last venue search
  pendingArea: null,
  loading: false,
  error: null,
  questFilter: "active",
  badgeFilter: "all",
  ppScope: null, // null = current city (if known), "global", or a city id
  cityByCoord: readCities(),
  currentCity: null,
  citiesLoading: false,
  photo: null,
};
let sheetDrag = null; // active bottom-sheet drag, see "Sheet drag"
const byCategory = {}; // category -> { key, venues } so switching back doesn't refetch
const detailsLoading = new Set(); // "google:<id>" / "fsq:<id>"
let stats = getVisitStats();
let stamps = getAllVisitedVenues();

function refreshStats() {
  stats = getVisitStats();
  stamps = getAllVisitedVenues();
  return stats;
}

function withVisits(v, visits = getVisits()) {
  const sv = visits[v.id];
  if (!sv?.visits?.length) return v;
  const latest = sv.visits[sv.visits.length - 1];
  return {
    ...v,
    visited: true,
    visitCount: sv.visits.length,
    visits: sv.visits,
    latestVisit: latest,
    visitedAt: latest.at,
    note: latest.note || "",
    photo: latest.hasPhoto ? getVisitPhoto(v.id, sv.visits.length - 1) : null,
  };
}

function patchVenue(id, patch) {
  state.venues = state.venues.map((v) => (v.id === id ? { ...v, ...patch } : v));
  if (byCategory[state.category]) byCategory[state.category].venues = state.venues;
}

const currentVenue = () => state.venues.find((v) => v.id === state.selId) || null;

function visibleVenues() {
  const c = state.center;
  if (!c) return [];
  const radiusMi = (c.radius ?? DEFAULT_RADIUS) / 1609.344;
  const q = state.query.trim().toLowerCase();
  const origin = state.user || c;
  return state.venues
    .filter((v) => v.type === state.category && Number.isFinite(v.lat))
    .filter((v) => v.visited || distanceMiles(c.lat, c.lng, v.lat, v.lng) <= radiusMi)
    .filter((v) => !q || v.name.toLowerCase().includes(q))
    .map((v) => ({ ...v, dist: distanceMiles(origin.lat, origin.lng, v.lat, v.lng) }))
    .sort((a, b) => a.dist - b.dist);
}

// ── Derived game progress ──

const unlockedBadges = () => ACHIEVEMENTS.filter((a) => (stats[a.stat] || 0) >= a.threshold);

function progress() {
  const visits = stamps.reduce((n, v) => n + (v.visitCount || 1), 0);
  const badges = unlockedBadges().length;
  const xp = visits * XP_PER_VISIT + badges * XP_PER_BADGE;
  const into = xp % XP_PER_LEVEL;
  return { visits, badges, xp, level: Math.floor(xp / XP_PER_LEVEL) + 1, pct: (into / XP_PER_LEVEL) * 100, toNext: XP_PER_LEVEL - into };
}

const dayKey = (value) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
function streakInfo() {
  const days = new Set(stamps.flatMap((v) => (v.visits || []).map((x) => dayKey(x.at))));
  const today = new Date();
  const d = new Date(today);
  // A streak is still alive until the end of the day after the last check-in.
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  const week = [...Array(7)].map((_, i) => {
    const x = new Date(today);
    x.setDate(today.getDate() - 6 + i);
    return { label: "SMTWTFS"[x.getDay()], on: days.has(dayKey(x)) };
  });
  return { streak, week, today: days.has(dayKey(today)) };
}

// ── Map ──

const map = L.map("map", { zoomControl: false }).setView([FALLBACK.lat, FALLBACK.lng], 14);
const tileUrl = (light) => `https://tiles.stadiamaps.com/tiles/alidade_smooth${light ? "" : "_dark"}/{z}/{x}/{y}{r}.png`;
const tiles = L.tileLayer(tileUrl(document.documentElement.dataset.theme === "light"), {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);
// Plain "Leaflet" credit, without the default flag icon.
map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
// Keep the bottom-right attribution above the venue sheet (narrow layouts only; 0 when hidden).
new ResizeObserver(() => $("map").parentElement.style.setProperty("--sheet-h", `${$("sheet").offsetHeight}px`)).observe($("sheet"));

// ── Theme ──

function applyTheme(light) {
  const root = document.documentElement;
  if (light) root.dataset.theme = "light";
  else delete root.dataset.theme;
  tiles.setUrl(tileUrl(light));
  const btn = $("themeBtn");
  btn.textContent = light ? "🌙" : "☀️";
  btn.title = btn.ariaLabel = light ? "Switch to dark mode" : "Switch to light mode";
  document.querySelector('meta[name="theme-color"]').content = light ? "#fbf7ee" : "#10201c";
}
applyTheme(document.documentElement.dataset.theme === "light");
$("themeBtn").addEventListener("click", () => {
  const light = document.documentElement.dataset.theme !== "light";
  try { localStorage.setItem("cq-theme", light ? "light" : "dark"); } catch { /* storage blocked: theme just won't persist */ }
  applyTheme(light);
});
const pinLayer = L.layerGroup().addTo(map);
let meMarker = null;
// The map lives in a view that is display:none while another tab is open.
new ResizeObserver(() => map.invalidateSize()).observe($("map"));

// Dense categories return hundreds of venues, so pins shrink (but keep their emoji) when zoomed out.
function pinIcon(v, sel, zoom) {
  const cls = sel ? "sel" : v.visited ? "visited" : "new";
  const size = sel ? 46 : zoom >= 16 ? 36 : zoom >= 15 ? 28 : zoom >= 13 ? 20 : 15;
  return L.divIcon({
    className: "cq-icon",
    html: `<div class="pin ${cls}" style="width:${size}px;height:${size}px"><b style="font-size:${Math.round(size * 0.45)}px">${CATEGORY_MAP[v.type]?.emoji || "📍"}</b></div>`,
    iconSize: [size, size],
    // The pin's point sits ~0.71 × size below its centre once rotated.
    iconAnchor: [size / 2, size * 1.2],
  });
}

let lastPins = [];
function renderPins(list = lastPins) {
  lastPins = list;
  pinLayer.clearLayers();
  const zoom = map.getZoom();
  for (const v of list) {
    const sel = v.id === state.selId;
    const icon = pinIcon(v, sel, zoom);
    L.marker([v.lat, v.lng], { icon, title: v.name, zIndexOffset: sel ? 1000 : 0 })
      .on("click", () => select(v.id))
      .addTo(pinLayer);
  }
}

function updateMe() {
  if (!state.user) return;
  const ll = [state.user.lat, state.user.lng];
  if (meMarker) return meMarker.setLatLng(ll);
  meMarker = L.marker(ll, {
    icon: L.divIcon({ className: "cq-icon", html: '<div class="me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
    interactive: false,
    zIndexOffset: -500,
  }).addTo(map);
  $("recenter").disabled = false;
}

map.on("zoomend", () => renderPins());
map.on("moveend", () => {
  const c = state.center;
  if (!c) return;
  const ctr = map.getCenter();
  const radius = Math.round(map.distance(ctr, [map.getBounds().getNorth(), ctr.lng]));
  const moved = distanceMiles(c.lat, c.lng, ctr.lat, ctr.lng) > 0.6 || radius > (c.radius ?? DEFAULT_RADIUS) * 1.3;
  state.pendingArea =
    map.getZoom() >= 12 && moved ? { lat: ctr.lat, lng: ctr.lng, radius: Math.min(Math.max(radius, 800), 6000) } : null;
  renderMapStatus();
});

// ── Data loading ──

// Searches aren't aborted when you switch category: they finish in the background and fill
// byCategory, so switching back is instant. inflight dedupes a search still running.
const inflight = {}; // category -> { key, promise }

async function fetchCategory(cat, c) {
  const fetched = await fetchVenues(c.lat, c.lng, cat, undefined, c.radius ?? DEFAULT_RADIUS);
  const visits = getVisits();
  const hydrated = filterGhostVenues(fetched).map((v) => withVisits(v, visits));
  if (backfillVisitTypes(hydrated)) refreshStats();
  // Keep earlier searches and every saved check-in of this category on the map.
  const merged = new Map();
  for (const v of [...getVisitedVenues(cat), ...(byCategory[cat]?.venues || [])]) merged.set(v.id, v);
  for (const v of hydrated) {
    const old = merged.get(v.id);
    merged.set(v.id, old ? { ...v, fsqData: old.fsqData, googleData: old.googleData } : v);
  }
  return filterGhostVenues([...merged.values()]);
}

async function loadVenues() {
  const c = state.center;
  if (!c) return;
  const cat = state.category;
  const key = `${c.lat},${c.lng},${c.radius ?? DEFAULT_RADIUS}`;
  const current = () => state.category === cat && state.center === c;
  if (byCategory[cat]?.key === key) {
    state.venues = byCategory[cat].venues;
    state.loading = false;
    state.error = null;
    renderExplore();
    if (currentVenue()) loadDetails(currentVenue());
    return;
  }
  state.venues = byCategory[cat]?.venues || getVisitedVenues(cat);
  state.loading = true;
  state.error = null;
  renderExplore();
  let job = inflight[cat];
  if (job?.key !== key) {
    job = inflight[cat] = { key, promise: fetchCategory(cat, c) };
    job.promise
      .then((venues) => {
        if (inflight[cat] === job) byCategory[cat] = { key, venues };
      })
      .catch(() => {})
      .finally(() => {
        if (inflight[cat] === job) delete inflight[cat];
      });
  }
  try {
    await job.promise;
  } catch (err) {
    if (!current()) return;
    console.error("Failed to fetch venues:", err);
    state.error = "Couldn't load venues.";
  }
  if (!current()) return;
  if (byCategory[cat]?.key === key) state.venues = byCategory[cat].venues;
  state.loading = false;
  renderExplore();
  if (currentVenue()) loadDetails(currentVenue());
}

function loadDetails(v) {
  const id = v.id;
  if (v.fsqData === undefined && !detailsLoading.has(`fsq:${id}`)) {
    const cached = getApiCache(id, "fsq");
    if (cached !== undefined) patchVenue(id, { fsqData: cached });
    else {
      detailsLoading.add(`fsq:${id}`);
      fetchFoursquareDetails(v.name, v.lat, v.lng)
        .then((d) => {
          setApiCache(id, "fsq", d || null);
          patchVenue(id, { fsqData: d || null });
        })
        .catch(() => {})
        .finally(() => {
          detailsLoading.delete(`fsq:${id}`);
          if (state.selId === id) renderVenuePanels();
        });
    }
  }
  if (v.googleData === undefined && !detailsLoading.has(`google:${id}`)) {
    const cached = getApiCache(id, "google");
    if (cached !== undefined) applyGoogle(v, cached);
    else {
      detailsLoading.add(`google:${id}`);
      fetchGooglePlaceDetails(v.name, v.lat, v.lng)
        .then((d) => {
          setApiCache(id, "google", d || null);
          applyGoogle(v, d || null);
        })
        .catch(() => {})
        .finally(() => {
          detailsLoading.delete(`google:${id}`);
          renderExplore();
        });
    }
  }
  renderVenuePanels();
}

function applyGoogle(v, googleData) {
  const patch = { googleData };
  if (googleData?.address && !v.address?.trim()) patch.address = googleData.address;
  patchVenue(v.id, patch);
  // Stale OSM entry: closed, or no Google match and no OSM address.
  const ghost = !v.visited && (googleData?.closed || (googleData === null && !v.address?.trim()));
  if (!ghost) return;
  state.venues = state.venues.filter((x) => x.id !== v.id);
  if (byCategory[state.category]) byCategory[state.category].venues = state.venues;
  if (state.selId === v.id) state.selId = null;
  toast("Venue not found — removed from map");
  renderExplore();
}

function setCenter(c, { move = true } = {}) {
  state.center = c;
  state.pendingArea = null;
  if (move) map.setView([c.lat, c.lng], Math.max(map.getZoom(), 14));
  loadVenues();
  resolveCity(c)
    .then((city) => {
      if (state.center !== c) return;
      state.currentCity = city;
      renderChrome();
      renderQuests();
      renderPassport();
    })
    .catch(() => {});
}

function locateStampCities() {
  const pending = stamps.filter((v) => coordKey(v) && !state.cityByCoord[coordKey(v)]);
  if (!pending.length) return;
  state.citiesLoading = true;
  renderPassport();
  (async () => {
    for (const v of pending) {
      try {
        await resolveCity(v);
        renderPassport();
      } catch { /* Unresolved stamps stay in "All cities"; the passport offers a retry. */ }
    }
    state.citiesLoading = false;
    renderPassport();
  })();
}

// ── Explore rendering ──

function ratingLine(v) {
  const g = v.googleData;
  if (detailsLoading.has(`google:${v.id}`)) return '<span class="muted">Loading details…</span>';
  const r = g?.rating || v.fsqData?.rating / 2;
  if (!r) return '<span class="muted">No rating yet</span>';
  const n = Math.round(r);
  const count = g?.ratingCount ? ` <span class="muted">(${g.ratingCount.toLocaleString()})</span>` : "";
  return `${"★".repeat(n)}${"☆".repeat(5 - n)} ${r.toFixed(1)}${count}`;
}
function hoursText(v) {
  const h = v.googleData?.hours || v.fsqData?.hours;
  if (!h) return detailsLoading.size ? "…" : "Not listed";
  const today = h.display?.replace(/^[A-Za-z]+:\s*/, "");
  const now = h.open_now === true ? "Open now" : h.open_now === false ? "Closed now" : "";
  return esc([now, today].filter(Boolean).join(" · ") || "Not listed");
}
function priceText(v) {
  const p = v.googleData?.price || v.fsqData?.price;
  return p ? "$".repeat(p) : "—";
}
function checkinHint(v) {
  const a = ACHIEVEMENTS.find((x) => x.stat === v.type && (stats[x.stat] || 0) < x.threshold);
  if (v.visited) return `+${XP_PER_VISIT} XP · visit #${(v.visitCount || 1) + 1}`;
  return `+${XP_PER_VISIT} XP${a ? ` · ${a.label} ${(stats[a.stat] || 0) + 1}/${a.threshold}` : ""}`;
}
const ctaHtml = (v) =>
  `<button class="cta ${v.visited ? "again" : ""}" data-act="checkin">${v.visited ? "Check in again" : "Check in"} <small>${esc(checkinHint(v))}</small></button>`;
const nearbyRows = (list) =>
  list
    .map(
      (o) =>
        `<button class="near" data-id="${esc(o.id)}"><span class="e">${o.visited ? "✓" : CATEGORY_MAP[o.type]?.emoji || "📍"}</span><div><b>${esc(o.name)}</b><small>${esc(o.address?.trim() || CATEGORY_MAP[o.type]?.label)}</small></div><span class="d">${fmtDist(o.dist)}</span></button>`,
    )
    .join("");
const ph = (v) => (v.photo ? `<img src="${v.photo}" alt="Your photo from ${esc(v.name)}">` : CATEGORY_MAP[v.type]?.emoji || "📍");
const phBg = (v) => `background:linear-gradient(135deg,${CATEGORY_MAP[v.type]?.color || "#f2b84b"},#10201c)`;

function areaSummary(list) {
  const visited = list.filter((v) => v.visited).length;
  const pct = list.length ? Math.round((visited / list.length) * 100) : 0;
  return { visited, pct };
}

function listStateHtml(list) {
  if (!state.center) return '<div class="empty">Finding your location…</div>';
  if (state.loading && !list.length) return `<div class="empty">Finding ${plural(state.category)}…</div>`;
  if (state.error && !list.length) return `<div class="empty">${state.error} <button data-act="retry">Try again</button></div>`;
  if (!list.length)
    return `<div class="empty">${state.query ? `No ${plural(state.category)} match “${esc(state.query)}”.` : `No ${plural(state.category)} found here. Try another category or pan the map.`}</div>`;
  return nearbyRows(list.slice(0, 60));
}

function renderVenuePanels() {
  const list = visibleVenues();
  const v = list.find((x) => x.id === state.selId) || (currentVenue() && { ...currentVenue(), dist: state.user ? distanceMiles(state.user.lat, state.user.lng, currentVenue().lat, currentVenue().lng) : 0 });
  const where = cityLabel(state.currentCity) || "Near you";
  const cat = CATEGORY_MAP[state.category];

  if (!v) {
    const { visited, pct } = areaSummary(list);
    $("detail").innerHTML = `
      <div class="d-body d-list">
        <div class="eyebrow">${esc(where)}</div>
        <h2>${list.length} ${plural(state.category)}</h2>
        <div class="meta">${visited} visited · ${pct}% explored${state.loading ? " · updating…" : ""}</div>
        <div class="bar" style="margin-top:12px"><i style="width:${pct}%"></i></div>
        <div class="nearby"><h4>Closest first</h4>${listStateHtml(list)}</div>
      </div>`;
    $("sheet").classList.toggle("open", state.sheetOpen || !!sheetDrag);
    $("sheet").innerHTML = `
      <button class="grab" data-act="toggle" aria-label="${state.sheetOpen ? "Hide" : "Show"} the list" aria-expanded="${state.sheetOpen}"></button>
      <button class="s-sum" data-act="toggle">
        <div class="eyebrow">${esc(where)} · ${cat?.emoji || ""} ${esc(cat?.label || "")}</div>
        <h3>${state.center && state.loading && !list.length ? `Finding ${plural(state.category)}…` : `${list.length} ${plural(state.category)} nearby`}</h3>
        <div class="meta">${visited} visited · ${pct}% explored · tap to ${state.sheetOpen ? "hide" : "see"} the list</div>
        <div class="bar"><i style="width:${pct}%"></i></div>
      </button>
      <div class="nearby">${listStateHtml(list)}</div>`;
    return;
  }

  const others = list.filter((o) => o.id !== v.id).slice(0, 4);
  const category = esc(v.fsqData?.category || CATEGORY_MAP[v.type]?.label || "Venue");
  const address = v.address?.trim() ? ` · ${esc(v.address.trim())}` : "";
  const facts = `
    <div class="facts">
      <div class="fact"><small>Hours</small><strong>${hoursText(v)}</strong></div>
      <div class="fact"><small>Price</small><strong>${priceText(v)}</strong></div>
      <div class="fact"><small>Distance</small><strong>${state.user ? fmtDist(v.dist) : "—"}</strong></div>
      <div class="fact"><small>${v.visited ? "Last visit" : "Visits"}</small><strong>${v.visited ? `${fmtDate(v.visitedAt)} · ${v.visitCount}×` : "Not yet"}</strong></div>
    </div>`;
  const memo = v.note ? `<p class="memo">“${esc(v.note)}”</p>` : "";

  $("detail").innerHTML = `
    <div class="hero-ph" style="${phBg(v)}">${ph(v)}<span class="tag">${v.visited ? "✓ VISITED" : `NEW${state.user ? ` · ${fmtDist(v.dist)} away` : ""}`}</span></div>
    <div class="d-body">
      <button class="d-back" data-act="back">← All ${plural(v.type)}</button>
      <div class="eyebrow">${v.visited ? "In your passport" : "Unvisited"}</div>
      <h2>${esc(v.name)}</h2><div class="meta">${category}${address}</div><div class="rate">${ratingLine(v)}</div>
      ${facts}
      ${ctaHtml(v)}
      ${memo}
      ${others.length ? `<div class="nearby"><h4>Also nearby</h4>${nearbyRows(others)}</div>` : ""}
    </div>`;

  $("sheet").classList.toggle("open", state.sheetOpen || !!sheetDrag);
  $("sheet").innerHTML = `
    <button class="grab" data-act="toggle" aria-label="${state.sheetOpen ? "Hide" : "Show"} venue details" aria-expanded="${state.sheetOpen}"></button>
    <div class="s-venue">
      <div class="ph" style="${phBg(v)}">${ph(v)}</div>
      <div>
        <div class="eyebrow">${v.visited ? `✓ Visited · ${v.visitCount}×` : `${state.user ? `${fmtDist(v.dist)} away · ` : ""}New`}</div>
        <h3>${esc(v.name)}</h3><div class="meta">${category}</div>
        <div class="rate">${ratingLine(v)} <span>· ${priceText(v)}</span></div>
      </div>
    </div>
    ${ctaHtml(v)}
    <div class="nearby">
      ${v.address?.trim() ? `<div class="meta" style="margin-top:12px">📍 ${esc(v.address.trim())}</div>` : ""}
      ${facts}${memo}
      ${others.length ? `<h4>Also nearby</h4>${nearbyRows(others)}` : ""}
      <button class="d-back" data-act="back" style="margin-top:10px">← All ${plural(v.type)}</button>
    </div>`;
}

function renderMapStatus() {
  const el = $("mapStatus");
  $("areaBtn").hidden = !state.pendingArea || state.loading;
  let html = "";
  if (!state.center) html = '<span class="spin"></span>Finding your location…';
  else if (state.loading) html = `<span class="spin"></span>Finding ${plural(state.category)}…`;
  else if (state.error) html = `${state.error} <button data-act="retry">Retry</button>`;
  el.hidden = !html || !$("areaBtn").hidden;
  el.innerHTML = html;
}

function renderCategoryChips() {
  $("cats").innerHTML = VENUE_CATEGORIES.map(
    (c) => `<button class="chip ${c.id === state.category ? "on" : ""}" data-cat="${c.id}">${c.emoji} ${esc(c.label)}</button>`,
  ).join("");
}

function renderExplore() {
  renderPins(visibleVenues());
  renderMapStatus();
  renderVenuePanels();
}

function select(id) {
  state.selId = id;
  renderExplore();
  const v = currentVenue();
  if (!v) return;
  if (!map.getBounds().pad(-0.2).contains([v.lat, v.lng])) map.panTo([v.lat, v.lng]);
  loadDetails(v);
}

function setCategory(id) {
  if (!CATEGORY_MAP[id]) return;
  state.category = id;
  state.selId = null;
  state.sheetOpen = false;
  renderCategoryChips();
  document.querySelector(`#cats [data-cat="${id}"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
  loadVenues();
}

// Jump from a passport stamp or quest step to that venue on the map.
function openVenue(v) {
  if (!Number.isFinite(v.lat) || !CATEGORY_MAP[v.type]) return toast("No map location saved for this check-in");
  show("explore");
  state.selId = v.id;
  state.sheetOpen = false;
  const far = !state.center || distanceMiles(state.center.lat, state.center.lng, v.lat, v.lng) > (state.center.radius ?? DEFAULT_RADIUS) / 1609.344;
  if (state.category !== v.type) {
    state.category = v.type;
    renderCategoryChips();
  }
  map.setView([v.lat, v.lng], 16);
  if (far) setCenter({ lat: v.lat, lng: v.lng }, { move: false });
  else loadVenues();
}

// ── Check-in dialog ──

function openCheckin() {
  const v = currentVenue();
  if (!v) return;
  state.photo = null;
  $("ciName").textContent = v.name;
  $("ciNote").value = "";
  $("ciPhoto").value = "";
  $("ciPreview").hidden = true;
  $("ciPhotoLabel").textContent = "Add photo";
  $("ciSave").disabled = false;
  $("ci").showModal();
  $("ciNote").focus();
}

async function saveCheckin() {
  const v = currentVenue();
  if (!v) return;
  $("ciSave").disabled = true;
  const before = getVisitStats();
  const prevCount = getVisits()[v.id]?.visits.length || 0;
  const visit = { at: new Date().toISOString(), note: $("ciNote").value.trim(), hasPhoto: false };
  let photo = null;
  if (state.photo) {
    photo = await resizePhoto(state.photo);
    visit.hasPhoto = true;
  }
  addVisit(v.id, visit, photo, v.type, { name: v.name, lat: v.lat, lng: v.lng });
  const stored = getVisits()[v.id];
  if (!stored || stored.visits.length !== prevCount + 1) {
    $("ciSave").disabled = false;
    return toast("Couldn't save the check-in — storage may be full");
  }
  if (photo && !stored.visits[stored.visits.length - 1].hasPhoto) toast("Saved without the photo — storage is full");
  patchVenue(v.id, withVisits(v));
  const after = refreshStats();
  const unlocked = ACHIEVEMENTS.filter((a) => (before[a.stat] || 0) < a.threshold && (after[a.stat] || 0) >= a.threshold);
  $("ci").close();
  toast(`📘 Stamped ${v.name} · +${XP_PER_VISIT + unlocked.length * XP_PER_BADGE} XP`);
  unlocked.forEach((a) => toast(`🏅 Badge unlocked: ${a.emoji} ${a.label}`));
  renderAll();
  locateStampCities();
}

$("ciPhoto").addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.photo = reader.result;
    $("ciPreview").src = reader.result;
    $("ciPreview").hidden = false;
    $("ciPhotoLabel").textContent = "Change photo";
  };
  reader.readAsDataURL(file);
});
$("ciForm").addEventListener("submit", (e) => {
  e.preventDefault();
  saveCheckin();
});
$("ciCancel").addEventListener("click", () => $("ci").close());

// ── Quests ──

function questCards() {
  const quests = QUEST_TYPES.map((q) => {
    const a = ACHIEVEMENTS.find((x) => x.stat === `quest_${q.id}`);
    return {
      emoji: a?.emoji || q.emoji,
      title: q.label,
      sub: a?.desc || "",
      n: stats[`quest_${q.id}`] || 0,
      target: a?.threshold || 10,
      reward: a,
      steps: getCategoriesForQuest(q.id).map((c) => ({ cat: c, n: stats[c.id] || 0 })),
    };
  });
  const goals = ACHIEVEMENTS.filter((a) => a.section === "category" && CATEGORY_MAP[a.stat]).map((a) => ({
    emoji: a.emoji,
    title: a.label,
    sub: a.desc,
    n: stats[a.stat] || 0,
    target: a.threshold,
    reward: a,
    steps: [{ cat: CATEGORY_MAP[a.stat], n: stats[a.stat] || 0 }],
    single: true,
  }));
  return [...quests, ...goals].map((q) => ({ ...q, done: q.n >= q.target, pct: Math.min(100, Math.round((q.n / q.target) * 100)) }));
}

function renderQuests() {
  const s = streakInfo();
  const cards = questCards();
  const active = cards.filter((c) => !c.done);
  $("questCount").textContent = active.length;
  $("questEyebrow").textContent = `${cityLabel(state.currentCity) || "Everywhere"} · Your quests`;
  $("streak").innerHTML = `
    <div class="flame">🔥</div>
    <div><strong>${s.streak ? `${s.streak}-day streak` : "No streak yet"}</strong>${s.today ? "You've checked in today. Streak safe!" : s.streak ? "Check in anywhere today to keep it alive" : "Check in anywhere today to start one"}</div>
    <div class="days">${s.week.map((d) => `<span class="${d.on ? "on" : ""}">${d.label}</span>`).join("")}</div>`;
  const shown =
    state.questFilter === "active" ? active.sort((a, b) => b.pct - a.pct)
      : state.questFilter === "done" ? cards.filter((c) => c.done)
        : cards;
  $("qgrid").innerHTML = shown.length
    ? shown
      .map(
        (q) => `
      <div class="qcard ${q.done ? "complete" : ""}">
        <header><div class="ic">${q.emoji}</div><div><h4>${esc(q.title)}</h4><small>${esc(q.sub)}</small></div><div class="pct">${Math.min(q.n, q.target)}/${q.target}</div></header>
        <div class="bar"><i style="width:${q.pct}%"></i></div>
        <div class="steps">${q.single
          ? `<button data-cat="${q.steps[0].cat.id}">${q.done ? "✓ Complete · find more" : "🔎 Find"} ${plural(q.steps[0].cat.id)} nearby →</button>`
          : q.steps.map((st) => `<button data-cat="${st.cat.id}" class="${st.n ? "done" : ""}" title="Find ${plural(st.cat.id)} nearby">${st.n ? "✓" : "○"} ${st.cat.emoji} ${esc(st.cat.label)}${st.n ? ` · ${st.n}` : ""}</button>`).join("")}</div>
        <span class="reward">${q.done ? "✓ Earned" : "Reward"} · “${esc(q.reward?.label)}” badge + ${XP_PER_BADGE} XP</span>
      </div>`,
      )
      .join("")
    : `<div class="empty">${state.questFilter === "done" ? "No quests completed yet. Your first one is closer than you think." : "Every quest is complete. Legendary!"}</div>`;
}

// ── Passport ──

function cityGroups() {
  const groups = new Map();
  for (const v of stamps) {
    const c = state.cityByCoord[coordKey(v)];
    if (!c) continue;
    if (!groups.has(c.id)) groups.set(c.id, { ...c, venues: [] });
    groups.get(c.id).venues.push(v);
  }
  const cur = state.currentCity;
  if (cur && !groups.has(cur.id)) groups.set(cur.id, { ...cur, venues: [] });
  return [...groups.values()].sort((a, b) => (b.id === cur?.id) - (a.id === cur?.id) || b.venues.length - a.venues.length);
}

const visitCount = (venues) => venues.reduce((n, v) => n + (v.visitCount || 1), 0);
const byRecent = (a, b) => new Date(b.visitedAt) - new Date(a.visitedAt);

function stampHtml(v, i) {
  const e = v.photo ? `<img src="${v.photo}" alt="">` : CATEGORY_MAP[v.type]?.emoji || "📍";
  return `<button class="stamp ${STAMP_STYLES[i % STAMP_STYLES.length]}" data-venue="${esc(v.id)}" title="Show ${esc(v.name)} on the map"><span class="e">${e}</span><span class="nm">${esc(v.name)}</span><small>${fmtDate(v.visitedAt)}</small></button>`;
}

function categoryRows(venues) {
  const counts = new Map();
  for (const v of venues) counts.set(v.type, (counts.get(v.type) || 0) + 1);
  const max = Math.max(1, ...counts.values());
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, n]) => {
      const c = CATEGORY_MAP[type] || { label: "Other", emoji: "📍", color: "#9db3a9" };
      return `<button class="city" data-cat="${esc(type)}"><div class="sk" style="background:${c.color}33">${c.emoji}</div><div style="flex:1"><h5>${esc(c.label)}</h5><small>${n} ${n === 1 ? "place" : "places"} stamped</small><div class="bar"><i style="width:${(n / max) * 100}%"></i></div></div><div class="ct">${n}</div></button>`;
    })
    .join("");
}

function passportNotes() {
  const unresolved = stamps.filter((v) => !coordKey(v) || !state.cityByCoord[coordKey(v)]).length;
  if (state.citiesLoading) return '<p class="pp-note">Finding cities for your check-ins…</p>';
  if (unresolved) return `<p class="pp-note">${unresolved} check-in${unresolved === 1 ? "" : "s"} couldn't be matched to a city. They're still counted in All cities. <button data-act="retry-cities">Retry</button></p>`;
  return "";
}

function renderPassport() {
  const cities = cityGroups();
  let scope = state.ppScope ?? state.currentCity?.id ?? "global";
  if (scope !== "global" && !cities.some((c) => c.id === scope)) scope = "global";
  const city = cities.find((c) => c.id === scope);
  const p = progress();
  const s = streakInfo();

  $("switcher").innerHTML =
    cities.map((c) => `<button class="${c.id === scope ? "on" : ""}" data-p="${esc(c.id)}">${esc(c.name)}${c.venues.length ? ` · ${c.venues.length}` : ""}</button>`).join("") +
    `<button class="${scope === "global" ? "on" : ""}" data-p="global">All cities</button>`;

  if (city) {
    const venues = city.venues.slice().sort(byRecent);
    const types = new Set(venues.map((v) => v.type));
    const fill = Math.max(venues.length ? (4 - (venues.length % 4)) % 4 : 0, venues.length < 8 ? 8 - venues.length : 0);
    const locked = VENUE_CATEGORIES.filter((c) => !types.has(c.id)).slice(0, fill);
    $("ppTitle").textContent = cityLabel(city);
    $("ppSub").textContent = venues.length
      ? `${venues.length} ${venues.length === 1 ? "venue" : "venues"} stamped · ${visitCount(venues)} visits`
      : "No stamps here yet. Your first one is a check-in away.";
    $("ppBody").innerHTML = `
      <div class="pp-layout">
        <div class="book">
          <div class="hd"><div><div class="eyebrow">Official visitor record</div><h2>${esc(city.name)} Edition</h2></div><div class="seal"><div><b>${venues.length}</b>STAMPS</div></div></div>
          <div class="stamps">
            ${venues.map(stampHtml).join("")}
            ${locked.map((c) => `<button class="stamp locked" data-cat="${c.id}" title="Find ${plural(c.id)} nearby"><span class="e">${c.emoji}</span>? ? ?</button>`).join("")}
          </div>
        </div>
        <div class="side-col">
          <div class="stats3"><div class="stat"><strong>${venues.length}</strong><small>Venues</small></div><div class="stat"><strong>${types.size}</strong><small>Categories</small></div><div class="stat"><strong>${visitCount(venues)}</strong><small>Visits</small></div></div>
          ${venues.length ? `<div class="sec-h">By category</div>${categoryRows(venues)}` : '<div class="empty">Tap a ? ? ? stamp to find something new to explore.</div>'}
          ${passportNotes()}
        </div>
      </div>`;
    return;
  }

  // Global passport
  const located = cities.filter((c) => c.venues.length);
  const pts = located.map((c) => ({
    c,
    lat: c.venues.reduce((n, v) => n + v.lat, 0) / c.venues.length,
    lng: c.venues.reduce((n, v) => n + v.lng, 0) / c.venues.length,
  }));
  const [minLat, maxLat] = [Math.min(...pts.map((x) => x.lat)), Math.max(...pts.map((x) => x.lat))];
  const [minLng, maxLng] = [Math.min(...pts.map((x) => x.lng)), Math.max(...pts.map((x) => x.lng))];
  const dots = pts
    .map((x) => {
      const left = maxLng > minLng ? 8 + ((x.lng - minLng) / (maxLng - minLng)) * 64 : 40;
      const top = maxLat > minLat ? 18 + ((maxLat - x.lat) / (maxLat - minLat)) * 62 : 46;
      return `<div class="gdot" style="left:${left}%;top:${top}%"><span>${esc(x.c.name)}</span></div>`;
    })
    .join("");
  const latestByCity = (c) => c.venues.slice().sort(byRecent)[0]?.visitedAt;

  $("ppTitle").textContent = "Your world";
  $("ppSub").textContent = `${stamps.length} ${stamps.length === 1 ? "venue" : "venues"} across ${located.length} ${located.length === 1 ? "city" : "cities"}`;
  $("ppBody").innerHTML = `
    <div class="pp-layout">
      <div class="book global">
        <div class="hd"><div><div class="eyebrow">Explorer · Level ${p.level}</div><h2>Global Passport</h2></div><div class="seal"><div><b>${located.length}</b>${located.length === 1 ? "CITY" : "CITIES"}</div></div></div>
        <div style="margin-top:24px;display:flex;justify-content:space-between;font-size:13px"><span>${p.xp.toLocaleString()} XP</span><span style="color:var(--gold)">${p.toNext} XP to Level ${p.level + 1} →</span></div>
        <div class="bar" style="margin-top:7px"><i style="width:${p.pct}%"></i></div>
        <div class="gstats"><span>📍 ${stamps.length} venues</span><span>🏅 ${p.badges} badges</span><span>🔥 ${s.streak} ${s.streak === 1 ? "day" : "days"}</span></div>
        ${dots ? `<div class="gmap">${dots}</div>` : ""}
        <div class="stamps" style="grid-template-columns:repeat(4,1fr)">
          ${located.map((c, i) => `<button class="stamp ${STAMP_STYLES[i % STAMP_STYLES.length]}" data-p="${esc(c.id)}" style="color:${CITY_COLORS[i % CITY_COLORS.length]};border-color:${CITY_COLORS[i % CITY_COLORS.length]}"><span class="e">🏙️</span><span class="nm">${esc(c.name)}</span><small>${c.venues.length}</small></button>`).join("")}
        </div>
        ${stamps.length ? "" : '<div class="empty" style="margin-top:18px;color:inherit">Your passport is blank. Check in somewhere to earn your first stamp.</div>'}
      </div>
      <div class="side-col">
        <div class="stats3"><div class="stat"><strong>${stamps.length}</strong><small>Venues</small></div><div class="stat"><strong>${located.length}</strong><small>Cities</small></div><div class="stat"><strong>${p.badges}</strong><small>Badges</small></div></div>
        ${located.length ? '<div class="sec-h">Your cities</div>' : ""}
        ${located
          .map(
            (c, i) => `<button class="city" data-p="${esc(c.id)}"><div class="sk" style="background:${CITY_COLORS[i % CITY_COLORS.length]}33">🏙️</div><div style="flex:1"><h5>${esc(cityLabel(c))}</h5><small>Last visit ${fmtDate(latestByCity(c))}</small><div class="bar"><i style="width:${(c.venues.length / Math.max(1, stamps.length)) * 100}%"></i></div></div><div class="ct">${c.venues.length}<small>stamps</small></div></button>`,
          )
          .join("")}
        ${stamps.length ? `<div class="sec-h">Latest stamps</div><div class="stamps latest">${stamps.slice().sort(byRecent).slice(0, 8).map(stampHtml).join("")}</div>` : ""}
        ${passportNotes()}
      </div>
    </div>`;
}

// ── Badges ──

function renderBadges() {
  const unlocked = unlockedBadges();
  const total = ACHIEVEMENTS.length;
  const pct = Math.round((unlocked.length / total) * 100);
  $("badgeCount").textContent = unlocked.length;
  $("ring").style.background = `conic-gradient(var(--gold) 0 ${pct}%,var(--wash) ${pct}% 100%)`;
  $("ringPct").textContent = `${pct}%`;
  $("badgeTitle").textContent = `${unlocked.length} of ${total} unlocked`;
  const next = ACHIEVEMENTS.filter((a) => (stats[a.stat] || 0) < a.threshold).sort(
    (a, b) => (stats[b.stat] || 0) / b.threshold - (stats[a.stat] || 0) / a.threshold,
  )[0];
  $("badgeSub").textContent = next
    ? `Next up: ${next.label}. ${next.threshold - (stats[next.stat] || 0)} more to go (${next.desc.toLowerCase()}).`
    : "Every badge unlocked. You've conquered the city.";
  const rows = ACHIEVEMENTS.map((a) => {
    const cur = stats[a.stat] || 0;
    return { a, cur, tier: cur >= a.threshold ? "gold" : cur > 0 ? "silver" : "lock" };
  }).filter(({ tier }) =>
    state.badgeFilter === "earned" ? tier === "gold" : state.badgeFilter === "progress" ? tier === "silver" : state.badgeFilter === "locked" ? tier === "lock" : true,
  );
  $("bgrid").innerHTML = rows.length
    ? rows
      .map(
        ({ a, cur, tier }) =>
          `<div class="badge ${tier}" title="${esc(a.desc)}"><div class="hex">${a.emoji}</div><b>${esc(a.label)}</b><small>${tier === "gold" ? `✓ ${esc(a.desc)}` : `${cur} / ${a.threshold} · ${esc(a.desc)}`}</small></div>`,
      )
      .join("")
    : '<div class="empty" style="grid-column:1/-1">Nothing here yet.</div>';
}

// ── Chrome (sidebar, top bar) ──

function renderChrome() {
  const p = progress();
  const s = streakInfo();
  $("lvl").textContent = `Level ${p.level}`;
  $("xp").textContent = `${p.xp.toLocaleString()} XP`;
  $("xpBar").style.width = `${p.pct}%`;
  $("xpNext").textContent = `${p.toNext} XP to Level ${p.level + 1}`;
  $("xp2").textContent = $("xp3").textContent = p.xp.toLocaleString();
  $("streakPill").textContent = s.streak ? `🔥 ${s.streak}-day streak` : "🔥 Start a streak";
  $("cityName").textContent = cityLabel(state.currentCity) || (state.center ? "Locating city…" : "Finding you…");
}

function renderAll() {
  renderChrome();
  renderExplore();
  renderQuests();
  renderPassport();
  renderBadges();
}

// ── Toasts (queued so several unlocks don't overwrite each other) ──

const toasts = [];
let toasting = false;
function toast(text) {
  toasts.push(text);
  if (!toasting) nextToast();
}
function nextToast() {
  const el = $("toast");
  const text = toasts.shift();
  if (!text) return (toasting = false);
  toasting = true;
  el.textContent = text;
  el.classList.add("show");
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(nextToast, 350);
  }, 2600);
}

// ── Navigation & events ──

const app = document.querySelector(".app");
function show(view) {
  state.view = view;
  app.dataset.view = view;
  document.querySelectorAll("#nav button, #tabbar button").forEach((x) => x.classList.toggle("on", x.dataset.view === view));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("on", v.id === view));
}
["nav", "tabbar"].forEach((id) =>
  $(id).addEventListener("click", (e) => {
    const b = e.target.closest("button[data-view]");
    if (b) show(b.dataset.view);
  }),
);
$("cityPick").addEventListener("click", () => {
  show("explore");
  if (state.user) map.setView([state.user.lat, state.user.lng], 15);
});

$("cats").addEventListener("click", (e) => {
  const c = e.target.closest("[data-cat]");
  if (c) setCategory(c.dataset.cat);
});

function onVenuePanelClick(e) {
  const t = e.target.closest("[data-act], [data-id]");
  if (!t) return;
  if (t.dataset.id) {
    state.sheetOpen = false;
    return select(t.dataset.id);
  }
  const act = t.dataset.act;
  if (act === "toggle") {
    state.sheetOpen = !state.sheetOpen;
    renderVenuePanels();
  } else if (act === "back") {
    state.selId = null;
    state.sheetOpen = false;
    renderExplore();
  } else if (act === "checkin") openCheckin();
  else if (act === "retry") {
    delete byCategory[state.category];
    loadVenues();
  }
}
$("detail").addEventListener("click", onVenuePanelClick);
$("sheet").addEventListener("click", onVenuePanelClick);

// ── Sheet drag ──
// Drag the handle (or the summary under it) to open/close the list, like a native bottom sheet.
// While dragging, the sheet is laid out open and slid down by `travel` px when closed.
let suppressSheetClick = false;
const sheetEl = $("sheet");
const setSheetY = (y, animate) => {
  sheetEl.style.transition = animate ? "transform .25s cubic-bezier(.2,.8,.2,1)" : "none";
  sheetEl.style.transform = y ? `translateY(${y}px)` : "";
};
sheetEl.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || !e.target.closest(".grab, .s-sum, .s-venue")) return;
  const wasOpen = state.sheetOpen;
  const closedH = (sheetEl.classList.remove("open"), sheetEl.offsetHeight);
  const openH = (sheetEl.classList.add("open"), sheetEl.offsetHeight);
  const travel = openH - closedH;
  if (travel <= 0) return sheetEl.classList.toggle("open", wasOpen);
  sheetDrag = { id: e.pointerId, startY: e.clientY, wasOpen, travel, y: wasOpen ? 0 : travel, moved: false };
  setSheetY(sheetDrag.y, false);
});
sheetEl.addEventListener("pointermove", (e) => {
  const d = sheetDrag;
  if (!d || e.pointerId !== d.id) return;
  const dy = e.clientY - d.startY;
  if (!d.moved && Math.abs(dy) < 6) return;
  if (!d.moved) {
    d.moved = true;
    sheetEl.setPointerCapture(d.id);
  }
  d.y = Math.min(Math.max((d.wasOpen ? 0 : d.travel) + dy, 0), d.travel);
  setSheetY(d.y, false);
});
function endSheetDrag(e) {
  const d = sheetDrag;
  if (!d || e.pointerId !== d.id) return;
  sheetDrag = null;
  if (!d.moved) {
    // A plain tap: put things back and let the click handler toggle.
    setSheetY(0, false);
    sheetEl.classList.toggle("open", state.sheetOpen);
    return;
  }
  suppressSheetClick = true;
  setTimeout(() => (suppressSheetClick = false));
  // Snap past a third of the way in the direction of travel.
  const open = d.wasOpen ? d.y < d.travel / 3 : d.y < (d.travel * 2) / 3;
  if (open) {
    state.sheetOpen = true;
    renderVenuePanels();
    setSheetY(0, true);
  } else {
    setSheetY(d.travel, true);
    // transitionend never fires if the sheet was already dragged fully down, hence the timer.
    setTimeout(() => {
      if (sheetDrag) return;
      state.sheetOpen = false;
      setSheetY(0, false);
      renderVenuePanels();
    }, 260);
  }
}
sheetEl.addEventListener("pointerup", endSheetDrag);
sheetEl.addEventListener("pointercancel", endSheetDrag);
// The click that follows a drag shouldn't also toggle the sheet.
sheetEl.addEventListener(
  "click",
  (e) => {
    if (!suppressSheetClick) return;
    suppressSheetClick = false;
    e.stopImmediatePropagation();
  },
  true,
);
$("mapStatus").addEventListener("click", onVenuePanelClick);
$("areaBtn").addEventListener("click", () => state.pendingArea && setCenter(state.pendingArea, { move: false }));
$("zoomIn").addEventListener("click", () => map.zoomIn());
$("zoomOut").addEventListener("click", () => map.zoomOut());
$("recenter").addEventListener("click", () => state.user && map.setView([state.user.lat, state.user.lng], 15));

$("search").addEventListener("input", (e) => {
  state.query = e.target.value;
  renderExplore();
});
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    show("explore");
    $("search").focus();
  }
});

$("questFilters").addEventListener("click", (e) => {
  const c = e.target.closest(".chip");
  if (!c) return;
  state.questFilter = c.dataset.f;
  $("questFilters").querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === c));
  renderQuests();
});
$("qgrid").addEventListener("click", (e) => {
  const b = e.target.closest("[data-cat]");
  if (!b) return;
  show("explore");
  setCategory(b.dataset.cat);
});

$("badgeFilters").addEventListener("click", (e) => {
  const c = e.target.closest(".chip");
  if (!c) return;
  state.badgeFilter = c.dataset.f;
  $("badgeFilters").querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === c));
  renderBadges();
});

$("passport").addEventListener("click", (e) => {
  const t = e.target.closest("[data-p], [data-venue], [data-cat], [data-act]");
  if (!t) return;
  if (t.dataset.p) {
    state.ppScope = t.dataset.p;
    renderPassport();
    $("passport").querySelector(".scroll").scrollTop = 0;
  } else if (t.dataset.venue) {
    const v = stamps.find((x) => x.id === t.dataset.venue);
    if (v) openVenue(v);
  } else if (t.dataset.cat) {
    show("explore");
    setCategory(t.dataset.cat);
  } else if (t.dataset.act === "retry-cities") locateStampCities();
});

// ── Start ──

function startLocation() {
  let settled = false;
  const fallback = () => {
    if (settled) return;
    settled = true;
    setCenter(FALLBACK);
    toast("Location unavailable: showing San Francisco. Pan the map and tap “Search this area”.");
  };
  if (!navigator.geolocation) return fallback();
  navigator.geolocation.watchPosition(
    (pos) => {
      state.user = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      updateMe();
      if (!settled) {
        settled = true;
        map.setView([state.user.lat, state.user.lng], 15);
        setCenter(state.user, { move: false });
      } else renderVenuePanels();
    },
    fallback,
    { enableHighAccuracy: true, timeout: 15000 },
  );
}

renderCategoryChips();
renderAll();
startLocation();
locateStampCities();
