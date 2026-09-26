import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { playerProfileSchema } from '@/lib/validation/registration';
import { uploadToStorageBucket, validateImageFileBuffer } from '@/lib/storage/upload';

export async function GET() {
  try {
    const supabaseServer = await createServerSupabaseClient();
    const {
      data: { user },
      error: authErr,
    } = await supabaseServer.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: player, error } = await supabaseAdmin
      .from('players')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch all tournament registrations associated with this player or email
    let registrations: any[] = [];
    if (player?.id || user.email) {
      let regQuery = supabaseAdmin
        .from('registrations')
        .select(
          `
          id,
          registration_number,
          registration_status,
          registered_name_snapshot,
          registered_role_snapshot,
          registered_jersey_size_snapshot,
          registered_at,
          tournament:tournaments (
            id,
            name,
            tournament_date
          ),
          payments:payments (
            payment_status,
            amount
          )
        `
        )
        .order('registered_at', { ascending: false });

      if (player?.id) {
        regQuery = regQuery.eq('player_id', player.id);
      }

      const { data: regData } = await regQuery;
      registrations = regData || [];
    }

    return NextResponse.json({
      player: player || null,
      authUser: { id: user.id, email: user.email },
      registrations,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabaseServer = await createServerSupabaseClient();
    const {
      data: { user },
      error: authErr,
    } = await supabaseServer.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validationResult = playerProfileSchema.safeParse({
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

    // Handle Profile Image Upload (Base64 / Storage upload)
    let effectiveProfileImageUrl = data.profileImageUrl;
    const isBase64 = data.profileImageUrl && data.profileImageUrl.startsWith('data:image/');
    const isExternalUrl = data.profileImageUrl && (data.profileImageUrl.startsWith('http://') || data.profileImageUrl.startsWith('https://'));

    if (isExternalUrl && !isBase64) {
      return NextResponse.json(
        { error: 'Arbitrary external profile image URLs are not allowed. Please upload an image file (JPEG, PNG, WebP).' },
        { status: 400 }
      );
    }

    if (isBase64) {
      const cleanBase64 = data.profileImageUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const validation = validateImageFileBuffer(buffer);

      if (!validation.isValid || !validation.mimeType) {
        return NextResponse.json({ error: validation.error || 'Invalid profile image file format' }, { status: 400 });
      }

      const ext = validation.mimeType === 'image/jpeg' ? 'jpg' : validation.mimeType === 'image/webp' ? 'webp' : 'png';
      const objectPath = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${ext}`;

      try {
        const uploadResult = await uploadToStorageBucket('profile-images', objectPath, buffer, validation.mimeType);
        effectiveProfileImageUrl = uploadResult.publicUrl || objectPath;
      } catch (uploadErr: any) {
        return NextResponse.json({ error: uploadErr.message || 'Failed to upload profile image' }, { status: 400 });
      }
    }

    // Upsert player profile with fallback if jersey_size or auth_user_id column is missing on remote DB
    const playerPayload: any = {
      auth_user_id: user.id,
      full_name: data.fullName,
      email: user.email!,
      profile_image_url: effectiveProfileImageUrl,
      cricket_role: data.cricketRole,
      batting_style: data.battingStyle || null,
      jersey_size: data.jerseySize || null,
      updated_at: new Date().toISOString(),
    };

    let { data: updatedPlayer, error } = await supabaseAdmin
      .from('players')
      .upsert(playerPayload, { onConflict: 'auth_user_id' })
      .select('*')
      .maybeSingle();

    if (error && error.message?.includes('column')) {
      delete playerPayload.jersey_size;
      delete playerPayload.batting_style;

      const fallbackRes = await supabaseAdmin
        .from('players')
        .upsert(playerPayload, { onConflict: 'auth_user_id' })
        .select('*')
        .maybeSingle();

      updatedPlayer = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error && error.message?.includes('column')) {
      // Mismatch on auth_user_id column as well
      delete playerPayload.auth_user_id;
      const emailFallbackRes = await supabaseAdmin
        .from('players')
        .upsert(playerPayload, { onConflict: 'email' })
        .select('*')
        .maybeSingle();

      updatedPlayer = emailFallbackRes.data;
      error = emailFallbackRes.error;
    }

    if (error || !updatedPlayer) {
      return NextResponse.json({ error: error?.message || 'Failed to save player profile' }, { status: 500 });
    }

    return NextResponse.json({ success: true, player: updatedPlayer });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
