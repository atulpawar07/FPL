import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // Fetch tournament
    const { data: tournament, error: tournamentErr } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single();

    if (tournamentErr || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Count confirmed player registrations (excluding pure OWNER records for player capacity)
    const { data: allRegistrations } = await supabase
      .from('registrations')
      .select('id, status, registration_status, registration_type')
      .eq('tournament_id', id);

    const activeRegs = allRegistrations || [];
    const isConfirmed = (r: any) => r.status === 'CONFIRMED' || r.registration_status === 'CONFIRMED';
    const isWaitlist = (r: any) => r.status === 'WAITING_LIST' || r.registration_status === 'WAITING_LIST' || r.status === 'PENDING';

    // Player capacity is based on PLAYER and ICON registrations
    const confirmedPlayerCount = activeRegs.filter(r => isConfirmed(r) && r.registration_type !== 'OWNER').length;
    const waitlistCount = activeRegs.filter(r => isWaitlist(r) && r.registration_type !== 'OWNER').length;

    // Fetch confirmed players squad roster for public display (including ICON and PLAYER registrations)
    const { data: confirmedPlayers } = await supabase
      .from('registrations')
      .select(`
        id,
        registration_number,
        registered_name_snapshot,
        registered_role_snapshot,
        registered_batting_style_snapshot,
        registered_jersey_size_snapshot,
        registered_image_snapshot,
        registration_type,
        team_name,
        team_owner_id,
        registered_at,
        status,
        registration_status,
        player:players (
          email,
          full_name
        )
      `)
      .eq('tournament_id', id)
      .order('registered_at', { ascending: true });

    const filteredConfirmed = (confirmedPlayers || []).filter(r => isConfirmed(r));

    return NextResponse.json({
      tournament,
      confirmedCount: confirmedPlayerCount,
      waitlistCount,
      availableSlots: Math.max(0, tournament.max_players - confirmedPlayerCount),
      confirmedPlayers: filteredConfirmed,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
