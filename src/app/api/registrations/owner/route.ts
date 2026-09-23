import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadToStorageBucket } from '@/lib/storage/upload';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tournamentId,
      ownerName,
      contactEmail,
      contactPhone,
      playerId,
      paymentScreenshotUrl,
      paymentScreenshotBase64,
      teamName,
      teamLogoUrl,
      iconPlayerName,
      iconPlayerMobile,
      iconPlayerRole,
      iconPlayerBattingStyle,
      iconPlayerBowlingStyle,
      iconExistingPlayerId,
    } = body;

    if (!tournamentId || !ownerName || !contactEmail) {
      return NextResponse.json({ error: 'Tournament ID, Owner Name, and Contact Email are required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Resolve or Create Owner Player Record
    let effectiveOwnerPlayerId: string | null = null;
    const emailClean = contactEmail.toLowerCase().trim();

    if (playerId) {
      const { data: pById } = await supabase
        .from('players')
        .select('id')
        .or(`id.eq.${playerId},auth_user_id.eq.${playerId}`)
        .maybeSingle();
      if (pById?.id) effectiveOwnerPlayerId = pById.id;
    }

    if (!effectiveOwnerPlayerId) {
      const { data: pByEmail } = await supabase
        .from('players')
        .select('id')
        .eq('email', emailClean)
        .maybeSingle();
      if (pByEmail?.id) effectiveOwnerPlayerId = pByEmail.id;
    }

    if (!effectiveOwnerPlayerId) {
      // Find auth user ID if available
      let authUserId: string | null = null;
      try {
        const { data: usersData } = await supabase.auth.admin.listUsers();
        const existingUser = usersData?.users?.find((u) => u.email?.toLowerCase() === emailClean);
        authUserId = existingUser?.id || null;
      } catch (e) {
        console.warn('Auth lookup warning:', e);
      }

      const { data: newOwnerPlayer, error: pErr } = await supabase
        .from('players')
        .insert({
          registration_reference: 'OWNER-REF-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
          full_name: ownerName.trim(),
          email: emailClean,
          mobile: contactPhone || null,
          auth_user_id: authUserId,
          player_type: 'OWNER',
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (pErr || !newOwnerPlayer) {
        throw new Error(`Failed to create owner profile: ${pErr?.message || 'Unknown error'}`);
      }
      effectiveOwnerPlayerId = newOwnerPlayer.id;
    }

    // 2. Handle Payment Screenshot File Upload
    let screenshotBucket = 'payment-screenshots';
    let screenshotObjectPath: string | null = null;

    if (paymentScreenshotBase64) {
      const cleanBase64 = paymentScreenshotBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const filename = `owner_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.png`;
      screenshotObjectPath = `${tournamentId}/${filename}`;

      await uploadToStorageBucket(screenshotBucket, screenshotObjectPath, buffer, 'image/png');
    } else if (paymentScreenshotUrl) {
      screenshotObjectPath = paymentScreenshotUrl;
    }

    // 3. Call Atomic PostgreSQL RPC: allocate_owner_registration_v3
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('allocate_owner_registration_v3', {
      p_tournament_id: tournamentId,
      p_owner_player_id: effectiveOwnerPlayerId,
      p_owner_name: ownerName.trim(),
      p_contact_email: emailClean,
      p_contact_phone: contactPhone || null,
      p_team_name: teamName?.trim() || `Team ${ownerName.trim()}`,
      p_team_logo_url: teamLogoUrl || null,
      p_screenshot_bucket: screenshotBucket,
      p_screenshot_object_path: screenshotObjectPath,
      p_icon_name: iconPlayerName?.trim() || ownerName.trim(),
      p_icon_mobile: iconPlayerMobile || contactPhone || null,
      p_icon_role: iconPlayerRole || 'BATSMAN',
      p_icon_batting_style: iconPlayerBattingStyle || 'RIGHT_HAND',
      p_icon_bowling_style: iconPlayerBowlingStyle || null,
      p_icon_existing_player_id: iconExistingPlayerId || null,
    });

    if (rpcErr || !rpcResult || rpcResult.length === 0) {
      console.error('RPC Error allocate_owner_registration_v3:', rpcErr);
      return NextResponse.json({
        error: rpcErr?.message || 'Failed to allocate owner slot atomically',
      }, { status: 400 });
    }

    const result = rpcResult[0];

    return NextResponse.json({
      success: true,
      ownerId: result.owner_id,
      slotNumber: result.slot_number,
      ownerRegistrationId: result.owner_registration_id,
      iconRegistrationId: result.icon_registration_id,
      paymentId: result.payment_id,
      status: result.status,
      message: `Owner registration completed atomically! Slot #${result.slot_number} assigned.`,
    });
  } catch (err: any) {
    console.error('Owner Registration Endpoint Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
