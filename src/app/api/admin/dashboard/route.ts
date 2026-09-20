import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/is-admin';

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    // Fetch all tournaments ordered by creation date
    const { data: tournaments, error: tourneyErr } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false });

    if (tourneyErr) throw tourneyErr;

    // Fetch all registrations
    const { data: registrations } = await supabase
      .from('registrations')
      .select('id, tournament_id, registration_status');

    // Fetch all payments
    const { data: payments } = await supabase
      .from('payments')
      .select('id, amount, payment_status, registration_id');

    // Fetch team owners
    const { data: teamOwners } = await supabase
      .from('team_owners')
      .select('id, tournament_id, status, payment_status');

    const tournamentSummaries = (tournaments || []).map((t) => {
      const tRegs = (registrations || []).filter((r) => r.tournament_id === t.id);
      const confirmedCount = tRegs.filter((r) => r.registration_status === 'CONFIRMED').length;
      const waitlistCount = tRegs.filter((r) => r.registration_status === 'WAITING_LIST').length;
      
      const tRegIds = new Set(tRegs.map((r) => r.id));
      const tPayments = (payments || []).filter((p) => tRegIds.has(p.registration_id));
      const successfulPayments = tPayments.filter((p) => p.payment_status === 'SUCCESSFUL').length;
      const pendingPayments = tPayments.filter((p) => p.payment_status === 'PENDING').length;
      const revenuePaise = tPayments
        .filter((p) => p.payment_status === 'SUCCESSFUL')
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      const tOwners = (teamOwners || []).filter((o) => o.tournament_id === t.id);
      const ownerCount = tOwners.length;
      const pendingOwners = tOwners.filter((o) => o.status === 'PENDING').length;

      return {
        ...t,
        stats: {
          totalRegistered: tRegs.length,
          confirmedCount,
          waitlistCount,
          availableSlots: Math.max(0, (t.max_players || 100) - confirmedCount),
          successfulPayments,
          pendingPayments,
          revenuePaise,
          ownerCount,
          pendingOwners,
        },
      };
    });

    const totalRegisteredPlayers = registrations?.length || 0;
    const totalSuccessfulPayments = payments?.filter((p) => p.payment_status === 'SUCCESSFUL').length || 0;
    const totalPendingPayments = payments?.filter((p) => p.payment_status === 'PENDING').length || 0;
    const totalRevenuePaise = payments
      ?.filter((p) => p.payment_status === 'SUCCESSFUL')
      .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    return NextResponse.json({
      tournaments: tournamentSummaries,
      globalStats: {
        totalRegisteredPlayers,
        totalSuccessfulPayments,
        totalPendingPayments,
        totalRevenuePaise,
      },
    });
  } catch (err: any) {
    const status = err.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status });
  }
}
