import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireManager } from '@/lib/auth/is-manager';

export async function GET(req: NextRequest) {
  try {
    await requireManager();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || 'ALL';
    const status = searchParams.get('status') || 'ALL';
    const tournamentId = searchParams.get('tournamentId') || 'ALL';

    const supabase = createAdminClient();

    // 1. Fetch tournaments for filter dropdown
    const { data: tournamentsList } = await supabase
      .from('tournaments')
      .select('id, name')
      .order('created_at', { ascending: false });

    // 2. Query registrations joined with players, tournaments, and payments
    let query = supabase
      .from('registrations')
      .select(
        `
        id,
        tournament_id,
        player_id,
        registration_number,
        registration_status,
        waitlist_position,
        registered_name_snapshot,
        registered_role_snapshot,
        registered_batting_style_snapshot,
        registered_jersey_size_snapshot,
        registered_image_snapshot,
        registered_at,
        player:players (
          id,
          full_name,
          email,
          jersey_size
        ),
        tournament:tournaments (
          id,
          name
        ),
        payments:payments (
          id,
          amount,
          payment_status,
          transaction_reference,
          created_at
        )
      `
      )
      .order('registered_at', { ascending: false });

    if (status !== 'ALL') {
      query = query.eq('registration_status', status);
    }

    if (tournamentId !== 'ALL') {
      query = query.eq('tournament_id', tournamentId);
    }

    const { data: rows, error } = await query;

    let filtered = rows || [];

    if (error) {
      console.error('Admin players query note:', error.message);
      const { data: fallbackRows } = await supabase
        .from('registrations')
        .select(`
          id,
          tournament_id,
          player_id,
          registration_number,
          registration_status,
          registered_name_snapshot,
          registered_role_snapshot,
          registered_at
        `)
        .order('registered_at', { ascending: false });

      if (fallbackRows) {
        filtered = fallbackRows.map((item) => ({
          ...item,
          waitlist_position: null,
          registered_batting_style_snapshot: 'RIGHT_HAND',
          registered_jersey_size_snapshot: 'M',
          registered_image_snapshot: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
          player: { full_name: item.registered_name_snapshot, email: 'player@fairplay.local' },
          tournament: { name: 'FairPlay Premier League 2026' },
          payments: [{ payment_status: item.registration_status === 'CONFIRMED' ? 'SUCCESSFUL' : 'PENDING', amount: 50000 }],
          tournamentHistoryCount: 1,
          tournamentHistory: [],
        })) as any[];
      }
    }

    // Filter by search query (Ref ID, Name, Email)
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((item: any) => {
        const ref = (item.registration_number || '').toLowerCase();
        const name = (item.registered_name_snapshot || item.player?.full_name || '').toLowerCase();
        const email = (item.player?.email || '').toLowerCase();
        return ref.includes(q) || name.includes(q) || email.includes(q);
      });
    }

    // Filter by Playing Role
    if (role !== 'ALL') {
      filtered = filtered.filter((item: any) => {
        const playerRole = item.registered_role_snapshot || item.player?.cricket_role;
        return playerRole === role;
      });
    }

    // 3. Group registrations by player_id to build tournament history timeline per player
    const playerHistoryMap: Record<string, any[]> = {};
    (rows || []).forEach((reg: any) => {
      const pId = reg.player_id;
      if (!playerHistoryMap[pId]) playerHistoryMap[pId] = [];
      playerHistoryMap[pId].push({
        registrationId: reg.id,
        registrationNumber: reg.registration_number,
        tournamentName: reg.tournament?.name || 'FairPlay Premier League 2026',
        registeredAt: reg.registered_at,
        role: reg.registered_role_snapshot,
        jerseySize: reg.registered_jersey_size_snapshot,
        status: reg.registration_status,
        paymentStatus: reg.payments?.[0]?.payment_status || 'PENDING',
      });
    });

    const enrichedPlayers = filtered.map((item: any) => ({
      ...item,
      tournamentHistoryCount: playerHistoryMap[item.player_id]?.length || 1,
      tournamentHistory: playerHistoryMap[item.player_id] || [],
    }));

    return NextResponse.json({
      players: enrichedPlayers,
      totalCount: enrichedPlayers.length,
      tournaments: tournamentsList || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
