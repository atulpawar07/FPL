import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();

    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select('id, name, description, registration_fee, owner_registration_fee, max_players, max_teams, registration_open, waitlist_enabled, tournament_date, registration_end_date, banner_url, tournament_type, upi_id, payment_qr_url, created_at')
      .order('tournament_date', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      tournaments: tournaments || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
