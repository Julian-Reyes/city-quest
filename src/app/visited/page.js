'use client';

import { useState, useEffect } from 'react';

import Link from 'next/link';

const CATEGORY_LABELS = {
  bar: 'Bar',
  restaurant: 'Restaurant',
  cafe: 'Café',
  ice_cream: 'Ice Cream',
};

const CATEGORY_BADGE = {
  bar: 'bg-amber-800 text-amber-200',
  restaurant: 'bg-red-800 text-red-200',
  cafe: 'bg-yellow-800 text-yellow-200',
  ice_cream: 'bg-pink-800 text-pink-200',
};

export default function VisitedPage() {
  const [checkins, setCheckins] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetch('/api/checkins'), fetch('/api/venues')])
      .then(([checkinsRes, venuesRes]) => Promise.all([checkinsRes.json(), venuesRes.json()]))
      .then(([checkinsData, venuesData]) => {
        setCheckins(checkinsData);
        setVenues(venuesData);
        setLoading(false);
      });
  }, []);

  const venueMap = Object.fromEntries(venues.map((v) => [v.id, v]));

  const sortedCheckins = [...checkins].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  const uniqueVenueIds = new Set(checkins.map((c) => c.venueId));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white mb-2">📍 Visited Places</h1>
        <p className="text-gray-400">Your check-in history with photos and memories.</p>
        {!loading && (
          <div className="mt-3 inline-flex items-center gap-2 bg-purple-900 bg-opacity-50 border border-purple-700 px-4 py-2 rounded-full">
            <span className="text-purple-400 font-bold text-lg">{uniqueVenueIds.size}</span>
            <span className="text-gray-300 text-sm">unique venues visited</span>
            <span className="text-gray-500">•</span>
            <span className="text-purple-400 font-bold text-lg">{checkins.length}</span>
            <span className="text-gray-300 text-sm">total check-ins</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-4xl mb-3 animate-pulse">📍</div>
          <p>Loading your adventures...</p>
        </div>
      ) : checkins.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🗺️</div>
          <h2 className="text-xl font-bold text-white mb-2">No check-ins yet!</h2>
          <p className="text-gray-400 mb-6">
            Start your quest by checking into venues around the city.
          </p>
          <Link
            href="/"
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Explore Venues →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedCheckins.map((checkin) => {
            const venue = venueMap[checkin.venueId];
            if (!venue) return null;

            const date = new Date(checkin.timestamp);
            const formattedDate = date.toLocaleDateString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });
            const formattedTime = date.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={checkin.id}
                className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden hover:border-purple-700 transition-colors"
              >
                <div className="flex flex-col sm:flex-row">
                  {checkin.photoUrl && (
                    <div className="sm:w-48 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={checkin.photoUrl}
                        alt={`Photo at ${venue.name}`}
                        className="w-full h-48 sm:h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-5 flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{venue.emoji}</span>
                        <div>
                          <h3 className="text-lg font-bold text-white">{venue.name}</h3>
                          <p className="text-gray-400 text-xs">{venue.address}</p>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${CATEGORY_BADGE[venue.category] || 'bg-gray-700 text-gray-200'}`}
                      >
                        {CATEGORY_LABELS[venue.category] || venue.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-gray-500 text-xs mb-3">
                      <span>📅</span>
                      <span>
                        {formattedDate} at {formattedTime}
                      </span>
                    </div>

                    {checkin.notes && (
                      <p className="text-gray-300 text-sm bg-gray-800 rounded-lg px-3 py-2 italic">
                        &ldquo;{checkin.notes}&rdquo;
                      </p>
                    )}

                    {!checkin.photoUrl && !checkin.notes && (
                      <p className="text-gray-600 text-sm italic">No notes added.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
