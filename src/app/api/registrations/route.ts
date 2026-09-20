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

    // 1. Fetch active tournament
    let { data: tournament } = await supabase
      .from('tournaments')
      .select('id, name, registration_fee, max_players, registration_open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!tournament) {
      return NextResponse.json({ error: 'No active tournament found. Please ask the tournament admin to publish a tournament.' }, { status: 400 });
    }

    const tournamentId = tournament.id;
    const registrationFee = tournament.registration_fee || 50000;

    if (tournament && !tournament.registration_open) {
      return NextResponse.json({ error: 'Registration for this tournament is currently closed' }, { status: 400 });
    }

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

        // Fallback for schema cache missing jersey_size column
        if (playerErr && playerErr.message?.includes('jersey_size')) {
          delete playerPayload.jersey_size;
          const { data: retryNewPlayer, error: retryErr } = await supabase
            .from('players')
            .insert(playerPayload)
            .select('id')
            .single();
          newPlayer = retryNewPlayer;
          playerErr = retryErr;
        }

        if (newPlayer) {
          playerId = newPlayer.id;
        } else {
          console.error('Player creation note:', playerErr?.message);
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

    const registrationNumber = generateRegistrationReference();

    // 3. Create Registration Record
    let registrationId = registrationNumber;
    if (tournamentId && playerId) {
      const regPayload: any = {
        tournament_id: tournamentId,
        player_id: playerId,
        registration_number: registrationNumber,
        registration_status: 'CONFIRMED',
        registered_name_snapshot: fullName,
        registered_role_snapshot: cricketRole,
        registered_batting_style_snapshot: battingStyle,
        registered_jersey_size_snapshot: jerseySize,
        registered_image_snapshot: profileImageUrl,
      };

      let { data: newReg, error: regErr } = await supabase
        .from('registrations')
        .insert(regPayload)
        .select('id')
        .single();

      // Fallback for schema cache missing registered_jersey_size_snapshot column
      if (regErr && regErr.message?.includes('jersey_size')) {
        delete regPayload.registered_jersey_size_snapshot;
        const { data: retryReg, error: retryRegErr } = await supabase
          .from('registrations')
          .insert(regPayload)
          .select('id')
          .single();
        newReg = retryReg;
        regErr = retryRegErr;
      }

      if (newReg) {
        registrationId = newReg.id;

        // Create pending payment record
        await supabase.from('payments').insert({
          registration_id: newReg.id,
          amount: registrationFee,
          payment_method: 'UPI_QR',
          payment_status: 'PENDING',
        });
      } else {
        console.error('Registration insert note:', regErr?.message);
      }
    }

    return NextResponse.json({
      success: true,
      registrationId,
      registrationNumber,
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
