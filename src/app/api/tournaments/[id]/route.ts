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

    // Count confirmed registrations
    const { count: confirmedCount } = await supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', id)
      .eq('registration_status', 'CONFIRMED');

    // Count waitlisted registrations
    const { count: waitlistCount } = await supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', id)
      .eq('registration_status', 'WAITING_LIST');

    // Fetch confirmed players squad roster for public display
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
        registered_at,
        player:players (
          email
        )
      `)
      .eq('tournament_id', id)
      .eq('registration_status', 'CONFIRMED')
      .order('registered_at', { ascending: true });

    return NextResponse.json({
      tournament,
      confirmedCount: confirmedCount || 0,
      waitlistCount: waitlistCount || 0,
      availableSlots: Math.max(0, tournament.max_players - (confirmedCount || 0)),
      confirmedPlayers: confirmedPlayers || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
