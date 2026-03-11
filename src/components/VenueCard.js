'use client';

const CATEGORY_COLORS = {
  bar: 'from-amber-900 to-amber-700',
  restaurant: 'from-red-900 to-red-700',
  cafe: 'from-brown-900 to-yellow-800',
  ice_cream: 'from-pink-900 to-pink-700',
};

const CATEGORY_BADGE_COLORS = {
  bar: 'bg-amber-800 text-amber-200',
  restaurant: 'bg-red-800 text-red-200',
  cafe: 'bg-yellow-800 text-yellow-200',
  ice_cream: 'bg-pink-800 text-pink-200',
};

const CATEGORY_LABELS = {
  bar: 'Bar',
  restaurant: 'Restaurant',
  cafe: 'Café',
  ice_cream: 'Ice Cream',
};

export default function VenueCard({ venue, hasVisited, onCheckin }) {
  const gradientClass = CATEGORY_COLORS[venue.category] || 'from-gray-900 to-gray-700';
  const badgeClass = CATEGORY_BADGE_COLORS[venue.category] || 'bg-gray-700 text-gray-200';

  return (
    <div
      className={`relative bg-gradient-to-br ${gradientClass} bg-opacity-40 border rounded-xl overflow-hidden card-hover cursor-pointer ${
        hasVisited ? 'border-green-500' : 'border-gray-700'
      }`}
    >
      {hasVisited && (
        <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 z-10">
          <span>✓</span> Visited
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-4xl">{venue.emoji}</span>
          </div>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badgeClass}`}>
            {CATEGORY_LABELS[venue.category]}
          </span>
        </div>

        <h3 className="text-lg font-bold text-white mb-1">{venue.name}</h3>
        <p className="text-gray-300 text-sm mb-1">{venue.neighborhood}</p>
        <p className="text-gray-400 text-xs mb-3">{venue.address}</p>
        <p className="text-gray-300 text-sm mb-4 leading-relaxed">{venue.description}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-yellow-400">★</span>
            <span className="text-gray-300 text-sm font-medium">{venue.rating}</span>
          </div>
          <button
            onClick={() => onCheckin(venue)}
            className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
              hasVisited
                ? 'bg-green-700 hover:bg-green-600 text-white'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {hasVisited ? '✓ Check In Again' : '📍 Check In'}
          </button>
        </div>
      </div>
    </div>
  );
}
