const ACHIEVEMENT_DEFINITIONS = [
  {
    id: 'first_checkin',
    name: 'First Quest!',
    description: 'Complete your very first check-in',
    emoji: '🎯',
    condition: (checkins) => checkins.length >= 1,
  },
  {
    id: 'five_checkins',
    name: 'Adventurer',
    description: 'Check in to 5 different venues',
    emoji: '🗺️',
    condition: (checkins) => new Set(checkins.map((c) => c.venueId)).size >= 5,
  },
  {
    id: 'ten_checkins',
    name: 'City Explorer',
    description: 'Check in to 10 different venues',
    emoji: '🏙️',
    condition: (checkins) => new Set(checkins.map((c) => c.venueId)).size >= 10,
  },
  {
    id: 'all_venues',
    name: 'City Master',
    description: 'Check in to all 12 venues',
    emoji: '👑',
    condition: (checkins) => new Set(checkins.map((c) => c.venueId)).size >= 12,
  },
  {
    id: 'bar_hopper',
    name: 'Bar Hopper',
    description: 'Check in to all 3 bars',
    emoji: '🍺',
    condition: (checkins, venues) => {
      const barIds = venues.filter((v) => v.category === 'bar').map((v) => v.id);
      const visitedBars = checkins.filter((c) => barIds.includes(c.venueId)).map((c) => c.venueId);
      return new Set(visitedBars).size >= barIds.length;
    },
  },
  {
    id: 'foodie',
    name: 'Foodie',
    description: 'Check in to all 3 restaurants',
    emoji: '🍽️',
    condition: (checkins, venues) => {
      const restIds = venues.filter((v) => v.category === 'restaurant').map((v) => v.id);
      const visitedRests = checkins.filter((c) => restIds.includes(c.venueId)).map((c) => c.venueId);
      return new Set(visitedRests).size >= restIds.length;
    },
  },
  {
    id: 'caffeine_addict',
    name: 'Caffeine Addict',
    description: 'Check in to all 3 cafes',
    emoji: '☕',
    condition: (checkins, venues) => {
      const cafeIds = venues.filter((v) => v.category === 'cafe').map((v) => v.id);
      const visitedCafes = checkins.filter((c) => cafeIds.includes(c.venueId)).map((c) => c.venueId);
      return new Set(visitedCafes).size >= cafeIds.length;
    },
  },
  {
    id: 'sweet_tooth',
    name: 'Sweet Tooth',
    description: 'Check in to all 3 ice cream shops',
    emoji: '🍦',
    condition: (checkins, venues) => {
      const icIds = venues.filter((v) => v.category === 'ice_cream').map((v) => v.id);
      const visitedIc = checkins.filter((c) => icIds.includes(c.venueId)).map((c) => c.venueId);
      return new Set(visitedIc).size >= icIds.length;
    },
  },
  {
    id: 'variety_pack',
    name: 'Variety Pack',
    description: 'Check in to at least one venue in all 4 categories',
    emoji: '🎨',
    condition: (checkins, venues) => {
      const categories = ['bar', 'restaurant', 'cafe', 'ice_cream'];
      return categories.every((cat) => {
        const catIds = venues.filter((v) => v.category === cat).map((v) => v.id);
        return checkins.some((c) => catIds.includes(c.venueId));
      });
    },
  },
  {
    id: 'photographer',
    name: 'City Photographer',
    description: 'Upload photos for 3 different check-ins',
    emoji: '📸',
    condition: (checkins) => checkins.filter((c) => c.photoUrl).length >= 3,
  },
];

module.exports = { ACHIEVEMENT_DEFINITIONS };
