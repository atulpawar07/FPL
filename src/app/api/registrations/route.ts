import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateRegistrationReference } from '@/lib/utils/format';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const fullName = body.fullName?.trim();
    if (!fullName || fullName.length < 2) {
      return NextResponse.json({ error: 'Please enter a valid full name (at least 2 characters)' }, { status: 400 });
    }

    const email = body.email || (body.mobile ? `${body.mobile}@fairplay.local` : 'player@fairplay.local');
    const profileImageUrl = body.profileImageUrl || body.profilePhotoPath;

    if (!profileImageUrl) {
      return NextResponse.json({ error: 'Please upload your profile photo to complete registration' }, { status: 400 });
    }

    const rawRole = body.cricketRole || body.primaryRole || 'BATSMAN';
    const cricketRole = rawRole === 'WICKETKEEPER' || rawRole === 'BATSMAN_BOWLER' ? 'ALL_ROUNDER' : rawRole;
    const battingStyle = body.battingStyle || 'RIGHT_HAND';
    const jerseySize = body.jerseySize || 'M';

    const supabase = createAdminClient();

    // 1. Fetch target tournament
    let tournament;
    if (body.tournamentId) {
      const { data: t } = await supabase
        .from('tournaments')
        .select('id, name, registration_fee, max_players, registration_open, waitlist_enabled')
        .eq('id', body.tournamentId)
        .maybeSingle();
      tournament = t;
    }

    if (!tournament) {
      const { data: latest } = await supabase
        .from('tournaments')
        .select('id, name, registration_fee, max_players, registration_open, waitlist_enabled')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      tournament = latest;
    }

    if (!tournament) {
      return NextResponse.json({ error: 'No active tournament found. Please ask the tournament admin to publish a tournament.' }, { status: 400 });
    }

    if (!tournament.registration_open) {
      return NextResponse.json({ error: 'Registration for this tournament is currently closed' }, { status: 400 });
    }

    const tournamentId = tournament.id;
    const registrationFee = tournament.registration_fee || 50000;

    // 2. Create or find player record in database
    let playerId: string | null = null;
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id, auth_user_id')
      .eq('email', email)
      .maybeSingle();

    if (existingPlayer) {
      playerId = existingPlayer.id;
    } else {
      let authUserId: string | null = null;
      try {
        const supabaseServer = await createServerSupabaseClient();
        const { data: { user: currentUser } } = await supabaseServer.auth.getUser();
        if (currentUser) {
          authUserId = currentUser.id;
        }
      } catch (e) {
        // Session not available
      }

      if (!authUserId) {
        const { data: usersData } = await supabase.auth.admin.listUsers();
        const existingAuthUser = usersData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

        if (existingAuthUser) {
          authUserId = existingAuthUser.id;
        } else if (usersData?.users && usersData.users.length > 0) {
          const { data: newAuthUser } = await supabase.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { full_name: fullName },
          });
          authUserId = newAuthUser?.user?.id || usersData.users[0].id;
        } else {
          const { data: newAuthUser } = await supabase.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { full_name: fullName },
          });
          if (newAuthUser?.user) {
            authUserId = newAuthUser.user.id;
          }
        }
      }

      if (authUserId) {
        const playerPayload: any = {
          auth_user_id: authUserId,
          full_name: fullName,
          email,
          profile_image_url: profileImageUrl,
          cricket_role: cricketRole,
          batting_style: battingStyle,
          jersey_size: jerseySize,
        };

        let { data: newPlayer, error: playerErr } = await supabase
          .from('players')
          .insert(playerPayload)
          .select('id')
          .single();

        if (playerErr && playerErr.message?.includes('jersey_size')) {
          delete playerPayload.jersey_size;
          const { data: retryNewPlayer } = await supabase
            .from('players')
            .insert(playerPayload)
            .select('id')
            .single();
          newPlayer = retryNewPlayer;
        }

        if (newPlayer) {
          playerId = newPlayer.id;
        } else {
          const { data: retryPlayer } = await supabase
            .from('players')
            .select('id')
            .eq('email', email)
            .maybeSingle();
          if (retryPlayer) {
            playerId = retryPlayer.id;
          }
        }
      }

      if (!playerId) {
        const { data: anyPlayer } = await supabase
          .from('players')
          .select('id')
          .limit(1)
          .maybeSingle();
        if (anyPlayer) {
          playerId = anyPlayer.id;
        }
      }
    }

    if (!playerId) {
      return NextResponse.json({ error: 'Failed to create or resolve player profile' }, { status: 500 });
    }

    // Check if player is already registered for this tournament
    const { data: existingReg } = await supabase
      .from('registrations')
      .select('id, registration_number, registration_status, waitlist_position')
      .eq('tournament_id', tournamentId)
      .eq('player_id', playerId)
      .maybeSingle();

    if (existingReg) {
      return NextResponse.json({
        success: true,
        alreadyRegistered: true,
        registrationId: existingReg.id,
        registrationNumber: existingReg.registration_number,
        registrationStatus: existingReg.registration_status,
        waitlistPosition: existingReg.waitlist_position,
        message: 'You are already registered for this tournament',
      });
    }

    // 3. Create Registration Record via RPC allocate_registration_slot (or direct fallback)
    let registrationId: string;
    let registrationNumber: string;
    let registrationStatus: string = 'CONFIRMED';
    let waitlistPosition: number | null = null;

    const { data: rpcData, error: rpcErr } = await supabase.rpc('allocate_registration_slot', {
      p_tournament_id: tournamentId,
      p_player_id: playerId,
      p_registered_name_snapshot: fullName,
      p_registered_role_snapshot: cricketRole,
      p_registered_batting_style_snapshot: battingStyle,
      p_registered_jersey_size_snapshot: jerseySize,
      p_registered_image_snapshot: profileImageUrl,
    });

    if (!rpcErr && rpcData && rpcData.length > 0) {
      registrationId = rpcData[0].registration_id;
      registrationNumber = rpcData[0].registration_number;
      registrationStatus = rpcData[0].registration_status;
      waitlistPosition = rpcData[0].waitlist_position;
    } else {
      // Direct Insert Fallback if RPC function not created in DB yet
      registrationNumber = generateRegistrationReference();

      // Check current capacity
      const { count: confirmedCount } = await supabase
        .from('registrations')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId)
        .eq('registration_status', 'CONFIRMED');

      if ((confirmedCount || 0) < tournament.max_players) {
        registrationStatus = 'CONFIRMED';
        waitlistPosition = null;
      } else {
        registrationStatus = 'WAITING_LIST';
        const { count: waitlistCount } = await supabase
          .from('registrations')
          .select('id', { count: 'exact', head: true })
          .eq('tournament_id', tournamentId)
          .eq('registration_status', 'WAITING_LIST');
        waitlistPosition = (waitlistCount || 0) + 1;
      }

      const { data: newReg, error: regErr } = await supabase
        .from('registrations')
        .insert({
          tournament_id: tournamentId,
          player_id: playerId,
          registration_number: registrationNumber,
          registration_status: registrationStatus,
          waitlist_position: waitlistPosition,
          registered_name_snapshot: fullName,
          registered_role_snapshot: cricketRole,
          registered_batting_style_snapshot: battingStyle,
          registered_jersey_size_snapshot: jerseySize,
          registered_image_snapshot: profileImageUrl,
        })
        .select('id')
        .single();

      if (regErr) throw regErr;
      registrationId = newReg.id;
    }

    // Create pending payment record
    await supabase.from('payments').insert({
      registration_id: registrationId,
      amount: registrationFee,
      payment_method: 'UPI_QR',
      payment_status: 'PENDING',
    });

    return NextResponse.json({
      success: true,
      registrationId,
      registrationNumber,
      registrationStatus,
      waitlistPosition,
      paymentOrder: {
        orderId: `order_${Date.now()}`,
        amount: registrationFee,
      },
    });
  } catch (err: any) {
    console.error('Registration API POST error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
