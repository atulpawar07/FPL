import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/is-admin';

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ tournaments: tournaments || [] });
  } catch (err: any) {
    const status = err.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireAdmin();
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
      tournamentType,
      maxTeams,
      ownerRegistrationFeeRupees,
      waitlistEnabled,
      bannerUrl,
      registrationEndDate,
      iconPlayerEnabled,
      ownerIsPlayingEnabled,
    } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 });
    }

    const capacityInt = parseInt(maxPlayers, 10);
    if (isNaN(capacityInt) || capacityInt <= 0) {
      return NextResponse.json({ error: 'Player capacity must be a positive whole number' }, { status: 400 });
    }

    const tType = tournamentType === 'OWNER_BASED' ? 'OWNER_BASED' : 'NON_OWNER_BASED';
    const teamsInt = parseInt(maxTeams, 10) || 0;
    if (tType === 'OWNER_BASED' && teamsInt <= 0) {
      return NextResponse.json({ error: 'Total Teams count is required for Owner-Based tournaments' }, { status: 400 });
    }

    const registrationFeePaise = Math.round((parseFloat(registrationFeeRupees) || 0) * 100);
    const ownerRegistrationFeePaise = Math.round((parseFloat(ownerRegistrationFeeRupees) || 0) * 100);
    const supabaseAdmin = createAdminClient();

    const tournamentData = {
      name: name.trim(),
      description: description || null,
      logo_url: logoUrl || null,
      banner_url: bannerUrl || null,
      tournament_date: tournamentDate ? new Date(tournamentDate).toISOString() : new Date().toISOString(),
      registration_end_date: registrationEndDate ? new Date(registrationEndDate).toISOString() : null,
      registration_fee: registrationFeePaise,
      max_players: capacityInt,
      registration_open: registrationOpen !== undefined ? Boolean(registrationOpen) : true,
      payment_enabled: paymentEnabled !== undefined ? Boolean(paymentEnabled) : true,
      upi_id: upiId || null,
      payment_qr_url: paymentQrUrl || null,
      tournament_type: tType,
      max_teams: teamsInt,
      owner_registration_fee: ownerRegistrationFeePaise,
      waitlist_enabled: waitlistEnabled !== undefined ? Boolean(waitlistEnabled) : true,
      icon_player_enabled: iconPlayerEnabled !== undefined ? Boolean(iconPlayerEnabled) : false,
      owner_is_playing_enabled: ownerIsPlayingEnabled !== undefined ? Boolean(ownerIsPlayingEnabled) : true,
      created_by: adminUser.id,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (id) {
      const { data: updated, error } = await supabaseAdmin
        .from('tournaments')
        .update(tournamentData)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      result = updated;
    } else {
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
    const status = err.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status });
  }
}
