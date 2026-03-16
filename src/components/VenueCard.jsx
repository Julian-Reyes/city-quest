/**
 * VenueCard.jsx — Venue detail card (shared between mobile overlay & desktop sidebar)
 *
 * Shows venue name, address, category, price, rating, hours, and check-in status.
 * On mobile it slides up as an overlay on the map; on desktop it sits at the top
 * of the sidebar. The parent controls positioning via the `style` prop.
 *
 * Data sources merged here:
 *   - venue.fsqData  → Foursquare category
 *   - venue.googleData → rating, rating count, price, hours, address fallback
 *
 * Photos and reviews are commented out to save API costs.
 */

export function VenueCard({ venue, onClose, onCheckin, style, detailsLoading }) {
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
              {venue.address?.trim()
                ? venue.address
                : goog?.address || venue.address}
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
          <div style={{ marginBottom: 6, fontSize: 12, color: "#22c55e" }}>
            ✓ Visited {venue.visitCount || 1}x — last{" "}
            {new Date(venue.visitedAt).toLocaleDateString()}
          </div>
        )}
        {venue.latestVisit?.note && (
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.45)",
              fontStyle: "italic",
              marginBottom: 10,
              lineHeight: 1.4,
            }}
          >
            &ldquo;{venue.latestVisit.note}&rdquo;
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
          <div style={{ display: "flex", gap: 8 }}>
            <div
              style={{
                flex: 1,
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
              ✓ Conquered
            </div>
            <button
              onClick={onCheckin}
              style={{
                padding: "10px 14px",
                background: "rgba(245,158,11,0.12)",
                border: "1px solid rgba(245,158,11,0.3)",
                borderRadius: 10,
                color: "#f59e0b",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              + Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
