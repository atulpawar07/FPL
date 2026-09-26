import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { uploadToStorageBucket, validateImageFileBuffer } from '@/lib/storage/upload';

export async function POST(req: NextRequest) {
  try {
    const supabaseServer = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();

    const fullName = body.fullName?.trim();
    if (!fullName || fullName.length < 2) {
      return NextResponse.json({ error: 'Please enter a valid full name (at least 2 characters)' }, { status: 400 });
    }

    const profileImageUrl = body.profileImageUrl || body.profilePhotoPath;
    if (!profileImageUrl) {
      return NextResponse.json({ error: 'Please upload your profile photo to complete registration' }, { status: 400 });
    }

    const rawRole = body.cricketRole || body.primaryRole || 'BATSMAN';
    const cricketRole = rawRole === 'WICKETKEEPER' || rawRole === 'BATSMAN_BOWLER' ? 'ALL_ROUNDER' : rawRole;
    const battingStyle = body.battingStyle || 'RIGHT_HAND';
    const jerseySize = body.jerseySize || 'M';

    // 1. Resolve Player Profile from Authenticated Session ONLY
    const { data: playerProfile, error: profileErr } = await supabaseServer
      .from('players')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (profileErr || !playerProfile?.id) {
      return NextResponse.json({ error: 'You must complete your player profile before registering for a tournament.' }, { status: 400 });
    }

    const playerId = playerProfile.id;

    const supabaseAdmin = createAdminClient();

    // 2. Fetch Target Tournament
    let tournament;
    if (body.tournamentId) {
      const { data: t } = await supabaseAdmin
        .from('tournaments')
        .select('id, name, registration_fee, max_players, registration_open, waitlist_enabled')
        .eq('id', body.tournamentId)
        .maybeSingle();
      tournament = t;
    }

    if (!tournament) {
      const { data: latest } = await supabaseAdmin
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

    // 3. Pre-validate Payment Screenshot File (if submitted)
    // We ignore body.paymentScreenshotUrl to prevent client path spoofing.
    const screenshotBucket = 'payment-screenshots';
    let screenshotBuffer: Buffer | null = null;
    let screenshotValidation: any = null;

    if (body.paymentScreenshotBase64) {
      const cleanBase64 = body.paymentScreenshotBase64.replace(/^data:image\/\w+;base64,/, '');
      screenshotBuffer = Buffer.from(cleanBase64, 'base64');
      screenshotValidation = validateImageFileBuffer(screenshotBuffer);
      if (!screenshotValidation.isValid || !screenshotValidation.mimeType || !screenshotValidation.extension) {
        return NextResponse.json({ error: screenshotValidation.error || 'Invalid payment screenshot file format' }, { status: 400 });
      }
    }

    // 4. Atomic Registration Allocation via allocate_player_registration_v2
    const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('allocate_player_registration_v2', {
      p_tournament_id: tournamentId,
      p_player_id: playerId,
      p_registered_name_snapshot: fullName,
      p_registered_role_snapshot: cricketRole,
      p_registered_batting_style_snapshot: battingStyle,
      p_registered_jersey_size_snapshot: jerseySize,
      p_registered_image_snapshot: profileImageUrl,
      p_screenshot_bucket: screenshotBucket,
      p_screenshot_object_path: null,
    });

    if (rpcErr || !rpcData || rpcData.length === 0) {
      console.error('RPC allocate_player_registration_v2 Error:', rpcErr);
      return NextResponse.json({
        error: rpcErr?.message || 'Failed to complete registration atomically',
      }, { status: 400 });
    }

    const result = rpcData[0];
    const registrationId = result.registration_id;

    // 5. Upload Payment Screenshot to Storage using canonical registrationId path
    let screenshotObjectPath: string | null = null;
    if (screenshotBuffer && screenshotValidation) {
      const ext = screenshotValidation.extension;
      const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${ext}`;
      screenshotObjectPath = `${tournamentId}/${registrationId}/${filename}`;

      try {
        await uploadToStorageBucket(screenshotBucket, screenshotObjectPath, screenshotBuffer, screenshotValidation.mimeType);

        // Update payments row with canonical screenshot object path
        if (result.payment_id) {
          await supabaseAdmin
            .from('payments')
            .update({
              screenshot_bucket: screenshotBucket,
              screenshot_object_path: screenshotObjectPath,
            })
            .eq('id', result.payment_id);
        }
      } catch (uploadErr: any) {
        console.error('Failed to upload payment screenshot:', uploadErr);
        // Registration is preserved; client can upload screenshot via receipt page if needed
      }
    }

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
