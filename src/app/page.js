'use client';

import { useState, useEffect, useCallback } from 'react';
import VenueCard from '../components/VenueCard';
import CheckinModal from '../components/CheckinModal';

const CATEGORY_FILTERS = [
  { value: 'all', label: 'All Venues', emoji: '🗺️' },
  { value: 'bar', label: 'Bars', emoji: '🍺' },
  { value: 'restaurant', label: 'Restaurants', emoji: '🍽️' },
  { value: 'cafe', label: 'Cafés', emoji: '☕' },
  { value: 'ice_cream', label: 'Ice Cream', emoji: '🍦' },
];

export default function HomePage() {
  const [venues, setVenues] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [venuesRes, checkinsRes] = await Promise.all([
      fetch('/api/venues'),
      fetch('/api/checkins'),
    ]);
    const [venuesData, checkinsData] = await Promise.all([venuesRes.json(), checkinsRes.json()]);
    setVenues(venuesData);
    setCheckins(checkinsData);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const visitedVenueIds = new Set(checkins.map((c) => c.venueId));

  const filteredVenues =
    activeCategory === 'all' ? venues : venues.filter((v) => v.category === activeCategory);

  const handleCheckinSuccess = (checkin) => {
    setCheckins((prev) => [...prev, checkin]);
    setSelectedVenue(null);
    const venue = venues.find((v) => v.id === checkin.venueId);
    setToast(`✅ Checked in to ${venue?.name || 'venue'}!`);
    setTimeout(() => setToast(null), 3000);
  };

  const completionPercent = venues.length
    ? Math.round((visitedVenueIds.size / venues.length) * 100)
    : 0;

  return (
    <div>
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3">
          🗺️ City Quest
        </h1>
        <p className="text-gray-300 text-lg max-w-xl mx-auto">
          Explore your city, check into local venues, and unlock achievements!
        </p>
      </div>

      {/* Progress Bar */}
      {!loading && venues.length > 0 && (
        <div className="bg-gray-900 border border-purple-800 rounded-xl p-5 mb-8">
          <div className="flex justify-between items-center mb-3">
            <span className="text-white font-semibold">Quest Progress</span>
            <span className="text-purple-400 font-bold">
              {visitedVenueIds.size} / {venues.length} venues visited
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <div className="text-right mt-1 text-sm text-gray-400">{completionPercent}% complete</div>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORY_FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setActiveCategory(filter.value)}
            className={`flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              activeCategory === filter.value
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <span>{filter.emoji}</span>
            <span>{filter.label}</span>
          </button>
        ))}
      </div>

      {/* Venue Grid */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-4xl mb-3 animate-pulse">🗺️</div>
          <p>Loading venues...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVenues.map((venue) => (
            <VenueCard
              key={venue.id}
              venue={venue}
              hasVisited={visitedVenueIds.has(venue.id)}
              onCheckin={setSelectedVenue}
            />
          ))}
        </div>
      )}

      {/* Check-in Modal */}
      {selectedVenue && (
        <CheckinModal
          venue={selectedVenue}
          onClose={() => setSelectedVenue(null)}
          onSuccess={handleCheckinSuccess}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-green-700 text-white px-5 py-3 rounded-xl shadow-lg font-semibold z-50 animate-bounce">
          {toast}
        </div>
      )}
    </div>
  );
}
