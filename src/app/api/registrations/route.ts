import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { uploadToStorageBucket } from '@/lib/storage/upload';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const fullName = body.fullName?.trim();
    if (!fullName || fullName.length < 2) {
      return NextResponse.json({ error: 'Please enter a valid full name (at least 2 characters)' }, { status: 400 });
    }

    const email = body.email || (body.mobile ? `${body.mobile}@fairplay.local` : null);
    const profileImageUrl = body.profileImageUrl || body.profilePhotoPath;

    if (!profileImageUrl) {
      return NextResponse.json({ error: 'Please upload your profile photo to complete registration' }, { status: 400 });
    }

    const rawRole = body.cricketRole || body.primaryRole || 'BATSMAN';
    const cricketRole = rawRole === 'WICKETKEEPER' || rawRole === 'BATSMAN_BOWLER' ? 'ALL_ROUNDER' : rawRole;
    const battingStyle = body.battingStyle || 'RIGHT_HAND';
    const jerseySize = body.jerseySize || 'M';

    const supabase = createAdminClient();

    // 1. Fetch Target Tournament
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

    const tournamentId = tournament.id;

    // 2. Resolve or Create Player Profile
    let playerId: string | null = null;
    if (email) {
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (existingPlayer) playerId = existingPlayer.id;
    }

    if (!playerId && body.mobile) {
      const { data: existingMobile } = await supabase
        .from('players')
        .select('id')
        .eq('mobile', body.mobile)
        .maybeSingle();
      if (existingMobile) playerId = existingMobile.id;
    }

    if (!playerId) {
      let authUserId: string | null = null;
      try {
        const supabaseServer = await createServerSupabaseClient();
        const { data: { user: currentUser } } = await supabaseServer.auth.getUser();
        if (currentUser) authUserId = currentUser.id;
      } catch (e) {
        // Session not available
      }

      const { data: newPlayer, error: pErr } = await supabase
        .from('players')
        .insert({
          registration_reference: 'REG-REF-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
          full_name: fullName,
          email: email || null,
          mobile: body.mobile || null,
          auth_user_id: authUserId,
          profile_image_url: profileImageUrl,
          cricket_role: cricketRole,
          batting_style: battingStyle,
          jersey_size: jerseySize,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (pErr || !newPlayer) {
        throw new Error(`Failed to create player profile: ${pErr?.message || 'Unknown error'}`);
      }
      playerId = newPlayer.id;
    }

    // 3. Handle Payment Screenshot File Upload if base64 provided
    let screenshotBucket = 'payment-screenshots';
    let screenshotObjectPath: string | null = null;

    if (body.paymentScreenshotBase64) {
      const cleanBase64 = body.paymentScreenshotBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const filename = `player_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.png`;
      screenshotObjectPath = `${tournamentId}/${filename}`;

      await uploadToStorageBucket(screenshotBucket, screenshotObjectPath, buffer, 'image/png');
    } else if (body.paymentScreenshotUrl) {
      screenshotObjectPath = body.paymentScreenshotUrl;
    }

    // 4. Atomic Registration Allocation via allocate_player_registration_v2
    const { data: rpcData, error: rpcErr } = await supabase.rpc('allocate_player_registration_v2', {
      p_tournament_id: tournamentId,
      p_player_id: playerId,
      p_registered_name_snapshot: fullName,
      p_registered_role_snapshot: cricketRole,
      p_registered_batting_style_snapshot: battingStyle,
      p_registered_jersey_size_snapshot: jerseySize,
      p_registered_image_snapshot: profileImageUrl,
      p_screenshot_bucket: screenshotBucket,
      p_screenshot_object_path: screenshotObjectPath,
    });

    if (rpcErr || !rpcData || rpcData.length === 0) {
      console.error('RPC allocate_player_registration_v2 Error:', rpcErr);
      return NextResponse.json({
        error: rpcErr?.message || 'Failed to complete registration atomically',
      }, { status: 400 });
    }

    const result = rpcData[0];

    return NextResponse.json({
      success: true,
      registrationId: result.registration_id,
      registrationNumber: result.registration_number,
      registrationStatus: result.registration_status,
      waitlistPosition: result.waitlist_position,
      paymentId: result.payment_id,
      paymentOrder: {
        orderId: `order_${Date.now()}`,
        amount: tournament.registration_fee || 50000,
      },
      message: result.registration_status === 'WAITING_LIST' 
        ? `Player capacity full. Placed on waitlist position #${result.waitlist_position}.`
        : 'Registration completed successfully!',
    });
  } catch (err: any) {
    console.error('Registration API POST error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
