import { NextResponse } from 'next/server';
import { readCheckins } from '../../../lib/db';
import { VENUES } from '../../../data/venues';
import { ACHIEVEMENT_DEFINITIONS } from '../../../data/achievements';

export async function GET() {
  const checkins = readCheckins();

  const achievements = ACHIEVEMENT_DEFINITIONS.map((def) => {
    const unlocked = def.condition(checkins, VENUES);
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      emoji: def.emoji,
      unlocked,
    };
  });

  return NextResponse.json(achievements);
}
