import { NextResponse } from 'next/server';
import { readCheckins, addCheckin } from '../../../lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const checkins = readCheckins();
  return NextResponse.json(checkins);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { venueId, notes, photoUrl } = body;

    if (!venueId) {
      return NextResponse.json({ error: 'venueId is required' }, { status: 400 });
    }

    const checkin = {
      id: uuidv4(),
      venueId,
      notes: notes || '',
      photoUrl: photoUrl || null,
      timestamp: new Date().toISOString(),
    };

    addCheckin(checkin);
    return NextResponse.json(checkin, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create check-in' }, { status: 500 });
  }
}
