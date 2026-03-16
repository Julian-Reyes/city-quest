/**
 * constants.js — App-wide configuration objects
 *
 * VENUE_TYPES drives the type switcher tabs, map pin colors, and list emojis.
 * ACHIEVEMENTS defines the gamification milestones.
 *
 * Achievement shape:
 *   stat      — key into the stats object (total, bar, cafe, ice_cream, restaurant, photos, notes)
 *   threshold — value of that stat needed to unlock
 *   section   — groups achievements in the panel (global, category, activity)
 *
 * These are pure data with no dependencies — safe to import from anywhere.
 */

export const VENUE_TYPES = [
  { id: "bar", label: "Bar", emoji: "🍺", color: "#f59e0b" },
  { id: "cafe", label: "Coffee", emoji: "☕", color: "#92400e" },
  { id: "ice_cream", label: "Ice Cream", emoji: "🍦", color: "#ec4899" },
  { id: "restaurant", label: "Food", emoji: "🍔", color: "#10b981" },
];

export const ACHIEVEMENTS = [
  // ── Global milestones (stat: "total") ──
  {
    id: "first",
    label: "First Sip",
    desc: "Check in to your first venue",
    emoji: "🥇",
    stat: "total",
    threshold: 1,
    section: "global",
  },
  {
    id: "five",
    label: "Night Owl",
    desc: "Visit 5 venues",
    emoji: "🦉",
    stat: "total",
    threshold: 5,
    section: "global",
  },
  {
    id: "ten",
    label: "Bar Hopper",
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

  // ── Per-category (stat matches VENUE_TYPES id) ──
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
