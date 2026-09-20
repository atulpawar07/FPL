import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { playerProfileSchema } from '@/lib/validation/registration';

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

    // Upsert player profile tied to auth_user_id
    const { data: updatedPlayer, error } = await supabaseAdmin
      .from('players')
      .upsert(
        {
          auth_user_id: user.id,
          full_name: data.fullName,
          email: user.email!,
          profile_image_url: data.profileImageUrl,
          cricket_role: data.cricketRole,
          batting_style: data.battingStyle || null,
          jersey_size: data.jerseySize || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'auth_user_id' }
      )
      .select('*')
      .single();

    if (error || !updatedPlayer) {
      return NextResponse.json({ error: error?.message || 'Failed to save player profile' }, { status: 500 });
    }

    return NextResponse.json({ success: true, player: updatedPlayer });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
