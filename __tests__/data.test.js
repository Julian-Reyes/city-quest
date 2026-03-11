const { VENUES } = require('../src/data/venues');
const { ACHIEVEMENT_DEFINITIONS } = require('../src/data/achievements');

describe('Venue Data', () => {
  test('has 12 venues', () => {
    expect(VENUES).toHaveLength(12);
  });

  test('has venues in all 4 required categories', () => {
    const categories = new Set(VENUES.map((v) => v.category));
    expect(categories.has('bar')).toBe(true);
    expect(categories.has('restaurant')).toBe(true);
    expect(categories.has('cafe')).toBe(true);
    expect(categories.has('ice_cream')).toBe(true);
  });

  test('each venue has required fields', () => {
    VENUES.forEach((venue) => {
      expect(venue).toHaveProperty('id');
      expect(venue).toHaveProperty('name');
      expect(venue).toHaveProperty('category');
      expect(venue).toHaveProperty('address');
      expect(venue).toHaveProperty('description');
      expect(venue).toHaveProperty('emoji');
    });
  });

  test('has 3 bars', () => {
    expect(VENUES.filter((v) => v.category === 'bar')).toHaveLength(3);
  });

  test('has 3 restaurants', () => {
    expect(VENUES.filter((v) => v.category === 'restaurant')).toHaveLength(3);
  });

  test('has 3 cafes', () => {
    expect(VENUES.filter((v) => v.category === 'cafe')).toHaveLength(3);
  });

  test('has 3 ice cream shops', () => {
    expect(VENUES.filter((v) => v.category === 'ice_cream')).toHaveLength(3);
  });

  test('all venue IDs are unique', () => {
    const ids = VENUES.map((v) => v.id);
    expect(new Set(ids).size).toBe(VENUES.length);
  });
});

describe('Achievement Definitions', () => {
  test('has 10 achievement definitions', () => {
    expect(ACHIEVEMENT_DEFINITIONS).toHaveLength(10);
  });

  test('each achievement has required fields', () => {
    ACHIEVEMENT_DEFINITIONS.forEach((ach) => {
      expect(ach).toHaveProperty('id');
      expect(ach).toHaveProperty('name');
      expect(ach).toHaveProperty('description');
      expect(ach).toHaveProperty('emoji');
      expect(ach).toHaveProperty('condition');
      expect(typeof ach.condition).toBe('function');
    });
  });

  test('first_checkin achievement unlocks after 1 check-in', () => {
    const ach = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === 'first_checkin');
    expect(ach.condition([])).toBe(false);
    expect(ach.condition([{ id: '1', venueId: 'bar-1' }])).toBe(true);
  });

  test('five_checkins achievement requires 5 unique venues', () => {
    const ach = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === 'five_checkins');
    const fewCheckins = [
      { id: '1', venueId: 'bar-1' },
      { id: '2', venueId: 'bar-2' },
    ];
    expect(ach.condition(fewCheckins)).toBe(false);

    const fiveCheckins = [
      { id: '1', venueId: 'bar-1' },
      { id: '2', venueId: 'bar-2' },
      { id: '3', venueId: 'restaurant-1' },
      { id: '4', venueId: 'cafe-1' },
      { id: '5', venueId: 'icecream-1' },
    ];
    expect(ach.condition(fiveCheckins)).toBe(true);
  });

  test('bar_hopper achievement unlocks when all bars visited', () => {
    const ach = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === 'bar_hopper');
    const partialBars = [{ id: '1', venueId: 'bar-1' }];
    expect(ach.condition(partialBars, VENUES)).toBe(false);

    const allBars = [
      { id: '1', venueId: 'bar-1' },
      { id: '2', venueId: 'bar-2' },
      { id: '3', venueId: 'bar-3' },
    ];
    expect(ach.condition(allBars, VENUES)).toBe(true);
  });

  test('variety_pack achievement requires one check-in in each category', () => {
    const ach = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === 'variety_pack');
    const noCheckins = [];
    expect(ach.condition(noCheckins, VENUES)).toBe(false);

    const onlyBars = [{ id: '1', venueId: 'bar-1' }];
    expect(ach.condition(onlyBars, VENUES)).toBe(false);

    const allCategories = [
      { id: '1', venueId: 'bar-1' },
      { id: '2', venueId: 'restaurant-1' },
      { id: '3', venueId: 'cafe-1' },
      { id: '4', venueId: 'icecream-1' },
    ];
    expect(ach.condition(allCategories, VENUES)).toBe(true);
  });

  test('photographer achievement requires 3 check-ins with photos', () => {
    const ach = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === 'photographer');
    const noPhotos = [
      { id: '1', venueId: 'bar-1', photoUrl: null },
      { id: '2', venueId: 'bar-2', photoUrl: null },
    ];
    expect(ach.condition(noPhotos)).toBe(false);

    const withPhotos = [
      { id: '1', venueId: 'bar-1', photoUrl: '/uploads/photo1.jpg' },
      { id: '2', venueId: 'bar-2', photoUrl: '/uploads/photo2.jpg' },
      { id: '3', venueId: 'restaurant-1', photoUrl: '/uploads/photo3.jpg' },
    ];
    expect(ach.condition(withPhotos)).toBe(true);
  });

  test('all achievement IDs are unique', () => {
    const ids = ACHIEVEMENT_DEFINITIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ACHIEVEMENT_DEFINITIONS.length);
  });
});
