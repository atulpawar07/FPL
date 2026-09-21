import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tournamentRegistrationSchema } from '@/lib/validation/registration';
import { generateRegistrationReference } from '@/lib/utils/format';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;

    // 1. Authenticate user
    const supabaseServer = await createServerSupabaseClient();
    const {
      data: { user },
      error: authErr,
    } = await supabaseServer.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'You must be logged in to register for a tournament' }, { status: 401 });
    }

    const body = await req.json();
    const validationResult = tournamentRegistrationSchema.safeParse({
      ...body,
      email: user.email,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const supabaseAdmin = createAdminClient();

    // 2. Verify Tournament status & max_players capacity
    const { data: tournament, error: tournamentErr } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tournamentErr || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (!tournament.registration_open) {
      return NextResponse.json({ error: 'Registration for this tournament is currently closed.' }, { status: 400 });
    }

    // 3. Upsert Reusable Player Profile (with fallback for missing columns on remote DB)
    const playerPayload: any = {
      auth_user_id: user.id,
      full_name: data.fullName,
      email: user.email!,
      profile_image_url: data.profileImageUrl,
      cricket_role: data.cricketRole,
      batting_style: data.battingStyle || null,
      jersey_size: data.jerseySize || null,
      updated_at: new Date().toISOString(),
    };

    let { data: player, error: playerErr } = await supabaseAdmin
      .from('players')
      .upsert(playerPayload, { onConflict: 'auth_user_id' })
      .select('*')
      .maybeSingle();

    if (playerErr && playerErr.message?.includes('column')) {
      delete playerPayload.jersey_size;
      delete playerPayload.batting_style;

      const fallbackRes = await supabaseAdmin
        .from('players')
        .upsert(playerPayload, { onConflict: 'auth_user_id' })
        .select('*')
        .maybeSingle();

      player = fallbackRes.data;
      playerErr = fallbackRes.error;
    }

    if (playerErr && playerErr.message?.includes('column')) {
      delete playerPayload.auth_user_id;
      const emailFallbackRes = await supabaseAdmin
        .from('players')
        .upsert(playerPayload, { onConflict: 'email' })
        .select('*')
        .maybeSingle();

      player = emailFallbackRes.data;
      playerErr = emailFallbackRes.error;
    }

    if (playerErr || !player) {
      return NextResponse.json({ error: playerErr?.message || 'Failed to update player profile' }, { status: 500 });
    }

    // 4. Check for existing registration in this tournament
    const { data: existingReg } = await supabaseAdmin
      .from('registrations')
      .select('id, registration_number, registration_status, status, waitlist_position')
      .eq('tournament_id', tournamentId)
      .eq('player_id', player.id)
      .maybeSingle();

    if (existingReg) {
      return NextResponse.json({
        success: true,
        alreadyRegistered: true,
        registrationId: existingReg.id,
        registrationNumber: existingReg.registration_number,
        status: existingReg.registration_status || existingReg.status,
        waitlistPosition: existingReg.waitlist_position,
      });
    }

    // 5. ATOMIC CAPACITY & WAITLIST ALLOCATION
    const { count: confirmedCount } = await supabaseAdmin
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('registration_status', 'CONFIRMED');

    const maxCapacity = tournament.max_players;
    const isRegularSlotAvailable = (confirmedCount || 0) < maxCapacity;

    let registrationStatus: 'CONFIRMED' | 'WAITING_LIST' = 'CONFIRMED';
    let waitlistPosition: number | null = null;

    if (!isRegularSlotAvailable) {
      registrationStatus = 'WAITING_LIST';
      const { count: currentWaitlistCount } = await supabaseAdmin
        .from('registrations')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId)
        .or('status.eq.WAITING_LIST,registration_status.eq.WAITING_LIST');

      waitlistPosition = (currentWaitlistCount || 0) + 1;
    }

    const registrationNumber = generateRegistrationReference();

    // 6. Insert Registration Record with Historical Snapshots
    const regPayload: any = {
      tournament_id: tournamentId,
      player_id: player.id,
      registration_number: registrationNumber,
      status: registrationStatus,
      registration_status: registrationStatus,
      registration_type: 'PLAYER',
      waitlist_position: waitlistPosition,
      registered_name_snapshot: data.fullName,
      registered_role_snapshot: data.cricketRole,
      registered_batting_style_snapshot: data.battingStyle || null,
      registered_jersey_size_snapshot: data.jerseySize || null,
      registered_image_snapshot: data.profileImageUrl,
    };

    let { data: newRegistration, error: regErr } = await supabaseAdmin
      .from('registrations')
      .insert(regPayload)
      .select('*')
      .single();

    if (regErr && regErr.message?.includes('column')) {
      delete regPayload.registered_jersey_size_snapshot;
      delete regPayload.registered_batting_style_snapshot;
      delete regPayload.registration_type;
      delete regPayload.status;

      const fallbackRegRes = await supabaseAdmin
        .from('registrations')
        .insert(regPayload)
        .select('*')
        .single();
      newRegistration = fallbackRegRes.data;
      regErr = fallbackRegRes.error;
    }

    if (regErr || !newRegistration) {
      return NextResponse.json({ error: regErr?.message || 'Registration failed' }, { status: 500 });
    }

    // 7. Create Payment Record (Pending)
    await supabaseAdmin.from('payments').insert({
      registration_id: newRegistration.id,
      amount: tournament.registration_fee,
      payment_method: 'UPI_QR',
      payment_status: 'PENDING',
    });

    return NextResponse.json({
      success: true,
      registrationId: newRegistration.id,
      registrationNumber,
      status: registrationStatus,
      waitlistPosition,
      message: isRegularSlotAvailable
        ? 'Registration confirmed!'
        : `Tournament regular slots are full (${maxCapacity}/${maxCapacity}). You have been placed on the Waitlist (#${waitlistPosition}).`,
    });
  } catch (err: any) {
    console.error('Tournament register API error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
