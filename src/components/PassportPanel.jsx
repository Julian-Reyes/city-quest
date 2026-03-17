import { VENUE_TYPES } from "../constants";

const TYPE_MAP = Object.fromEntries(VENUE_TYPES.map((t) => [t.id, t]));

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d
    .toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
}

function stampRotation(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h % 13) - 6;
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
    <div
      style={{ height: "100%", overflowY: "auto", padding: "16px 12px 80px" }}
    >
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
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                justifyContent: "center",
                padding: "8px 0",
              }}
            >
              {grouped[typeId].map((v) => {
                const color = typeInfo.color;
                return (
                  <div
                    key={v.id}
                    onClick={() => onVenueClick(v)}
                    style={{
                      width: 130,
                      height: 130,
                      borderRadius: "50%",
                      border: `2px dashed ${color}`,
                      background: `${color}0f`,
                      color,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "16px 10px",
                      cursor: "pointer",
                      position: "relative",
                      transform: `rotate(${stampRotation(v.id)}deg)`,
                      transition: "transform 0.2s",
                    }}
                  >
                    <span style={{ fontSize: 24, marginBottom: 4 }}>
                      {typeInfo.emoji}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        textAlign: "center",
                        lineHeight: 1.2,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        maxWidth: 100,
                      }}
                    >
                      {v.name}
                    </span>
                    <span
                      style={{
                        fontSize: 8,
                        letterSpacing: 1.5,
                        marginTop: 4,
                        opacity: 0.7,
                      }}
                    >
                      {formatDate(v.visitedAt)}
                    </span>
                    {v.visitCount > 1 && (
                      <span
                        style={{
                          position: "absolute",
                          bottom: 10,
                          right: 35,
                          fontSize: 8,
                          fontWeight: 700,
                          padding: "1px 5px",
                          borderRadius: 6,
                          color,
                          background: `${color}26`,
                        }}
                      >
                        x{v.visitCount}
                      </span>
                    )}
                    {v.photo && (
                      <img
                        src={v.photo}
                        alt=""
                        style={{
                          position: "absolute",
                          top: -2,
                          right: 6,
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "2px solid #0f0f1a",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
