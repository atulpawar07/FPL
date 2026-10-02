import { createAdminClient } from '@/lib/supabase/admin';
import { DbTournament } from '@/types';

/**
 * Server-side data fetcher for public tournaments.
 * Order by created_at DESC so the most recently created tournament is always first.
 * Does NOT filter out past tournaments — tournament_date is display-only.
 */
export async function getPublicTournaments(): Promise<DbTournament[]> {
  try {
    const supabase = createAdminClient();

    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select('id, name, description, registration_fee, owner_registration_fee, max_players, max_teams, registration_open, waitlist_enabled, tournament_date, registration_end_date, banner_url, tournament_type, upi_id, payment_qr_url, created_at')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (error) {
      console.error('Error fetching public tournaments:', error);
      return [];
    }

    return (tournaments || []) as unknown as DbTournament[];
  } catch (err) {
    console.error('Failed to fetch public tournaments:', err);
    return [];
  }
}
