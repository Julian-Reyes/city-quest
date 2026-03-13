import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const VENUE_TYPES = [
  { id: "bar", label: "Bars", emoji: "🍺", color: "#f59e0b" },
  { id: "cafe", label: "Coffee", emoji: "☕", color: "#92400e" },
  { id: "ice_cream", label: "Ice Cream", emoji: "🍦", color: "#ec4899" },
  { id: "restaurant", label: "Food", emoji: "🍔", color: "#10b981" },
];

const ACHIEVEMENTS = [
  {
    id: "first",
    label: "First Sip",
    desc: "Check in to your first venue",
    emoji: "🥇",
    threshold: 1,
  },
  {
    id: "five",
    label: "Night Owl",
    desc: "Visit 5 venues",
    emoji: "🦉",
    threshold: 5,
  },
  {
    id: "ten",
    label: "Bar Hopper",
    desc: "Visit 10 venues",
    emoji: "🏃",
    threshold: 10,
  },
  {
    id: "twenty",
    label: "Local Legend",
    desc: "Visit 20 venues",
    emoji: "👑",
    threshold: 20,
  },
  {
    id: "fifty",
    label: "City Conqueror",
    desc: "Visit 50 venues",
    emoji: "🏆",
    threshold: 50,
  },
];

// ─── OVERPASS API (OpenStreetMap) ────────────────────────────────────────────
function buildAddress(tags) {
  const num = tags["addr:housenumber"] || "";
  const street = tags["addr:street"] || "";
  if (num && street) return `${num} ${street}`;
  if (street) return street;
  if (tags["addr:full"]) return tags["addr:full"];
  const city = tags["addr:city"] || "";
  const state = tags["addr:state"] || "";
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (tags["addr:suburb"]) return tags["addr:suburb"];
  if (tags["addr:neighbourhood"]) return tags["addr:neighbourhood"];
  if (tags["addr:place"]) return tags["addr:place"];
  if (tags["addr:district"]) return tags["addr:district"];
  if (tags["addr:postcode"]) return `Zip ${tags["addr:postcode"]}`;
  return " "; //removed "Address not listed"
}

async function fetchVenues(lat, lng, type, signal) {
  const query = `[out:json][timeout:10];nwr["amenity"="${type}"](around:8000,${lat},${lng});out center body;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal,
  });
  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
  const data = await res.json();
  return data.elements
    .filter((el) => el.tags?.name && (el.lat || el.center?.lat))
    .map((el) => ({
      id: `osm-${el.id}`,
      name: el.tags.name,
      type,
      lat: el.lat ?? el.center.lat,
      lng: el.lon ?? el.center.lon,
      address: buildAddress(el.tags),
      visited: false,
      visitedAt: null,
      photo: null,
      note: "",
    }));
}

// ─── API BASE URLs (proxy in dev, direct in production) ───────────────────
const isDev = import.meta.env.DEV;
const FSQ_BASE = isDev ? "/api/fsq" : "https://fsq-proxy.city-quest.workers.dev";
const GOOGLE_BASE = isDev ? "/api/google" : "https://places.googleapis.com";

// ─── FOURSQUARE PLACES API ─────────────────────────────────────────────────
async function fetchFoursquareDetails(name, lat, lng) {
  const apiKey = import.meta.env.VITE_FOURSQUARE_API_KEY;
  if (!apiKey && isDev) return null; // In prod, worker handles auth — no key needed

  // In dev: send API key directly via Vite proxy. In prod: worker adds it server-side.
  const headers = isDev
    ? { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "X-Places-Api-Version": "2025-06-17" }
    : { Accept: "application/json" };

  try {
    const searchRes = await fetch(
      `${FSQ_BASE}/places/search?ll=${lat},${lng}&query=${encodeURIComponent(name)}&limit=1`,
      { headers },
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const place = searchData.results?.[0];
    if (!place) return null;

    const fsqId = place.fsq_place_id;

    // Photos and tips are premium endpoints — commented out to save API costs
    // const [photoRes, tipsRes] = await Promise.all([
    //   fetch(
    //     `${FSQ_BASE}/places/${fsqId}/photos?limit=1`,
    //     { headers },
    //   ).catch(() => null),
    //   fetch(
    //     `${FSQ_BASE}/places/${fsqId}/tips?limit=1`,
    //     { headers },
    //   ).catch(() => null),
    // ]);

    // let photo = null;
    // if (photoRes?.ok) {
    //   const photos = await photoRes.json();
    //   if (photos?.[0]) {
    //     photo = `${photos[0].prefix}300x200${photos[0].suffix}`;
    //   }
    // }

    // let tip = null;
    // if (tipsRes?.ok) {
    //   const tips = await tipsRes.json();
    //   if (tips?.[0]?.text) {
    //     tip = tips[0].text;
    //   }
    // }

    return {
      // photo,
      category: place.categories?.[0]?.name || null,
      price: place.price || null,
      rating: place.rating || null,
      hours: place.hours
        ? { open_now: place.hours.open_now, display: place.hours.display }
        : null,
      // tip,
    };
  } catch (err) {
    console.error("Foursquare fetch error:", err);
    return null;
  }
}

// ─── GOOGLE PLACES API (New) ───────────────────────────────────────────────
const GOOGLE_PRICE_MAP = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

async function fetchGooglePlaceDetails(name, lat, lng) {
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_KEY;
  if (!apiKey) return null;

  try {
    const searchRes = await fetch(`${GOOGLE_BASE}/v1/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          // "places.id,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours,places.photos,places.reviews",
          "places.id,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours,places.formattedAddress,places.location",
      },
      body: JSON.stringify({
        textQuery: name,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 500.0,
          },
        },
        maxResultCount: 1,
      }),
    });
    if (!searchRes.ok) return null;
    const data = await searchRes.json();
    const place = data.places?.[0];
    if (!place) return null;

    // Compute distance between OSM coords and Google's result
    let googleDist = null;
    if (place.location) {
      const R = 6371000;
      const dLat = ((place.location.latitude - lat) * Math.PI) / 180;
      const dLng = ((place.location.longitude - lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((place.location.latitude * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      googleDist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // let photo = null;
    // if (place.photos?.[0]?.name) {
    //   const photoRes = await fetch(
    //     `${GOOGLE_BASE}/v1/${place.photos[0].name}/media?maxHeightPx=300&skipHttpRedirect=true`,
    //     { headers: { "X-Goog-Api-Key": apiKey } },
    //   );
    //   if (photoRes.ok) {
    //     const photoData = await photoRes.json();
    //     photo = photoData.photoUri || null;
    //   }
    // }

    let hours = null;
    if (place.currentOpeningHours) {
      const dayIndex =
        new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
      hours = {
        open_now: place.currentOpeningHours.openNow,
        display:
          place.currentOpeningHours.weekdayDescriptions?.[dayIndex] || null,
      };
    }

    // let review = null;
    // if (place.reviews?.[0]?.text?.text) {
    //   review = place.reviews[0].text.text;
    // }

    return {
      // photo,
      rating: place.rating || null,
      ratingCount: place.userRatingCount || null,
      price: GOOGLE_PRICE_MAP[place.priceLevel] ?? null,
      hours,
      // review,
      address:
        googleDist !== null && googleDist <= 150
          ? place.formattedAddress || null
          : null,
    };
  } catch (err) {
    console.error("Google Places fetch error:", err);
    return null;
  }
}

// ─── MARKER ICON HELPERS ────────────────────────────────────────────────────
function venueIcon(venue, isSelected, isMobile = false) {
  const color = venue.visited
    ? "#22c55e"
    : VENUE_TYPES.find((t) => t.id === venue.type)?.color || "#f59e0b";
  const size = isSelected ? (isMobile ? 34 : 20) : isMobile ? 23 : 14;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid ${venue.visited ? "#22c55e" : "rgba(255,255,255,0.4)"};box-shadow:0 0 ${venue.visited ? "8px" : "4px"} ${color};cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;font-size:${size * 0.55}px">${venue.visited ? "✓" : VENUE_TYPES.find((t) => t.id === venue.type)?.emoji || "📍"}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function userIcon(isMobile = false) {
  const size = isMobile ? 24 : 16;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.3)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ─── MAP COMPONENT (react-leaflet) ──────────────────────────────────────────
function RecenterMap({ center, selectedVenue }) {
  const map = useMap();
  const hasInitialized = useRef(false);

  // Center on initial load only
  useEffect(() => {
    if (center && !hasInitialized.current) {
      hasInitialized.current = true;
      map.setView([center.lat, center.lng], map.getZoom());
    }
  }, [center]);

  // Center when a venue is selected
  useEffect(() => {
    if (selectedVenue) {
      map.setView([selectedVenue.lat, selectedVenue.lng], map.getZoom());
    }
  }, [selectedVenue]);

  return null;
}

function MapMoveDetector({ fetchCenter, onSearchArea }) {
  const map = useMapEvents({
    moveend: () => {
      if (!fetchCenter) return;
      const center = map.getCenter();
      const zoom = map.getZoom();
      const dist = distanceMiles(
        fetchCenter.lat,
        fetchCenter.lng,
        center.lat,
        center.lng,
      );
      if (zoom >= 12 && dist > 1.5) {
        onSearchArea({ lat: center.lat, lng: center.lng, zoom });
      } else {
        onSearchArea(null);
      }
    },
  });
  return null;
}

function MapView({
  venues,
  userLocation,
  onVenueClick,
  selectedVenue,
  fetchCenter,
  onSearchArea,
  searchArea,
  isMobile,
}) {
  const center = userLocation || { lat: 37.7749, lng: -122.4194 };

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={14}
      zoomControl={false}
      style={{ width: "100%", height: "100%", background: "#1a1a2e" }}
    >
      <TileLayer
        url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
        attribution="&copy; Stadia Maps"
        maxZoom={19}
      />
      <RecenterMap center={userLocation} selectedVenue={selectedVenue} />
      <MapMoveDetector fetchCenter={fetchCenter} onSearchArea={onSearchArea} />
      {venues.map((venue) => (
        <Marker
          key={venue.id}
          position={[venue.lat, venue.lng]}
          icon={venueIcon(venue, selectedVenue?.id === venue.id, isMobile)}
          eventHandlers={{ click: () => onVenueClick(venue) }}
        />
      ))}
      {userLocation && (
        <Marker
          position={[userLocation.lat, userLocation.lng]}
          icon={userIcon(isMobile)}
        />
      )}
    </MapContainer>
  );
}

// ─── HOOKS ───────────────────────────────────────────────────────────────────
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia("(min-width: 768px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

// ─── VENUE CARD (shared between mobile overlay & desktop sidebar) ───────────
function VenueCard({ venue, onClose, onCheckin, style, detailsLoading }) {
  if (!venue) return null;
  const fsq = venue.fsqData;
  const goog = venue.googleData;
  const price = goog?.price ?? fsq?.price;
  const priceStr = price ? "$".repeat(price) : null;
  const rating = goog?.rating ?? fsq?.rating;
  const ratingStr =
    rating != null
      ? `⭐ ${rating.toFixed(1)}${goog?.ratingCount ? ` (${goog.ratingCount})` : ""}`
      : null;
  const hours = goog?.hours || fsq?.hours;
  // const venuePhoto = goog?.photo || fsq?.photo;
  // const tip = goog?.review || fsq?.tip;
  const detailParts = [fsq?.category, priceStr, ratingStr].filter(Boolean);

  return (
    <div style={style}>
      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          padding: 16,
          backdropFilter: "blur(20px)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 8,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 2 }}>
              {venue.name}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.45)",
                letterSpacing: 1,
              }}
            >
              {venue.address?.trim() ? venue.address : goog?.address || venue.address}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              color: "#fff",
              width: 28,
              height: 28,
              borderRadius: "50%",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ×
          </button>
        </div>
        {detailParts.length > 0 && (
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.6)",
              marginBottom: 6,
            }}
          >
            {detailParts.join(" · ")}
          </div>
        )}
        {hours && (
          <div
            style={{
              fontSize: 12,
              color: hours.open_now ? "#22c55e" : "#ef4444",
              marginBottom: 10,
            }}
          >
            {hours.open_now ? "🟢" : "🔴"}{" "}
            {hours.display || (hours.open_now ? "Open now" : "Closed")}
          </div>
        )}
        {/* venuePhoto and tip/review commented out to save API costs
        {venuePhoto && (
          <img
            src={venuePhoto}
            alt=""
            style={{
              width: "100%",
              borderRadius: 8,
              marginBottom: 10,
              maxHeight: 200,
              objectFit: "cover",
            }}
          />
        )}
        {tip && (
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.5)",
              fontStyle: "italic",
              marginBottom: 12,
              lineHeight: 1.4,
            }}
          >
            &ldquo;{tip}&rdquo;
          </div>
        )}
        */}
        {detailsLoading && (
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.3)",
              marginBottom: 10,
              letterSpacing: 1,
            }}
          >
            Loading details...
          </div>
        )}
        {venue.visited && (
          <div style={{ marginBottom: 14, fontSize: 12, color: "#22c55e" }}>
            ✓ Visited {new Date(venue.visitedAt).toLocaleDateString()}
          </div>
        )}
        {venue.photo && (
          <img
            src={venue.photo}
            alt=""
            style={{
              width: "100%",
              borderRadius: 8,
              marginBottom: 12,
              maxHeight: 200,
              objectFit: "cover",
            }}
          />
        )}
        {!venue.visited ? (
          <button
            onClick={onCheckin}
            style={{
              width: "100%",
              padding: "12px",
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              border: "none",
              borderRadius: 10,
              color: "#000",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            📍 Check In Here
          </button>
        ) : (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 10,
              color: "#22c55e",
              fontSize: 13,
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            ✓ Already conquered this one
          </div>
        )}
      </div>
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function distanceMiles(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── SIDEBAR CONTENT ────────────────────────────────────────────────────────
function ListPanel({
  typeVenues,
  typeVisited,
  onVenueClick,
  userLocation,
  showHeader = true,
}) {
  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        padding: showHeader ? "12px 12px 80px" : "4px 12px 80px",
      }}
    >
      {showHeader && (
        <div
          style={{
            marginBottom: 12,
            color: "rgba(255,255,255,0.4)",
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {typeVisited} of {typeVenues.length} visited
        </div>
      )}
      {typeVenues.map((v) => (
        <div
          key={v.id}
          onClick={() => onVenueClick(v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            marginBottom: 6,
            background: v.visited
              ? "rgba(34,197,94,0.07)"
              : "rgba(255,255,255,0.03)",
            border: `1px solid ${v.visited ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)"}`,
            borderRadius: 12,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: v.visited
                ? "rgba(34,197,94,0.2)"
                : "rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            {v.visited ? "✅" : VENUE_TYPES.find((t) => t.id === v.type)?.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                marginBottom: 2,
                color: v.visited ? "#fff" : "rgba(255,255,255,0.7)",
              }}
            >
              {v.name}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.35)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {v.address}
              {userLocation &&
                `   (${distanceMiles(userLocation.lat, userLocation.lng, v.lat, v.lng).toFixed(1)} mi)`}
            </div>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.25)",
              flexShrink: 0,
            }}
          >
            {v.visited ? <span style={{ color: "#22c55e" }}>✓</span> : "›"}
          </div>
        </div>
      ))}
    </div>
  );
}

function AchievementsPanel({ visitedCount }) {
  return (
    <div
      style={{ height: "100%", overflowY: "auto", padding: "16px 12px 80px" }}
    >
      <div
        style={{
          marginBottom: 20,
          padding: "16px",
          background: "rgba(245,158,11,0.08)",
          border: "1px solid rgba(245,158,11,0.2)",
          borderRadius: 16,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 4 }}>🎮</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: "#f59e0b" }}>
          {visitedCount}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          Total venues conquered
        </div>
      </div>
      {ACHIEVEMENTS.map((a) => {
        const unlocked = visitedCount >= a.threshold;
        return (
          <div
            key={a.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 16px",
              marginBottom: 8,
              background: unlocked
                ? "rgba(245,158,11,0.08)"
                : "rgba(255,255,255,0.02)",
              border: `1px solid ${unlocked ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.05)"}`,
              borderRadius: 14,
              opacity: unlocked ? 1 : 0.45,
            }}
          >
            <div
              style={{
                fontSize: 32,
                filter: unlocked ? "none" : "grayscale(100%)",
              }}
            >
              {a.emoji}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  color: unlocked ? "#f59e0b" : "rgba(255,255,255,0.5)",
                  marginBottom: 2,
                }}
              >
                {a.label}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                {a.desc}
              </div>
              {!unlocked && (
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.2)",
                    marginTop: 4,
                    letterSpacing: 1,
                  }}
                >
                  {a.threshold - visitedCount} more to go
                </div>
              )}
            </div>
            {unlocked && (
              <div style={{ color: "#f59e0b", fontSize: 18 }}>✓</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── BOTTOM SHEET (mobile only) ──────────────────────────────────────────────
function BottomSheet({ sheetState, onStateChange, children, dragLabel }) {
  const sheetRef = useRef(null);
  const dragRef = useRef({ startY: 0, startTranslate: 0, isDragging: false });

  const getTranslateY = (state) => {
    switch (state) {
      case "expanded":
        return 15;
      case "peek":
        return 70;
      case "collapsed":
        return 92;
      default:
        return 70;
    }
  };

  const handleTouchStart = useCallback(
    (e) => {
      dragRef.current = {
        startY: e.touches[0].clientY,
        startTranslate: getTranslateY(sheetState),
        isDragging: true,
      };
      if (sheetRef.current) sheetRef.current.style.transition = "none";
    },
    [sheetState],
  );

  const handleTouchMove = useCallback((e) => {
    if (!dragRef.current.isDragging || !sheetRef.current) return;
    const deltaY = e.touches[0].clientY - dragRef.current.startY;
    const containerHeight = sheetRef.current.parentElement.offsetHeight;
    const deltaPercent = (deltaY / containerHeight) * 100;
    const newTranslate = Math.max(
      15,
      Math.min(92, dragRef.current.startTranslate + deltaPercent),
    );
    sheetRef.current.style.transform = `translateY(${newTranslate}%)`;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!dragRef.current.isDragging || !sheetRef.current) return;
    dragRef.current.isDragging = false;
    sheetRef.current.style.transition = "transform 0.3s ease";
    const match = sheetRef.current.style.transform.match(
      /translateY\(([\d.]+)%\)/,
    );
    const currentY = match ? parseFloat(match[1]) : getTranslateY(sheetState);
    let target;
    if (currentY < 42) target = "expanded";
    else if (currentY < 82) target = "peek";
    else target = "collapsed";
    onStateChange(target);
    sheetRef.current.style.transform = `translateY(${getTranslateY(target)}%)`;
  }, [sheetState, onStateChange]);

  return (
    <div
      ref={sheetRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "100%",
        transform: `translateY(${getTranslateY(sheetState)}%)`,
        transition: "transform 0.3s ease",
        zIndex: 500,
        display: "flex",
        flexDirection: "column",
        background: "#0f0f1a",
        borderRadius: "16px 16px 0 0",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.5)",
      }}
    >
      {/* Drag handle zone (includes pill + label row) */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          padding: "10px 12px 8px",
          cursor: "grab",
          touchAction: "none",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            background: "rgba(255,255,255,0.2)",
            borderRadius: 2,
            margin: "0 auto 10px",
          }}
        />
        {dragLabel && (
          <div
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {dragLabel}
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overscrollBehavior: "contain",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const isDesktop = useIsDesktop();
  const [activeType, setActiveType] = useState("bar");
  const [venues, setVenues] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [panel, setPanel] = useState("list"); // list | achievements
  const [sheetState, setSheetState] = useState("peek"); // mobile: peek | expanded | collapsed
  const [loading, setLoading] = useState(true);
  const [checkinModal, setCheckinModal] = useState(false);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(null);
  const [toast, setToast] = useState(null);
  const [newAchievement, setNewAchievement] = useState(null);
  const [searchArea, setSearchArea] = useState(null); // {lat, lng} when user pans far enough

  const [fsqLoading, setFsqLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const fileInputRef = useRef(null);
  const venueCacheRef = useRef({});

  const visitedCount = venues.filter((v) => v.visited).length;
  const typeVenues = useMemo(() => {
    const filtered = venues.filter((v) => v.type === activeType);
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
    let cancelled = false;
    setFsqLoading(true);

    fetchFoursquareDetails(selectedVenue.name, selectedVenue.lat, selectedVenue.lng)
      .then((data) => {
        if (cancelled) return;
        const fsqData = data || null;
        setVenues((prev) => {
          const updated = prev.map((v) =>
            v.id === selectedVenue.id ? { ...v, fsqData } : v,
          );
          venueCacheRef.current[activeType] = updated;
          return updated;
        });
        setSelectedVenue((prev) =>
          prev && prev.id === selectedVenue.id
            ? { ...prev, fsqData }
            : prev,
        );
        setFsqLoading(false);
      })
      .catch(() => {
        if (!cancelled) setFsqLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedVenue?.id]);

  // ── Fetch Google Place details on venue selection ──
  useEffect(() => {
    if (!selectedVenue || selectedVenue.googleData !== undefined) {
      setGoogleLoading(false);
      return;
    }
    let cancelled = false;
    setGoogleLoading(true);

    fetchGooglePlaceDetails(selectedVenue.name, selectedVenue.lat, selectedVenue.lng)
      .then((data) => {
        if (cancelled) return;
        const googleData = data || null;
        setVenues((prev) => {
          const updated = prev.map((v) =>
            v.id === selectedVenue.id ? { ...v, googleData } : v,
          );
          venueCacheRef.current[activeType] = updated;
          return updated;
        });
        setSelectedVenue((prev) =>
          prev && prev.id === selectedVenue.id
            ? { ...prev, googleData }
            : prev,
        );
        setGoogleLoading(false);
      })
      .catch(() => {
        if (!cancelled) setGoogleLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedVenue?.id]);

  // ── Merge helper: combine new venues with existing, preserving visited state ──
  const mergeVenues = useCallback((existing, fetched) => {
    const map = new Map(existing.map((v) => [v.id, v]));
    for (const v of fetched) {
      if (map.has(v.id)) {
        const old = map.get(v.id);
        map.set(v.id, {
          ...v,
          visited: old.visited,
          visitedAt: old.visitedAt,
          photo: old.photo,
          note: old.note,
          fsqData: old.fsqData,
          googleData: old.googleData,
        });
      } else {
        map.set(v.id, v);
      }
    }
    return Array.from(map.values());
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
        venueCacheRef.current[activeType] = fetched;
        setVenues(fetched);
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

  const handleCheckin = useCallback(() => {
    if (!selectedVenue) return;
    const prevVisited = venues.filter((v) => v.visited).length;

    setVenues((prev) =>
      prev.map((v) =>
        v.id === selectedVenue.id
          ? {
              ...v,
              visited: true,
              visitedAt: new Date().toISOString(),
              note,
              photo,
            }
          : v,
      ),
    );

    const newCount = prevVisited + 1;
    const unlocked = ACHIEVEMENTS.find((a) => a.threshold === newCount);
    if (unlocked) setNewAchievement(unlocked);

    setCheckinModal(false);
    setSelectedVenue(null);
    setNote("");
    setPhoto(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    showToast(`✅ Checked in to ${selectedVenue.name}!`);
  }, [selectedVenue, venues, note, photo]);

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
              fontSize: 11,
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
              fontSize: 20,
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
              padding: "10px 4px",
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
            <span style={{ fontSize: 18 }}>{t.emoji}</span>
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
          ["list", "📋", "List"],
          ["achievements", "🏆", "Awards"],
        ].map(([id, icon, label]) => (
          <button
            key={id}
            onClick={() => setPanel(id)}
            style={{
              flex: 1,
              padding: "8px",
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
            <span style={{ fontSize: 16 }}>{icon}</span>
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
              venues={typeVenues}
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
          {searchArea && !loading && (
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
            dragLabel={
              panel === "list"
                ? `${typeVisited} of ${typeVenues.length} visited`
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
            {panel === "achievements" && (
              <AchievementsPanel visitedCount={visitedCount} />
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
              {panel === "achievements" && (
                <AchievementsPanel visitedCount={visitedCount} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── CHECK-IN MODAL ── */}
      {checkinModal && selectedVenue && (
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

            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 10,
                background: "rgba(255,255,255,0.05)",
                border: "1px dashed rgba(255,255,255,0.2)",
                borderRadius: 10,
                color: "rgba(255,255,255,0.5)",
                fontFamily: "inherit",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              📸 {photo ? "Change Photo" : "Add Photo (optional)"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setPhoto(reader.result);
                reader.readAsDataURL(file);
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
      )}

      {/* ── ACHIEVEMENT UNLOCK ── */}
      {newAchievement && (
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
          onClick={() => setNewAchievement(null)}
        >
          <div
            style={{
              textAlign: "center",
              animation: "pop 0.4s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <div style={{ fontSize: 80, marginBottom: 16 }}>
              {newAchievement.emoji}
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
              {newAchievement.label}
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
              {newAchievement.desc}
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
