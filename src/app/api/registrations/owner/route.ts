import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

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
      iconPlayerName,
      iconPlayerMobile,
      iconPlayerRole,
      iconPlayerBattingStyle,
    } = body;

    if (!tournamentId || !ownerName || !contactEmail) {
      return NextResponse.json({ error: 'Tournament ID, Owner Name, and Contact Email are required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify tournament is OWNER_BASED
    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('id, name, max_teams, owner_registration_fee, tournament_type, icon_player_enabled')
      .eq('id', tournamentId)
      .single();

    if (tErr || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (tournament.tournament_type !== 'OWNER_BASED') {
      return NextResponse.json({ error: 'This tournament does not accept team owner registrations' }, { status: 400 });
    }

    if (tournament.icon_player_enabled && !iconPlayerName?.trim()) {
      return NextResponse.json({ error: 'Icon Player Name is required for this tournament' }, { status: 400 });
    }

    // Auto-resolve or create Player record if playerId not supplied
    let effectivePlayerId: string | null = playerId || null;
    if (!effectivePlayerId) {
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('email', contactEmail.toLowerCase().trim())
        .maybeSingle();

      if (existingPlayer?.id) {
        effectivePlayerId = existingPlayer.id;
      } else {
        // Upsert a lightweight player profile for the owner
        const ref = 'OWNER-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const { data: createdPlayer } = await supabase
          .from('players')
          .insert({
            registration_reference: ref,
            full_name: ownerName.trim(),
            email: contactEmail.toLowerCase().trim(),
            mobile: contactPhone || '0000000000',
          })
          .select('id')
          .single();
        if (createdPlayer?.id) {
          effectivePlayerId = createdPlayer.id;
        }
      }
    }

    // Attempt atomic slot allocation
    const { data: rpcData, error: rpcErr } = await supabase.rpc('allocate_owner_slot', {
      p_tournament_id: tournamentId,
      p_player_id: effectivePlayerId,
      p_owner_name: ownerName,
      p_contact_email: contactEmail,
      p_contact_phone: contactPhone || null,
      p_payment_screenshot_url: paymentScreenshotUrl || null,
      p_icon_player_name: iconPlayerName || null,
      p_icon_player_mobile: iconPlayerMobile || null,
      p_icon_player_role: iconPlayerRole || null,
      p_icon_player_batting_style: iconPlayerBattingStyle || null,
    });

    if (!rpcErr && rpcData && rpcData.length > 0) {
      return NextResponse.json({
        success: true,
        ownerId: rpcData[0].owner_id,
        slotNumber: rpcData[0].slot_number,
        status: rpcData[0].status,
        message: `Registered as Team Owner #${rpcData[0].slot_number} successfully!`,
      });
    }

    // Direct fallback if RPC is not available yet
    const { count: currentOwnersCount } = await supabase
      .from('team_owners')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId);

    const maxTeams = tournament.max_teams || 8;
    if ((currentOwnersCount || 0) >= maxTeams) {
      return NextResponse.json({ error: `All ${maxTeams} team owner slots for this tournament are already filled.` }, { status: 400 });
    }

    const nextSlot = (currentOwnersCount || 0) + 1;

    const { data: newOwner, error: insertErr } = await supabase
      .from('team_owners')
      .insert({
        tournament_id: tournamentId,
        player_id: effectivePlayerId,
        owner_name: ownerName,
        contact_email: contactEmail,
        contact_phone: contactPhone || null,
        slot_number: nextSlot,
        status: 'PENDING',
        payment_status: 'PENDING',
        payment_screenshot_url: paymentScreenshotUrl || null,
        icon_player_name: iconPlayerName || null,
        icon_player_mobile: iconPlayerMobile || null,
        icon_player_role: iconPlayerRole || null,
        icon_player_batting_style: iconPlayerBattingStyle || null,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json({
      success: true,
      ownerId: newOwner.id,
      slotNumber: nextSlot,
      status: 'PENDING',
      message: `Registered as Team Owner #${nextSlot} successfully!`,
    });
  } catch (err: any) {
    console.error('Owner Registration error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
