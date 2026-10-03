import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const [tourneyRes, squadRes] = await Promise.all([
      supabase
        .from('tournaments')
        .select('*')
        .eq('id', id)
        .single(),
      supabase
        .from('registrations')
        .select(`
          id,
          registration_number,
          registered_name_snapshot,
          registered_role_snapshot,
          registered_batting_style_snapshot,
          registered_jersey_size_snapshot,
          registration_type,
          team_name,
          team_owner_id,
          registered_at,
          registration_status,
          player:players (
            email,
            full_name
          )
        `)
        .eq('tournament_id', id)
        .order('registered_at', { ascending: true }),
    ]);

    const tournament = tourneyRes.data;
    if (tourneyRes.error || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const allRegistrations = squadRes.data || [];
    const isConfirmed = (r: any) => r.registration_status === 'CONFIRMED';
    const isWaitlist = (r: any) => r.registration_status === 'WAITING_LIST' || r.registration_status === 'PENDING';

    const confirmedPlayerCount = allRegistrations.filter(isConfirmed).length;
    const waitlistCount = allRegistrations.filter(isWaitlist).length;

    const filteredPlayers = allRegistrations.map((p: any) => ({
      ...p,
      registered_image_snapshot: null,
    }));

    return NextResponse.json(
      {
        tournament,
        confirmedCount: confirmedPlayerCount,
        waitlistCount,
        availableSlots: Math.max(0, tournament.max_players - confirmedPlayerCount),
        confirmedPlayers: filteredPlayers,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
