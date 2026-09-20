import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/audit/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, registrationFeeRupees, maxRegistrations, contactEmail, contactPhone, termsAndConditions } = body;

    const supabase = createAdminClient();

    // Fetch existing tournament settings for audit trail comparison
    const { data: oldTournament } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const registrationFeePaise = Math.round((registrationFeeRupees || 500) * 100);

    const updateData = {
      name: name || oldTournament?.name || 'Premier Cricket Championship 2026',
      registration_fee: registrationFeePaise,
      max_players: parseInt(maxRegistrations || '500', 10),
      updated_at: new Date().toISOString(),
    };

    let tournamentId = id || oldTournament?.id;

    if (tournamentId) {
      await supabase.from('tournaments').update(updateData).eq('id', tournamentId);
    } else {
      const { data: newT } = await supabase
        .from('tournaments')
        .insert({
          ...updateData,
          tournament_date: new Date(Date.now() + 30 * 86400000).toISOString(),
        })
        .select('id')
        .single();
      tournamentId = newT?.id;
    }

    // Write audit log entry
    await logAdminAction({
      action: 'UPDATE_TOURNAMENT_SETTINGS',
      entityType: 'TOURNAMENT',
      entityId: tournamentId || 'unknown',
      oldValue: oldTournament,
      newValue: updateData,
    });

    return NextResponse.json({ success: true, tournamentId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Settings update error' }, { status: 500 });
  }
}
