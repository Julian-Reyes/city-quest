import { VENUE_TYPES } from "../constants";

const TYPE_MAP = Object.fromEntries(VENUE_TYPES.map((t) => [t.id, t]));

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PassportPanel({ venues, userLocation, onVenueClick }) {
  if (!venues.length) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          textAlign: "center",
          color: "rgba(255,255,255,0.35)",
          fontSize: 14,
        }}
      >
        No stamps yet — check in to venues to fill your passport
      </div>
    );
  }

  // Group by type, sorted most-recent-first within each group
  const grouped = {};
  for (const v of venues) {
    const t = v.type || "unknown";
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(v);
  }
  for (const arr of Object.values(grouped)) {
    arr.sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt));
  }

  // Order groups by VENUE_TYPES order, skip types with no visits
  const orderedTypes = VENUE_TYPES.map((t) => t.id).filter((id) => grouped[id]);
  // Append any unknown types at end
  for (const key of Object.keys(grouped)) {
    if (!orderedTypes.includes(key)) orderedTypes.push(key);
  }

  // Type breakdown counts
  const typeCounts = orderedTypes.map((id) => ({
    id,
    count: grouped[id].length,
    ...TYPE_MAP[id],
  }));

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "16px 12px 80px" }}>
      {/* Header card */}
      <div
        style={{
          marginBottom: 16,
          padding: "16px",
          background: "rgba(245,158,11,0.08)",
          border: "1px solid rgba(245,158,11,0.2)",
          borderRadius: 16,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 4 }}>🛂</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: "#f59e0b" }}>
          {venues.length}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          Venues Stamped
        </div>
      </div>

      {/* Type breakdown pills */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {typeCounts.map((tc) => (
          <div
            key={tc.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${tc.color ? tc.color + "33" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 20,
              fontSize: 12,
              color: tc.color || "rgba(255,255,255,0.5)",
              fontWeight: 600,
            }}
          >
            <span>{tc.emoji || "📍"}</span>
            {tc.count}
          </div>
        ))}
      </div>

      {/* Stamp grid grouped by type */}
      {orderedTypes.map((typeId) => {
        const typeInfo = TYPE_MAP[typeId] || {
          emoji: "📍",
          label: typeId,
          color: "#888",
        };
        return (
          <div key={typeId} style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.25)",
                marginBottom: 8,
                paddingLeft: 4,
              }}
            >
              {typeInfo.emoji} {typeInfo.label}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {grouped[typeId].map((v) => (
                <div
                  key={v.id}
                  onClick={() => onVenueClick(v)}
                  style={{
                    background: "#141420",
                    borderLeft: `3px solid ${typeInfo.color}`,
                    borderRadius: 12,
                    padding: "12px 10px",
                    cursor: "pointer",
                    position: "relative",
                    minHeight: 80,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  {/* Top row: emoji + photo */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{typeInfo.emoji}</span>
                    {v.photo && (
                      <img
                        src={v.photo}
                        alt=""
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          objectFit: "cover",
                        }}
                      />
                    )}
                  </div>
                  {/* Venue name */}
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 12,
                      lineHeight: 1.3,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      marginBottom: 6,
                    }}
                  >
                    {v.name}
                  </div>
                  {/* Bottom row: date + visit count */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: "rgba(255,255,255,0.3)",
                      }}
                    >
                      {formatDate(v.visitedAt)}
                    </span>
                    {v.visitCount > 1 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: typeInfo.color,
                          background: typeInfo.color + "1a",
                          padding: "2px 6px",
                          borderRadius: 8,
                        }}
                      >
                        x{v.visitCount}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
