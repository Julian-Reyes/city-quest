export default function AchievementBadge({ achievement }) {
  return (
    <div
      className={`relative p-5 rounded-xl border transition-all ${
        achievement.unlocked
          ? 'bg-gradient-to-br from-yellow-900 to-amber-800 border-yellow-500 achievement-glow'
          : 'bg-gray-900 border-gray-700 opacity-60'
      }`}
    >
      {achievement.unlocked && (
        <div className="absolute top-3 right-3 bg-yellow-500 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">
          Unlocked!
        </div>
      )}
      <div className="text-4xl mb-3">{achievement.unlocked ? achievement.emoji : '🔒'}</div>
      <h3 className="font-bold text-white text-base mb-1">{achievement.name}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{achievement.description}</p>
    </div>
  );
}
