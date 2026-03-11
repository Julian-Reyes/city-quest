'use client';

import { useState, useEffect } from 'react';
import AchievementBadge from '../../components/AchievementBadge';

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/achievements')
      .then((res) => res.json())
      .then((data) => {
        setAchievements(data);
        setLoading(false);
      });
  }, []);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white mb-2">🏆 Achievements</h1>
        <p className="text-gray-400">
          Unlock achievements by checking into venues around the city.
        </p>
        {!loading && (
          <div className="mt-3 inline-flex items-center gap-2 bg-yellow-900 bg-opacity-50 border border-yellow-700 px-4 py-2 rounded-full">
            <span className="text-yellow-400 font-bold text-lg">{unlockedCount}</span>
            <span className="text-gray-300 text-sm">
              / {achievements.length} achievements unlocked
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-4xl mb-3 animate-pulse">🏆</div>
          <p>Loading achievements...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {achievements.map((achievement) => (
            <AchievementBadge key={achievement.id} achievement={achievement} />
          ))}
        </div>
      )}
    </div>
  );
}
