import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // 1. Fetch current active tournament
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const tournamentId = tournament?.id;
    const maxCapacity = tournament?.max_players || 100;

    // 2. Count total registered players
    let regQuery = supabase.from('registrations').select('id', { count: 'exact', head: true });
    if (tournamentId) regQuery = regQuery.eq('tournament_id', tournamentId);
    const { count: totalRegisteredPlayers } = await regQuery;

    // 3. Count confirmed regular slots
    let confirmedQuery = supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('registration_status', 'CONFIRMED');
    if (tournamentId) confirmedQuery = confirmedQuery.eq('tournament_id', tournamentId);
    const { count: confirmedCount } = await confirmedQuery;

    // 4. Count total waitlisted players
    let waitlistQuery = supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('registration_status', 'WAITING_LIST');
    if (tournamentId) waitlistQuery = waitlistQuery.eq('tournament_id', tournamentId);
    const { count: totalWaitlistedPlayers } = await waitlistQuery;

    // 5. Count successful & pending payments
    const { count: successfulPayments } = await supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'SUCCESSFUL');

    const { count: pendingPayments } = await supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'PENDING');

    // 6. Calculate total revenue in paise
    const { data: successPaymentsData } = await supabase
      .from('payments')
      .select('amount')
      .eq('payment_status', 'SUCCESSFUL');

    const totalRevenuePaise = (successPaymentsData || []).reduce((acc, p) => acc + (p.amount || 0), 0);

    const availableRegularSlots = Math.max(0, maxCapacity - (confirmedCount || 0));

    return NextResponse.json({
      tournament,
      totalRegisteredPlayers: totalRegisteredPlayers || 0,
      confirmedCount: confirmedCount || 0,
      availableRegularSlots,
      totalWaitlistedPlayers: totalWaitlistedPlayers || 0,
      successfulPayments: successfulPayments || 0,
      pendingPayments: pendingPayments || 0,
      totalRevenuePaise,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
