import { VENUES } from '../../../data/venues';
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(VENUES);
}
