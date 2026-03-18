/**
 * MapView.jsx — Leaflet map with venue pins and user location dot
 *
 * Contains three sub-components:
 *   - RecenterMap: centers the map on initial load and when a venue is selected
 *   - MapMoveDetector: watches for pan/zoom and fires onSearchArea when user
 *     moves >3 miles from the fetch center (triggers "Search this area" button)
 *   - MapView: the main map container with venue markers and user dot
 *
 * Also exports venueIcon() for creating colored Leaflet divIcons — used here
 * and could be reused if map markers are needed elsewhere.
 *
 * Uses CartoDB/Stadia dark tiles to match the app's dark theme.
 */

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { VENUE_TYPES } from "../constants";
import { distanceMiles } from "../utils/distance";

export function venueIcon(venue, isSelected, isMobile = false) {
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

function MapMoveDetector({ fetchCenter, fetchZoom, onSearchArea }) {
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
      // Compute visible radius from map bounds (center to edge in meters)
      const bounds = map.getBounds();
      const edgeLat = bounds.getNorth();
      const R = 6371000;
      const dLat = ((edgeLat - center.lat) * Math.PI) / 180;
      const visibleRadius = Math.round(R * Math.abs(dLat));

      // Show button when panned >1 mile or zoomed out from last fetch
      if (zoom >= 12 && (dist > 1 || zoom < fetchZoom)) {
        onSearchArea({ lat: center.lat, lng: center.lng, zoom, radius: visibleRadius });
      } else {
        onSearchArea(null);
      }
    },
  });
  return null;
}

export function MapView({
  venues,
  userLocation,
  onVenueClick,
  selectedVenue,
  fetchCenter,
  fetchZoom,
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
      <MapMoveDetector fetchCenter={fetchCenter} fetchZoom={fetchZoom} onSearchArea={onSearchArea} />
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
