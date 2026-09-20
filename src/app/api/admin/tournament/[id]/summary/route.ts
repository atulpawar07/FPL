import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireManager } from '@/lib/auth/is-manager';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, isAdmin, role } = await requireManager();
    const { id: tournamentId } = await params;
    const supabase = createAdminClient();

    // 1. Fetch tournament details
    const { data: tournament, error: tourneyErr } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tourneyErr || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // 2. Fetch registrations for this tournament
    const { data: registrations, error: regErr } = await supabase
      .from('registrations')
      .select(`
        id,
        tournament_id,
        player_id,
        registration_number,
        status,
        registration_status,
        registration_type,
        team_name,
        team_owner_id,
        waitlist_position,
        registered_name_snapshot,
        registered_role_snapshot,
        registered_batting_style_snapshot,
        registered_jersey_size_snapshot,
        registered_image_snapshot,
        registered_at,
        players (
          id,
          full_name,
          email,
          profile_image_url
        )
      `)
      .eq('tournament_id', tournamentId)
      .order('registered_at', { ascending: true });

    if (regErr) throw regErr;

    // 3. Fetch payments for registrations in this tournament
    const regIds = (registrations || []).map((r) => r.id);
    let payments: any[] = [];
    if (regIds.length > 0) {
      const { data: pData } = await supabase
        .from('payments')
        .select('*')
        .in('registration_id', regIds);
      payments = pData || [];
    }

    // 4. Fetch Team Owners if OWNER_BASED
    let teamOwners: any[] = [];
    if (tournament.tournament_type === 'OWNER_BASED') {
      const { data: ownersData } = await supabase
        .from('team_owners')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('slot_number', { ascending: true });
      teamOwners = ownersData || [];
    }

    // Combine registrations with payments
    const enrichedRegistrations = (registrations || []).map((r) => {
      const payment = payments.find((p) => p.registration_id === r.id) || null;
      const effectiveStatus = r.status || r.registration_status || 'PENDING';
      return {
        ...r,
        registration_status: effectiveStatus,
        status: effectiveStatus,
        payment,
      };
    });

    const isConfirmedReg = (r: any) => r.status === 'CONFIRMED' || r.registration_status === 'CONFIRMED';
    const isWaitlistReg = (r: any) => r.status === 'WAITING_LIST' || r.registration_status === 'WAITING_LIST' || r.status === 'PENDING';

    // ALL types count toward player capacity (Owner is a player too)
    const confirmedPlayersCount = enrichedRegistrations.filter((r) => isConfirmedReg(r)).length;
    const waitlistCount = enrichedRegistrations.filter((r) => isWaitlistReg(r)).length;
    const ownerRegistrationsCount = enrichedRegistrations.filter((r) => r.registration_type === 'OWNER').length;
    const iconRegistrationsCount = enrichedRegistrations.filter((r) => r.registration_type === 'ICON').length;
    const standardPlayersCount = enrichedRegistrations.filter((r) => r.registration_type === 'PLAYER' || !r.registration_type).length;

    const successfulPayments = payments.filter((p) => p.payment_status === 'SUCCESSFUL').length;
    const pendingPayments = payments.filter((p) => p.payment_status === 'PENDING').length;

    const maxTeams = tournament.max_teams || 8;

    return NextResponse.json({
      tournament,
      registrations: enrichedRegistrations,
      teamOwners,
      role,
      isAdmin,
      stats: {
        totalRegistered: enrichedRegistrations.length,
        confirmedCount: confirmedPlayersCount,
        waitlistCount,
        availableSlots: Math.max(0, tournament.max_players - confirmedPlayersCount),
        ownerRegistrationsCount,
        iconRegistrationsCount,
        standardPlayersCount,
        ownerSlotsUsed: teamOwners.length,
        ownerSlotsTotal: maxTeams,
        ownerSlotsRemaining: Math.max(0, maxTeams - teamOwners.length),
        successfulPayments,
        pendingPayments,
      },
    });
  } catch (err: any) {
    const status = err.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status });
  }
}
