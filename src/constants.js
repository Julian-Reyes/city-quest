/**
 * constants.js — App-wide configuration objects
 *
 * QUEST_TYPES defines the top-level game modes.
 * VENUE_CATEGORIES drives map pins, tabs, API queries, and list emojis.
 * ACHIEVEMENTS defines the gamification milestones.
 *
 * Achievement shape:
 *   stat      — key into the stats object (total, category id, quest_*, photos, notes)
 *   threshold — value of that stat needed to unlock
 *   section   — groups achievements in the panel (global, quest, category, activity)
 *
 * These are pure data with no dependencies — safe to import from anywhere.
 */

// ── Quest Types (game modes) ──

export const QUEST_TYPES = [
  { id: "day_explorer", label: "Day Explorer", emoji: "☀️", color: "#38bdf8" },
  { id: "culture_run", label: "Culture Run", emoji: "🎨", color: "#a78bfa" },
  { id: "active", label: "Active", emoji: "🏃", color: "#22c55e" },
  { id: "night_out", label: "Night Out", emoji: "🍻", color: "#f59e0b" },
];

// ── Venue Categories ──
// Each category belongs to a quest and declares its own OSM query tags.
// ghostFilter: false skips Google-based ghost filtering for categories
// where Google Places coverage is poor (parks, monuments, nature reserves).

export const VENUE_CATEGORIES = [
  // ── Night Out ──
  { id: "bar", quest: "night_out", label: "Bar", emoji: "🍺", color: "#f59e0b", osmTag: "amenity", osmValue: "bar" },
  { id: "nightclub", quest: "night_out", label: "Club", emoji: "💃", color: "#e879f9", osmTag: "amenity", osmValue: "nightclub" },
  { id: "pub", quest: "night_out", label: "Pub", emoji: "🍻", color: "#d97706", osmTag: "amenity", osmValue: "pub" },
  { id: "restaurant", quest: "night_out", label: "Food", emoji: "🍔", color: "#10b981", osmTag: "amenity", osmValue: "restaurant" },

  // ── Day Explorer ──
  { id: "park", quest: "day_explorer", label: "Park", emoji: "🌳", color: "#16a34a", osmTag: "leisure", osmValue: ["park", "garden", "playground"], ghostFilter: false },
  { id: "cafe", quest: "day_explorer", label: "Cafe", emoji: "☕", color: "#92400e", osmTag: "amenity", osmValue: ["cafe", "bakery"] },
  { id: "ice_cream", quest: "day_explorer", label: "Ice Cream", emoji: "🍦", color: "#ec4899", osmTag: "amenity", osmValue: "ice_cream" },
  { id: "viewpoint", quest: "day_explorer", label: "Viewpoint", emoji: "🏔️", color: "#0ea5e9", osmTag: "tourism", osmValue: "viewpoint", ghostFilter: false },
  { id: "beach", quest: "day_explorer", label: "Beach", emoji: "🏖️", color: "#fbbf24", osmTag: "natural", osmValue: "beach", ghostFilter: false },

  // ── Culture Run ──
  { id: "museum", quest: "culture_run", label: "Museum", emoji: "🏛️", color: "#8b5cf6", osmTag: "tourism", osmValue: "museum" },
  { id: "gallery", quest: "culture_run", label: "Gallery", emoji: "🖼️", color: "#c084fc", osmTag: "tourism", osmValue: "gallery" },
  { id: "theatre", quest: "culture_run", label: "Theatre", emoji: "🎭", color: "#e11d48", osmTag: "amenity", osmValue: "theatre" },
  { id: "library", quest: "culture_run", label: "Library", emoji: "📚", color: "#7c3aed", osmTag: "amenity", osmValue: "library" },
  { id: "monument", quest: "culture_run", label: "Landmark", emoji: "🗿", color: "#d4a27a", osmTag: "historic", osmValue: "monument", ghostFilter: false },

  // ── Active ──
  { id: "nature_reserve", quest: "active", label: "Trail", emoji: "🥾", color: "#15803d", osmTag: "leisure", osmValue: "nature_reserve", ghostFilter: false },
  { id: "swimming_pool", quest: "active", label: "Pool", emoji: "🏊", color: "#06b6d4", osmTag: "leisure", osmValue: "swimming_pool" },
  { id: "skatepark", quest: "active", label: "Skate", emoji: "🛹", color: "#64748b", osmTag: "sport", osmValue: "skateboard", ghostFilter: false },
  { id: "climbing", quest: "active", label: "Climbing", emoji: "🧗", color: "#ea580c", osmTag: "leisure", osmValue: "fitness_centre", osmExtraFilter: '["sport"="climbing"]' },
];

// ── Lookup helpers ──

export const CATEGORY_MAP = Object.fromEntries(
  VENUE_CATEGORIES.map((c) => [c.id, c]),
);

export const QUEST_MAP = Object.fromEntries(
  QUEST_TYPES.map((q) => [q.id, q]),
);

export function getCategoriesForQuest(questId) {
  return VENUE_CATEGORIES.filter((c) => c.quest === questId);
}

// Backward compat: components that import VENUE_TYPES still work
export const VENUE_TYPES = VENUE_CATEGORIES;

// ── Achievements ──

export const ACHIEVEMENTS = [
  // ── Global milestones (stat: "total") ──
  {
    id: "first",
    label: "First Discovery",
    desc: "Check in to your first venue",
    emoji: "🥇",
    stat: "total",
    threshold: 1,
    section: "global",
  },
  {
    id: "five",
    label: "Curious Wanderer",
    desc: "Visit 5 venues",
    emoji: "🦉",
    stat: "total",
    threshold: 5,
    section: "global",
  },
  {
    id: "ten",
    label: "Explorer",
    desc: "Visit 10 venues",
    emoji: "🏃",
    stat: "total",
    threshold: 10,
    section: "global",
  },
  {
    id: "twenty",
    label: "Local Legend",
    desc: "Visit 20 venues",
    emoji: "👑",
    stat: "total",
    threshold: 20,
    section: "global",
  },
  {
    id: "fifty",
    label: "City Conqueror",
    desc: "Visit 30 venues",
    emoji: "🏆",
    stat: "total",
    threshold: 30,
    section: "global",
  },

  // ── Quest-level achievements ──
  {
    id: "night_owl_quest",
    label: "Night Owl",
    desc: "Visit 10 Night Out venues",
    emoji: "🍻",
    stat: "quest_night_out",
    threshold: 10,
    section: "quest",
  },
  {
    id: "explorer_quest",
    label: "Daylight Explorer",
    desc: "Visit 10 Day Explorer venues",
    emoji: "☀️",
    stat: "quest_day_explorer",
    threshold: 10,
    section: "quest",
  },
  {
    id: "cultured_quest",
    label: "Art Aficionado",
    desc: "Visit 10 Culture Run venues",
    emoji: "🎨",
    stat: "quest_culture_run",
    threshold: 10,
    section: "quest",
  },
  {
    id: "active_quest",
    label: "Iron Legs",
    desc: "Visit 10 Active venues",
    emoji: "🏃",
    stat: "quest_active",
    threshold: 10,
    section: "quest",
  },

  // ── Per-category achievements ──
  {
    id: "bar_fly",
    label: "Bar Fly",
    desc: "Visit 5 bars",
    emoji: "🍻",
    stat: "bar",
    threshold: 5,
    section: "category",
  },
  {
    id: "coffee_snob",
    label: "Coffee Snob",
    desc: "Visit 10 cafés",
    emoji: "☕",
    stat: "cafe",
    threshold: 10,
    section: "category",
  },
  {
    id: "sweet_tooth",
    label: "Sweet Tooth",
    desc: "Visit 5 ice cream shops",
    emoji: "🍧",
    stat: "ice_cream",
    threshold: 5,
    section: "category",
  },
  {
    id: "food_critic",
    label: "Food Critic",
    desc: "Visit 15 restaurants",
    emoji: "🍽️",
    stat: "restaurant",
    threshold: 15,
    section: "category",
  },
  {
    id: "park_ranger",
    label: "Park Ranger",
    desc: "Visit 5 parks",
    emoji: "🌳",
    stat: "park",
    threshold: 5,
    section: "category",
  },
  {
    id: "history_buff",
    label: "History Buff",
    desc: "Visit 5 museums",
    emoji: "🏛️",
    stat: "museum",
    threshold: 5,
    section: "category",
  },
  {
    id: "bookworm",
    label: "Bookworm",
    desc: "Visit 5 libraries",
    emoji: "📚",
    stat: "library",
    threshold: 5,
    section: "category",
  },
  {
    id: "drama_fan",
    label: "Drama Fan",
    desc: "Visit 5 theatres",
    emoji: "🎭",
    stat: "theatre",
    threshold: 5,
    section: "category",
  },
  {
    id: "night_rider",
    label: "Night Rider",
    desc: "Visit 5 clubs",
    emoji: "💃",
    stat: "nightclub",
    threshold: 5,
    section: "category",
  },
  {
    id: "pub_crawler",
    label: "Pub Crawler",
    desc: "Visit 5 pubs",
    emoji: "🍻",
    stat: "pub",
    threshold: 5,
    section: "category",
  },
  {
    id: "trailblazer",
    label: "Trailblazer",
    desc: "Visit 3 nature reserves",
    emoji: "🥾",
    stat: "nature_reserve",
    threshold: 3,
    section: "category",
  },
  {
    id: "water_bug",
    label: "Water Bug",
    desc: "Visit 3 swimming pools",
    emoji: "🏊",
    stat: "swimming_pool",
    threshold: 3,
    section: "category",
  },

  // ── Activity (photos & notes) ──
  {
    id: "photographer",
    label: "Photographer",
    desc: "Take 10 photos",
    emoji: "📸",
    stat: "photos",
    threshold: 10,
    section: "activity",
  },
  {
    id: "chronicler",
    label: "Chronicler",
    desc: "Write 10 notes",
    emoji: "📝",
    stat: "notes",
    threshold: 10,
    section: "activity",
  },
];
