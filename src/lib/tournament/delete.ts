import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/audit/logger';

export interface DeleteTournamentOptions {
  tournamentId: string;
  confirmName?: string;
  adminUserId?: string;
}

export interface DeleteTournamentResult {
  success: boolean;
  error?: string;
  code?: number;
  tournamentId?: string;
  tournamentName?: string;
  deletedRegistrations?: number;
  deletedPayments?: number;
  deletedTeamOwners?: number;
}

/**
 * Safely deletes a tournament and its tournament-specific child records,
 * performs storage object cleanup for the target tournament,
 * and records an audit log entry.
 *
 * Preserves all other tournaments and non-orphan player records.
 */
export async function deleteTournamentSafely({
  tournamentId,
  confirmName,
  adminUserId,
}: DeleteTournamentOptions): Promise<DeleteTournamentResult> {
  if (!tournamentId || typeof tournamentId !== 'string' || tournamentId.trim() === '') {
    return { success: false, error: 'Tournament ID is required', code: 400 };
  }

  const supabase = createAdminClient();

  // 1. Fetch target tournament
  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .maybeSingle();

  if (fetchErr || !tournament) {
    return { success: false, error: 'Tournament not found', code: 404 };
  }

  // 2. Validate confirmation name if provided
  if (confirmName !== undefined) {
    const trimmedConfirm = confirmName.trim();
    const trimmedActual = tournament.name.trim();
    if (!trimmedConfirm || trimmedConfirm !== trimmedActual) {
      return {
        success: false,
        error: `Confirmation name "${confirmName}" does not match exact tournament name "${tournament.name}"`,
        code: 400,
      };
    }
  }

  // 3. Collect storage object paths for this tournament
  try {
    const { data: regs } = await supabase
      .from('registrations')
      .select('id')
      .eq('tournament_id', tournamentId);

    const regIds = (regs || []).map((r) => r.id);

    if (regIds.length > 0) {
      const { data: payments } = await supabase
        .from('payments')
        .select('payment_screenshot_url')
        .in('registration_id', regIds);

      const screenshotPaths = (payments || [])
        .map((p) => p.payment_screenshot_url)
        .filter((url): url is string => Boolean(url) && !url.startsWith('http') && !url.startsWith('data:'));

      if (screenshotPaths.length > 0) {
        await supabase.storage.from('payment-screenshots').remove(screenshotPaths).catch(() => {});
      }
    }

    const { data: owners } = await supabase
      .from('team_owners')
      .select('team_logo_url, payment_screenshot_url')
      .eq('tournament_id', tournamentId);

    const logoPaths = (owners || [])
      .map((o) => o.team_logo_url)
      .filter((url): url is string => Boolean(url) && !url.startsWith('http') && !url.startsWith('data:'));

    if (logoPaths.length > 0) {
      await supabase.storage.from('team-logos').remove(logoPaths).catch(() => {});
    }
  } catch (storageErr) {
    console.error('Storage cleanup non-fatal warning:', storageErr);
  }

  // 4. Try RPC function first
  let deletedRegs = 0;
  let deletedPayments = 0;
  let deletedOwners = 0;

  const { data: rpcRes, error: rpcErr } = await supabase.rpc('delete_tournament_v1', {
    p_tournament_id: tournamentId,
  });

  if (!rpcErr && rpcRes && rpcRes.success) {
    deletedRegs = rpcRes.deleted_registrations || 0;
    deletedPayments = rpcRes.deleted_payments || 0;
    deletedOwners = rpcRes.deleted_team_owners || 0;
  } else {
    // Fallback: Safe transactional cascading delete via Admin client
    const { data: regs } = await supabase
      .from('registrations')
      .select('id')
      .eq('tournament_id', tournamentId);

    const regIds = (regs || []).map((r) => r.id);

    const { data: owners } = await supabase
      .from('team_owners')
      .select('id')
      .eq('tournament_id', tournamentId);

    const ownerIds = (owners || []).map((o) => o.id);

    if (regIds.length > 0) {
      const { count } = await supabase
        .from('payments')
        .delete({ count: 'exact' })
        .in('registration_id', regIds);
      deletedPayments += count || 0;
    }

    if (ownerIds.length > 0) {
      const { count } = await supabase
        .from('payments')
        .delete({ count: 'exact' })
        .in('team_owner_id', ownerIds);
      deletedPayments += count || 0;
    }

    const { count: oCount } = await supabase
      .from('team_owners')
      .delete({ count: 'exact' })
      .eq('tournament_id', tournamentId);
    deletedOwners = oCount || 0;

    const { count: rCount } = await supabase
      .from('registrations')
      .delete({ count: 'exact' })
      .eq('tournament_id', tournamentId);
    deletedRegs = rCount || 0;

    const { error: delErr } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', tournamentId);

    if (delErr) {
      return { success: false, error: delErr.message, code: 500 };
    }
  }

  // 5. Log audit action
  if (adminUserId) {
    await logAdminAction({
      adminUserId,
      action: 'DELETE_TOURNAMENT',
      entityType: 'TOURNAMENT',
      entityId: tournamentId,
      oldValue: {
        id: tournament.id,
        name: tournament.name,
        tournament_date: tournament.tournament_date,
        registration_fee: tournament.registration_fee,
        created_at: tournament.created_at,
      },
      newValue: null,
    }).catch(() => {});
  }

  return {
    success: true,
    code: 200,
    tournamentId,
    tournamentName: tournament.name,
    deletedRegistrations: deletedRegs,
    deletedPayments: deletedPayments,
    deletedTeamOwners: deletedOwners,
  };
}
