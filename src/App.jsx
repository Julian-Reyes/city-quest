/**
 * App.jsx — Main orchestration component
 *
 * This is the root of the City Quest PWA. It owns all application state
 * (venues, user location, selected venue, UI panels) and wires together
 * the extracted modules:
 *
 *   - constants.js        → VENUE_TYPES, ACHIEVEMENTS
 *   - api/cache.js        → getApiCache, setApiCache, filterGhostVenues
 *   - api/overpass.js      → fetchVenues (OSM data)
 *   - api/foursquare.js    → fetchFoursquareDetails (categories)
 *   - api/google.js        → fetchGooglePlaceDetails (ratings, hours, price)
 *   - hooks/useIsDesktop.js → responsive breakpoint
 *   - components/*          → MapView, VenueCard, ListPanel, AchievementsPanel, BottomSheet
 *
 * State-dependent logic (mergeVenues, handleCheckin, handleSearchArea, effects)
 * stays here because it touches multiple pieces of state. Pure functions and
 * self-contained UI were extracted to keep this file navigable.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import "leaflet/dist/leaflet.css";

// ── Data & API ──
import { VENUE_TYPES, ACHIEVEMENTS } from "./constants";
import { getApiCache, setApiCache, filterGhostVenues } from "./api/cache";
import { fetchVenues } from "./api/overpass";
import { fetchFoursquareDetails } from "./api/foursquare";
import { fetchGooglePlaceDetails } from "./api/google";
import {
  getVisits,
  addVisit,
  getVisitPhoto,
  getVisitStats,
  getVisitedVenues,
  getAllVisitedVenues,
  backfillVisitTypes,
} from "./api/visits";
import { resizePhoto } from "./utils/photo";

// ── Hooks ──
import { useIsDesktop } from "./hooks/useIsDesktop";

// ── Components ──
import { MapView } from "./components/MapView";
import { VenueCard } from "./components/VenueCard";
import { ListPanel } from "./components/ListPanel";
import { AchievementsPanel } from "./components/AchievementsPanel";
import { PassportPanel } from "./components/PassportPanel";
import { BottomSheet } from "./components/BottomSheet";
import { CameraOverlay } from "./components/CameraOverlay";

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const isDesktop = useIsDesktop();
  const [activeType, setActiveType] = useState("bar");
  const [venues, setVenues] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [panel, setPanel] = useState("list"); // list | achievements | passport
  const [sheetState, setSheetState] = useState("peek"); // mobile: peek | expanded | collapsed
  const [loading, setLoading] = useState(true);
  const [checkinModal, setCheckinModal] = useState(false);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(null);
  const [toast, setToast] = useState(null);
  const [achievementQueue, setAchievementQueue] = useState([]);
  const [searchArea, setSearchArea] = useState(null); // {lat, lng} when user pans far enough
  const [showCamera, setShowCamera] = useState(false);

  const [fsqLoading, setFsqLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const fileInputRef = useRef(null);
  const venueCacheRef = useRef({});
  const visitsRef = useRef(getVisits());
  const [visitStats, setVisitStats] = useState(() => getVisitStats());

  // ── Hydrate venues with persisted visit data ──
  const hydrateVisits = useCallback((venues) => {
    const saved = visitsRef.current;
    return venues.map((v) => {
      const sv = saved[v.id];
      if (!sv || sv.visits.length === 0) return v;
      const latest = sv.visits[sv.visits.length - 1];
      const latestPhoto = latest.hasPhoto
        ? getVisitPhoto(v.id, sv.visits.length - 1)
        : null;
      return {
        ...v,
        visited: true,
        visitCount: sv.visits.length,
        visits: sv.visits,
        latestVisit: latest,
        visitedAt: latest.at,
        note: latest.note || "",
        photo: latestPhoto,
      };
    });
  }, []);

  const visitedCount = visitStats.total;
  const typeVenues = useMemo(() => {
    const filtered = venues.filter((v) => {
      if (v.type !== activeType) return false;
      // Hide ghost venues: no Google address AND no OSM address
      const noGoogleAddr =
        v.googleData === null || (v.googleData && !v.googleData.address);
      if (noGoogleAddr && (!v.address || v.address.trim() === "")) return false;
      return true;
    });
    if (!userLocation) return filtered;
    const { lat, lng } = userLocation;
    return filtered.sort(
      (a, b) =>
        (a.lat - lat) ** 2 +
        (a.lng - lng) ** 2 -
        ((b.lat - lat) ** 2 + (b.lng - lng) ** 2),
    );
  }, [venues, activeType, userLocation]);
  const typeVisited = typeVenues.filter((v) => v.visited).length;

  const passportVenues = useMemo(() => {
    if (panel !== "passport") return [];
    return getAllVisitedVenues();
  }, [panel, visitStats]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ── Track user location (blue dot + initial fetch center) ──
  const [fetchCenter, setFetchCenter] = useState(null);
  const [cityName, setCityName] = useState("");

  useEffect(() => {
    if (!navigator.geolocation) {
      const loc = { lat: 37.7749, lng: -122.4194 };
      setUserLocation(loc);
      setFetchCenter(loc);
      return;
    }
    let gotCenter = false;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        if (!gotCenter) {
          gotCenter = true;
          setFetchCenter(loc);
        }
      },
      () => {
        if (!gotCenter) {
          gotCenter = true;
          const loc = { lat: 37.7749, lng: -122.4194 };
          setUserLocation(loc);
          setFetchCenter(loc);
        }
      },
      { enableHighAccuracy: true },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ── Reverse geocode city name ──
  useEffect(() => {
    if (!fetchCenter) return;
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${fetchCenter.lat}&lon=${fetchCenter.lng}&format=json&zoom=10`,
    )
      .then((res) => res.json())
      .then((data) => {
        const city =
          data.address?.city ||
          data.address?.town ||
          data.address?.village ||
          data.address?.county ||
          "";
        setCityName(city);
      })
      .catch(() => {});
  }, [fetchCenter]);

  // ── Fetch Foursquare details on venue selection ──
  useEffect(() => {
    if (!selectedVenue || selectedVenue.fsqData !== undefined) {
      setFsqLoading(false);
      return;
    }

    const cached = getApiCache(selectedVenue.id, "fsq");
    if (cached !== undefined) {
      const fsqData = cached;
      setVenues((prev) => {
        const updated = prev.map((v) =>
          v.id === selectedVenue.id ? { ...v, fsqData } : v,
        );
        venueCacheRef.current[activeType] = updated;
        return updated;
      });
      setSelectedVenue((prev) =>
        prev && prev.id === selectedVenue.id ? { ...prev, fsqData } : prev,
      );
      setFsqLoading(false);
      return;
    }

    let cancelled = false;
    setFsqLoading(true);

    fetchFoursquareDetails(
      selectedVenue.name,
      selectedVenue.lat,
      selectedVenue.lng,
    )
      .then((data) => {
        if (cancelled) return;
        const fsqData = data || null;
        setApiCache(selectedVenue.id, "fsq", fsqData);
        setVenues((prev) => {
          const updated = prev.map((v) =>
            v.id === selectedVenue.id ? { ...v, fsqData } : v,
          );
          venueCacheRef.current[activeType] = updated;
          return updated;
        });
        setSelectedVenue((prev) =>
          prev && prev.id === selectedVenue.id ? { ...prev, fsqData } : prev,
        );
        setFsqLoading(false);
      })
      .catch(() => {
        if (!cancelled) setFsqLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedVenue?.id]);

  // ── Fetch Google Place details on venue selection ──
  // Ghost handling: if Google returns null AND venue has no OSM address,
  // we still set googleData on the venue (so typeVenues can filter it out),
  // then close the card and show a toast. No venue-array splicing needed.
  const applyGoogleData = useCallback(
    (venueId, venueAddress, googleData, isVisited) => {
      setVenues((prev) => {
        const updated = prev.map((v) =>
          v.id === venueId ? { ...v, googleData } : v,
        );
        venueCacheRef.current[activeType] = updated;
        return updated;
      });
      const noGoogleAddr =
        googleData === null || (googleData && !googleData.address);
      const ghost =
        !isVisited &&
        noGoogleAddr &&
        (!venueAddress || venueAddress.trim() === "");
      if (ghost) {
        setSelectedVenue(null);
        showToast("Venue not found — removed from map");
      } else {
        setSelectedVenue((prev) =>
          prev && prev.id === venueId ? { ...prev, googleData } : prev,
        );
      }
      setGoogleLoading(false);
    },
    [activeType],
  );

  useEffect(() => {
    if (!selectedVenue || selectedVenue.googleData !== undefined) {
      setGoogleLoading(false);
      return;
    }

    const cached = getApiCache(selectedVenue.id, "google");
    if (cached !== undefined) {
      applyGoogleData(
        selectedVenue.id,
        selectedVenue.address,
        cached,
        selectedVenue.visited,
      );
      return;
    }

    let cancelled = false;
    setGoogleLoading(true);

    fetchGooglePlaceDetails(
      selectedVenue.name,
      selectedVenue.lat,
      selectedVenue.lng,
    )
      .then((data) => {
        if (cancelled) return;
        const googleData = data || null;
        setApiCache(selectedVenue.id, "google", googleData);
        applyGoogleData(
          selectedVenue.id,
          selectedVenue.address,
          googleData,
          selectedVenue.visited,
        );
      })
      .catch(() => {
        if (!cancelled) setGoogleLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedVenue?.id]);

  // ── Merge helper: combine new venues with existing, preserving visited state ──
  const mergeVenues = useCallback((existing, fetched) => {
    const map = new Map(existing.map((v) => [v.id, v]));
    const savedVisits = visitsRef.current;
    for (const v of fetched) {
      if (map.has(v.id)) {
        const old = map.get(v.id);
        map.set(v.id, {
          ...v,
          visited: old.visited,
          visitCount: old.visitCount || 0,
          visits: old.visits || [],
          latestVisit: old.latestVisit || null,
          visitedAt: old.visitedAt,
          photo: old.photo,
          note: old.note,
          fsqData: old.fsqData,
          googleData: old.googleData,
        });
      } else if (savedVisits[v.id] && savedVisits[v.id].visits.length > 0) {
        const sv = savedVisits[v.id];
        const latest = sv.visits[sv.visits.length - 1];
        const latestPhoto = latest.hasPhoto
          ? getVisitPhoto(v.id, sv.visits.length - 1)
          : null;
        map.set(v.id, {
          ...v,
          visited: true,
          visitCount: sv.visits.length,
          visits: sv.visits,
          latestVisit: latest,
          visitedAt: latest.at,
          note: latest.note || "",
          photo: latestPhoto,
        });
      } else {
        map.set(v.id, v);
      }
    }
    return filterGhostVenues(Array.from(map.values()));
  }, []);

  // ── Fetch venues for active type ──
  useEffect(() => {
    if (!fetchCenter) return;
    const controller = new AbortController();

    if (venueCacheRef.current[activeType]) {
      setVenues(venueCacheRef.current[activeType]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchVenues(fetchCenter.lat, fetchCenter.lng, activeType, controller.signal)
      .then((fetched) => {
        const hydrated = hydrateVisits(filterGhostVenues(fetched));
        if (backfillVisitTypes(hydrated)) {
          visitsRef.current = getVisits();
          setVisitStats(getVisitStats());
        }
        // Inject visited venues from localStorage so they show even outside search area
        const savedVisited = getVisitedVenues(activeType);
        const withSaved = savedVisited.length
          ? mergeVenues(savedVisited, hydrated)
          : hydrated;
        venueCacheRef.current[activeType] = withSaved;
        setVenues(withSaved);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("Failed to fetch venues:", err);
        setVenues([]);
        setLoading(false);
      });

    return () => controller.abort();
  }, [activeType, fetchCenter]);

  // ── Search this area handler ──
  const handleSearchArea = useCallback(() => {
    if (!searchArea) return;
    const controller = new AbortController();
    setSearchArea(null);
    const newCenter = { lat: searchArea.lat, lng: searchArea.lng };
    setFetchCenter(newCenter);
    fetchVenues(newCenter.lat, newCenter.lng, activeType, controller.signal)
      .then((fetched) => {
        if (backfillVisitTypes(fetched)) {
          visitsRef.current = getVisits();
          setVisitStats(getVisitStats());
        }
        setVenues((prev) => {
          const merged = mergeVenues(prev, fetched);
          venueCacheRef.current[activeType] = merged;
          return merged;
        });
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("Failed to fetch venues:", err);
        setLoading(false);
      });
  }, [searchArea, activeType, mergeVenues]);

  const handleCheckin = useCallback(async () => {
    if (!selectedVenue) return;
    const wasAlreadyVisited = selectedVenue.visited;

    const visit = { at: new Date().toISOString(), note, hasPhoto: false };

    // Compress and persist photo separately
    let savedPhoto = null;
    if (photo) {
      savedPhoto = await resizePhoto(photo);
      visit.hasPhoto = true;
    }

    // Snapshot stats before persisting (for achievement comparison)
    const statsBefore = getVisitStats();

    // Persist to localStorage
    addVisit(selectedVenue.id, visit, savedPhoto, activeType, {
      name: selectedVenue.name,
      lat: selectedVenue.lat,
      lng: selectedVenue.lng,
    });
    visitsRef.current = getVisits();

    setVenues((prev) => {
      const updated = prev.map((v) => {
        if (v.id !== selectedVenue.id) return v;
        const newVisits = [...(v.visits || []), visit];
        return {
          ...v,
          visited: true,
          visitCount: newVisits.length,
          visits: newVisits,
          latestVisit: visit,
          visitedAt: visit.at,
          note,
          photo: savedPhoto || v.photo,
        };
      });
      // Fix: sync venueCacheRef so tab switching preserves check-ins
      venueCacheRef.current[activeType] = updated;
      return updated;
    });

    // Achievement: compare stats before/after to detect newly crossed thresholds
    const statsAfter = getVisitStats();
    setVisitStats(statsAfter);
    const unlocked = ACHIEVEMENTS.filter(
      (a) =>
        statsBefore[a.stat] < a.threshold && statsAfter[a.stat] >= a.threshold,
    );
    if (unlocked.length > 0) setAchievementQueue(unlocked);

    setCheckinModal(false);
    setSelectedVenue(null);
    setNote("");
    setPhoto(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    showToast(`✅ Checked in to ${selectedVenue.name}!`);
  }, [selectedVenue, note, photo, activeType]);

  const completionPct = typeVenues.length
    ? Math.round((typeVisited / typeVenues.length) * 100)
    : 0;

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "#0f0f1a",
        color: "#fff",
        fontFamily: "'DM Mono', 'Fira Mono', monospace",
        overflow: "hidden",
        maxWidth: isDesktop ? 1400 : undefined,
        margin: isDesktop ? "0 auto" : undefined,
        width: "100%",
        boxShadow: isDesktop ? "0 0 80px rgba(0,0,0,0.5)" : undefined,
      }}
    >
      {/* ── HEADER ── */}
      <header
        style={{
          padding: "12px 16px",
          background: "rgba(15,15,26,0.95)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          backdropFilter: "blur(12px)",
          zIndex: 100,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 20,
              letterSpacing: 3,
              color: "#f59e0b",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            City Quest
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: -0.5,
              lineHeight: 1.1,
            }}
          >
            {VENUE_TYPES.find((t) => t.id === activeType)?.emoji}{" "}
            {VENUE_TYPES.find((t) => t.id === activeType)?.label} Hunter
            {cityName && ` — ${cityName} Edition`}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#f59e0b",
              lineHeight: 1,
            }}
          >
            {typeVisited}
            <span
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.4)",
                fontWeight: 400,
              }}
            >
              /{typeVenues.length}
            </span>
          </div>
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.4)",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {completionPct}% complete
          </div>
        </div>
      </header>

      {/* ── TYPE SWITCHER ── */}
      <div
        style={{
          display: "flex",
          gap: 0,
          background: "#0a0a14",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        {VENUE_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setActiveType(t.id);
              setSelectedVenue(null);
              setSearchArea(null);
              if (!isDesktop) setSheetState("peek");
              if (venueCacheRef.current[t.id]) {
                setVenues(venueCacheRef.current[t.id]);
                setLoading(false);
              } else {
                setVenues([]);
                setLoading(true);
              }
            }}
            style={{
              flex: 1,
              padding: isDesktop ? "10px 4px" : "6px 4px",
              background:
                activeType === t.id ? "rgba(255,255,255,0.06)" : "transparent",
              border: "none",
              color: activeType === t.id ? t.color : "rgba(255,255,255,0.35)",
              cursor: "pointer",
              fontSize: 10,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              fontFamily: "inherit",
              borderBottom:
                activeType === t.id
                  ? `2px solid ${t.color}`
                  : "2px solid transparent",
              transition: "all 0.2s",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            <span
              style={{
                fontSize: isDesktop ? 18 : 17,
                height: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {t.emoji}
            </span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PROGRESS BAR ── */}
      <div
        style={{
          height: 3,
          background: "rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${completionPct}%`,
            background: `linear-gradient(90deg, ${VENUE_TYPES.find((t) => t.id === activeType)?.color}, #fff8)`,
            transition: "width 0.5s ease",
            borderRadius: "0 2px 2px 0",
          }}
        />
      </div>

      {/* ── NAV (list/achievements) ── */}
      <div
        style={{
          display: "flex",
          background: "#0a0a14",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        {[
          ["list", "📋", "List", 0],
          ["achievements", "🏆", "Awards", 3],
          ["passport", "🛂", "Passport", 0],
        ].map(([id, icon, label, iconPadTop]) => (
          <button
            key={id}
            onClick={() => setPanel(id)}
            style={{
              flex: 1,
              padding: isDesktop ? "8px" : "5px",
              background:
                panel === id ? "rgba(255,255,255,0.05)" : "transparent",
              border: "none",
              color: panel === id ? "#fff" : "rgba(255,255,255,0.35)",
              cursor: "pointer",
              fontSize: 10,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              fontFamily: "inherit",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              borderBottom:
                panel === id ? "2px solid #f59e0b" : "2px solid transparent",
            }}
          >
            <span
              style={{
                fontSize: isDesktop ? 16 : 15,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                paddingTop: iconPadTop,
              }}
            >
              {icon}
            </span>
            {label}
          </button>
        ))}
      </div>

      {/* ── MAIN CONTENT ── */}
      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          display: isDesktop ? "flex" : "block",
        }}
      >
        {/* ── MAP (always visible) ── */}
        <div
          style={{
            position: "relative",
            flex: isDesktop ? "1 1 60%" : undefined,
            height: "100%",
            minWidth: 0,
          }}
        >
          {loading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{ fontSize: 40, animation: "spin 1s linear infinite" }}
              >
                {VENUE_TYPES.find((t) => t.id === activeType)?.emoji || "🍺"}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.4)",
                  letterSpacing: 2,
                  fontSize: 11,
                  textTransform: "uppercase",
                }}
              >
                Finding venues...
              </div>
            </div>
          ) : (
            <MapView
              venues={
                panel === "passport"
                  ? passportVenues.filter((v) => v.lat)
                  : typeVenues
              }
              userLocation={userLocation}
              selectedVenue={selectedVenue}
              fetchCenter={fetchCenter}
              searchArea={searchArea}
              onSearchArea={setSearchArea}
              isMobile={!isDesktop}
              onVenueClick={(v) => {
                setSelectedVenue(v);
                if (!isDesktop) setSheetState("collapsed");
              }}
            />
          )}

          {/* SEARCH THIS AREA BUTTON */}
          {searchArea && !loading && panel !== "passport" && (
            <button
              onClick={handleSearchArea}
              style={{
                position: "absolute",
                top: 12,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 600,
                padding: "8px 16px",
                background: "rgba(15,15,26,0.9)",
                border: "1px solid rgba(245,158,11,0.4)",
                borderRadius: 20,
                color: "#f59e0b",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 1,
                cursor: "pointer",
                fontFamily: "inherit",
                backdropFilter: "blur(8px)",
                whiteSpace: "nowrap",
                animation: "fadeIn 0.2s ease",
              }}
            >
              Search this area
            </button>
          )}

          {/* VENUE CARD — mobile only (overlay on map, above collapsed sheet) */}
          {!isDesktop && selectedVenue && (
            <VenueCard
              venue={selectedVenue}
              detailsLoading={fsqLoading || googleLoading}
              onClose={() => {
                setSelectedVenue(null);
                setSheetState("peek");
              }}
              onCheckin={() => setCheckinModal(true)}
              style={{
                position: "absolute",
                bottom: 60,
                left: 0,
                right: 0,
                zIndex: 900,
                background: "linear-gradient(0deg, #0f0f1a 80%, transparent)",
                padding: "32px 16px 16px",
                animation: "slideUp 0.25s ease",
              }}
            />
          )}
        </div>

        {/* ── BOTTOM SHEET (mobile only) ── */}
        {!isDesktop && (
          <BottomSheet
            sheetState={sheetState}
            onStateChange={setSheetState}
            peekPercent={panel === "list" ? 80 : 63}
            dragLabel={
              panel === "list"
                ? `${typeVisited} of ${typeVenues.length} visited`
                : panel === "passport"
                  ? `${passportVenues.length} venues stamped`
                  : null
            }
          >
            {panel === "list" && (
              <ListPanel
                typeVenues={typeVenues}
                typeVisited={typeVisited}
                userLocation={userLocation}
                showHeader={false}
                onVenueClick={(v) => {
                  setSelectedVenue(v);
                  setSheetState("collapsed");
                }}
              />
            )}
            {panel === "passport" && (
              <PassportPanel
                venues={passportVenues}
                userLocation={userLocation}
                onVenueClick={(v) => {
                  setSelectedVenue(v);
                  setSheetState("collapsed");
                }}
              />
            )}
            {panel === "achievements" && (
              <AchievementsPanel stats={visitStats} />
            )}
          </BottomSheet>
        )}

        {/* ── SIDEBAR (desktop only) ── */}
        {isDesktop && (
          <div
            style={{
              flex: "0 0 40%",
              maxWidth: 520,
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              flexDirection: "column",
              height: "100%",
            }}
          >
            {selectedVenue && (
              <VenueCard
                venue={selectedVenue}
                detailsLoading={fsqLoading || googleLoading}
                onClose={() => setSelectedVenue(null)}
                onCheckin={() => setCheckinModal(true)}
                style={{ padding: "12px 12px 0", flexShrink: 0 }}
              />
            )}
            <div style={{ flex: 1, overflow: "hidden" }}>
              {panel === "list" && (
                <ListPanel
                  typeVenues={typeVenues}
                  typeVisited={typeVisited}
                  userLocation={userLocation}
                  onVenueClick={(v) => setSelectedVenue(v)}
                />
              )}
              {panel === "passport" && (
                <PassportPanel
                  venues={passportVenues}
                  userLocation={userLocation}
                  onVenueClick={(v) => setSelectedVenue(v)}
                />
              )}
              {panel === "achievements" && (
                <AchievementsPanel stats={visitStats} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── CHECK-IN MODAL ── */}
      {checkinModal && selectedVenue && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.85)",
              zIndex: 999,
              display: "flex",
              alignItems: isDesktop ? "center" : "flex-end",
              justifyContent: "center",
              backdropFilter: "blur(4px)",
            }}
            onClick={(e) =>
              e.target === e.currentTarget && setCheckinModal(false)
            }
          >
            <div
              style={{
                width: isDesktop ? "100%" : "100%",
                maxWidth: isDesktop ? 440 : undefined,
                background: "#141420",
                borderRadius: isDesktop ? 24 : "24px 24px 0 0",
                padding: "24px 20px 40px",
                animation: isDesktop ? "pop 0.25s ease" : "slideUp 0.3s ease",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 4,
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: 2,
                  margin: "0 auto 20px",
                }}
              />
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                Check In 📍
              </div>
              <div style={{ color: "#f59e0b", marginBottom: 20, fontSize: 14 }}>
                {selectedVenue.name}
              </div>

              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.4)",
                    marginBottom: 8,
                  }}
                >
                  Add a note (optional)
                </div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Great craft beer selection..."
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10,
                    padding: 12,
                    color: "#fff",
                    fontSize: 14,
                    fontFamily: "inherit",
                    resize: "none",
                    height: 80,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button
                  onClick={() => setShowCamera(true)}
                  style={{
                    flex: 1,
                    padding: 12,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px dashed rgba(255,255,255,0.2)",
                    borderRadius: 10,
                    color: "rgba(255,255,255,0.5)",
                    fontFamily: "inherit",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  📷 {photo ? "Retake" : "Take Photo"}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    flex: 1,
                    padding: 12,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px dashed rgba(255,255,255,0.2)",
                    borderRadius: 10,
                    color: "rgba(255,255,255,0.5)",
                    fontFamily: "inherit",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  🖼 {photo ? "Change" : "Library"}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setPhoto(reader.result);
                  reader.onerror = () => showToast("Failed to read photo");
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
              {photo && (
                <div style={{ position: "relative", marginBottom: 10 }}>
                  <img
                    src={photo}
                    alt=""
                    style={{
                      width: "100%",
                      borderRadius: 10,
                      maxHeight: 160,
                      objectFit: "cover",
                    }}
                  />
                  <button
                    onClick={() => {
                      setPhoto(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      background: "rgba(0,0,0,0.7)",
                      border: "none",
                      color: "#fff",
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    ×
                  </button>
                </div>
              )}

              <button
                onClick={handleCheckin}
                style={{
                  width: "100%",
                  padding: 14,
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  border: "none",
                  borderRadius: 12,
                  color: "#000",
                  fontWeight: 700,
                  fontSize: 15,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                ✓ Confirm Check-In
              </button>
            </div>
          </div>
          {showCamera && (
            <CameraOverlay
              onCapture={(base64) => setPhoto(base64)}
              onClose={() => setShowCamera(false)}
              showToast={showToast}
            />
          )}
        </>
      )}

      {/* ── ACHIEVEMENT UNLOCK (queue: tap advances to next) ── */}
      {achievementQueue.length > 0 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(8px)",
          }}
          onClick={() => setAchievementQueue((q) => q.slice(1))}
        >
          <div
            style={{
              textAlign: "center",
              animation: "pop 0.4s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <div style={{ fontSize: 80, marginBottom: 16 }}>
              {achievementQueue[0].emoji}
            </div>
            <div
              style={{
                fontSize: 12,
                letterSpacing: 4,
                color: "#f59e0b",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Achievement Unlocked
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
              {achievementQueue[0].label}
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
              {achievementQueue[0].desc}
            </div>
            <div
              style={{
                marginTop: 30,
                fontSize: 11,
                color: "rgba(255,255,255,0.2)",
                letterSpacing: 2,
              }}
            >
              TAP TO CONTINUE
              {achievementQueue.length > 1
                ? ` (${achievementQueue.length - 1} more)`
                : ""}
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 80,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(34,197,94,0.15)",
            border: "1px solid rgba(34,197,94,0.4)",
            backdropFilter: "blur(12px)",
            color: "#22c55e",
            padding: "10px 20px",
            borderRadius: 100,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 2000,
            whiteSpace: "nowrap",
            animation: "fadeIn 0.2s ease",
          }}
        >
          {toast}
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes pop { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { display: none; }
        textarea:focus { border-color: rgba(245,158,11,0.4) !important; }
      `}</style>
    </div>
  );
}
