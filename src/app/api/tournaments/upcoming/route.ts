import { NextRequest, NextResponse } from 'next/server';
import { getPublicTournaments } from '@/lib/data/tournaments';

export const revalidate = 60; // Cache on Vercel CDN Edge for 60 seconds

export async function GET(req: NextRequest) {
  try {
    const tournaments = await getPublicTournaments();

    return NextResponse.json({
      success: true,
      tournaments,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
