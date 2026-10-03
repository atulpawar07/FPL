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

    // Safety strip: never return base64 image data in the public API response.
    // A base64 value in banner_url or payment_qr_url causes the API response to
    // balloon to ~600+ KB, blocking the registration page for 3–5 seconds.
    // HTTPS/HTTP URLs (Storage CDN or static assets) pass through unchanged.
    return (tournaments || []).map((t) => ({
      ...t,
      banner_url: t.banner_url?.startsWith('data:image/')
        ? null
        : (t.banner_url ?? null),
      payment_qr_url: t.payment_qr_url?.startsWith('data:image/')
        ? null
        : (t.payment_qr_url ?? null),
    })) as unknown as DbTournament[];
  } catch (err) {
    console.error('Failed to fetch public tournaments:', err);
    return [];
  }
}
