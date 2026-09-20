import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    let userId: string | null = null;
    try {
      const supabaseServer = await createServerSupabaseClient();
      const { data: { user } } = await supabaseServer.auth.getUser();
      if (user) userId = user.id;
    } catch {}

    const body = await req.json();
    const {
      id,
      name,
      description,
      logoUrl,
      tournamentDate,
      registrationFeeRupees,
      maxPlayers,
      paymentEnabled,
      upiId,
      paymentQrUrl,
      registrationOpen,
    } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 });
    }

    const capacityInt = parseInt(maxPlayers, 10);
    if (isNaN(capacityInt) || capacityInt <= 0) {
      return NextResponse.json({ error: 'Player capacity must be a positive whole number' }, { status: 400 });
    }

    const registrationFeePaise = Math.round((parseFloat(registrationFeeRupees) || 0) * 100);
    const supabaseAdmin = createAdminClient();

    const tournamentData = {
      name: name.trim(),
      description: description || null,
      logo_url: logoUrl || null,
      tournament_date: tournamentDate ? new Date(tournamentDate).toISOString() : new Date().toISOString(),
      registration_fee: registrationFeePaise,
      max_players: capacityInt,
      registration_open: registrationOpen !== undefined ? Boolean(registrationOpen) : true,
      payment_enabled: paymentEnabled !== undefined ? Boolean(paymentEnabled) : true,
      upi_id: upiId || null,
      payment_qr_url: paymentQrUrl || null,
      created_by: userId,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (id) {
      // Update existing tournament
      const { data: updated, error } = await supabaseAdmin
        .from('tournaments')
        .update(tournamentData)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      result = updated;
    } else {
      // Create new tournament
      const { data: created, error } = await supabaseAdmin
        .from('tournaments')
        .insert(tournamentData)
        .select('*')
        .single();
      if (error) throw error;
      result = created;
    }

    return NextResponse.json({ success: true, tournament: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
