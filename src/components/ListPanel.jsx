/**
 * ListPanel.jsx — Scrollable venue list for the active type
 *
 * Shows all venues sorted by distance, with visited ones highlighted green.
 * Used in both the mobile bottom sheet and the desktop sidebar.
 *
 * The showHeader prop controls whether the "X of Y visited" header appears —
 * on mobile it's hidden because the BottomSheet's drag label already shows it.
 */

import { CATEGORY_MAP } from "../constants";
import { distanceMiles } from "../utils/distance";

export function ListPanel({
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
            {v.visited ? "✅" : CATEGORY_MAP[v.type]?.emoji}
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
