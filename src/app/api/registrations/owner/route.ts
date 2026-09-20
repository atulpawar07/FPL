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
      ownerIsPlaying,
      ownerCricketRole,
    } = body;

    if (!tournamentId || !ownerName || !contactEmail) {
      return NextResponse.json({ error: 'Tournament ID, Owner Name, and Contact Email are required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify tournament is OWNER_BASED
    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('id, name, max_teams, owner_registration_fee, tournament_type, icon_player_enabled, owner_is_playing_enabled')
      .eq('id', tournamentId)
      .maybeSingle();

    if (tErr) {
      console.error('Fetch tournament error in owner registration:', tErr);
      return NextResponse.json({ error: `Database error: ${tErr.message}` }, { status: 500 });
    }

    if (!tournament) {
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

    const isPlayingOwner = ownerIsPlaying !== false && tournament.owner_is_playing_enabled !== false;

    // Direct insert owner record
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
        owner_is_playing: isPlayingOwner,
        owner_cricket_role: ownerCricketRole || 'BATSMAN',
        icon_player_name: iconPlayerName || null,
        icon_player_mobile: iconPlayerMobile || null,
        icon_player_role: iconPlayerRole || null,
        icon_player_batting_style: iconPlayerBattingStyle || null,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Team Owner insert error:', insertErr);
      return NextResponse.json({ error: insertErr.message || 'Failed to insert team owner record' }, { status: 500 });
    }

    // AUTO-ADD TO PLAYER ROSTER:
    // 1. If Team Owner is playing as a player, add to registrations table
    if (isPlayingOwner && effectivePlayerId) {
      const ownerRegRef = 'OWNER-REG-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      try {
        await supabase.from('registrations').upsert({
          tournament_id: tournamentId,
          player_id: effectivePlayerId,
          registration_reference: ownerRegRef,
          status: 'CONFIRMED',
          registration_type: 'TEAM_OWNER',
          registered_name_snapshot: `${ownerName.trim()} (👑 Owner - Slot #${nextSlot})`,
          registered_role_snapshot: ownerCricketRole || 'BATSMAN',
          registered_at: new Date().toISOString(),
        }, { onConflict: 'tournament_id,player_id' });
      } catch (err) {
        console.error('Owner registration insert err:', err);
      }
    }

    // 2. If Icon Player is provided, create player profile and add to registrations table
    if (iconPlayerName?.trim()) {
      const iconRef = 'ICON-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const iconEmail = `icon-${nextSlot}-${Date.now()}@fairplay.com`;

      const { data: iconPlayer } = await supabase
        .from('players')
        .insert({
          registration_reference: iconRef,
          full_name: iconPlayerName.trim(),
          email: iconEmail,
          mobile: iconPlayerMobile || '0000000000',
        })
        .select('id')
        .single();

      if (iconPlayer?.id) {
        try {
          await supabase.from('registrations').insert({
            tournament_id: tournamentId,
            player_id: iconPlayer.id,
            registration_reference: 'ICON-REG-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
            status: 'CONFIRMED',
            registration_type: 'ICON_PLAYER',
            registered_name_snapshot: `${iconPlayerName.trim()} (⭐ Icon Player - Slot #${nextSlot})`,
            registered_role_snapshot: iconPlayerRole || 'BATSMAN',
            registered_batting_style_snapshot: iconPlayerBattingStyle || 'RIGHT_HAND',
            registered_at: new Date().toISOString(),
          });
        } catch (err) {
          console.error('Icon player registration insert err:', err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      ownerId: newOwner.id,
      slotNumber: nextSlot,
      status: 'PENDING',
      message: `Registered as Team Owner #${nextSlot} successfully! ${isPlayingOwner ? 'Added to Player Roster as Playing Owner.' : ''} ${iconPlayerName?.trim() ? 'Icon Player added to Roster.' : ''}`,
    });
  } catch (err: any) {
    console.error('Owner Registration error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
