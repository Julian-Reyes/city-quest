/**
 * AchievementsPanel.jsx — Gamification achievements display
 *
 * Shows the user's total visit count and achievement milestones grouped into
 * three sections: Global, Category, and Activity. Unlocked achievements are
 * highlighted in amber; locked ones are dimmed with a "X more to go" counter.
 *
 * Receives a `stats` object with keys: total, bar, cafe, ice_cream, restaurant,
 * photos, notes — each achievement looks up its stat to determine unlock status.
 *
 * The actual unlock celebration (full-screen pop animation) is handled in App.jsx —
 * this panel just shows the persistent progress view.
 */

import { ACHIEVEMENTS } from "../constants";

const SECTIONS = [
  { key: "global", label: "Milestones" },
  { key: "category", label: "Categories" },
  { key: "activity", label: "Activity" },
];

export function AchievementsPanel({ stats }) {
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
          {stats.total}
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
      {SECTIONS.map((section) => {
        const items = ACHIEVEMENTS.filter((a) => a.section === section.key);
        if (items.length === 0) return null;
        return (
          <div key={section.key} style={{ marginBottom: 16 }}>
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
              {section.label}
            </div>
            {items.map((a) => {
              const current = stats[a.stat] || 0;
              const unlocked = current >= a.threshold;
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
                    <div
                      style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}
                    >
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
                        {a.threshold - current} more to go
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
      })}
    </div>
  );
}
