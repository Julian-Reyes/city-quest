/**
 * constants.js — App-wide configuration objects
 *
 * VENUE_TYPES drives the type switcher tabs, map pin colors, and list emojis.
 * ACHIEVEMENTS defines the gamification milestones (threshold = visit count to unlock).
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
