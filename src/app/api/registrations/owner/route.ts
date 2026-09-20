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
      teamName,
      teamLogoUrl,
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

    // Verify tournament is OWNER_BASED (using select('*') so missing columns on remote DB don't cause error)
    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('*')
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

    const isIconEnabled = tournament.icon_player_enabled !== false;
    const isPlayingAllowed = tournament.owner_is_playing_enabled !== false;

    if (isIconEnabled && !iconPlayerName?.trim() && !ownerIsPlaying) {
      return NextResponse.json({ error: 'Icon Player Name is required for this tournament' }, { status: 400 });
    }

    // Auto-resolve or create Player record for Owner (zero duplicate user profiles)
    let effectiveOwnerPlayerId: string | null = playerId || null;
    if (!effectiveOwnerPlayerId) {
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('email', contactEmail.toLowerCase().trim())
        .maybeSingle();

      if (existingPlayer?.id) {
        effectiveOwnerPlayerId = existingPlayer.id;
      } else {
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
          effectiveOwnerPlayerId = createdPlayer.id;
        }
      }
    }

    // Check team owner capacity (max_teams)
    const { count: currentOwnersCount } = await supabase
      .from('team_owners')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId);

    const maxTeams = tournament.max_teams || 8;
    if ((currentOwnersCount || 0) >= maxTeams) {
      return NextResponse.json({ error: `All ${maxTeams} team owner slots for this tournament are already filled.` }, { status: 400 });
    }

    const nextSlot = (currentOwnersCount || 0) + 1;
    const finalTeamName = teamName?.trim() || `Team ${ownerName.trim()}`;

    // 1. Insert Team Owner Record (with fallback if new schema columns are missing on remote DB)
    const ownerPayload: any = {
      tournament_id: tournamentId,
      player_id: effectiveOwnerPlayerId,
      team_name: finalTeamName,
      team_logo_url: teamLogoUrl || null,
      owner_name: ownerName.trim(),
      contact_email: contactEmail.trim().toLowerCase(),
      contact_phone: contactPhone || null,
      slot_number: nextSlot,
      status: 'PENDING',
      payment_status: 'PENDING',
      payment_screenshot_url: paymentScreenshotUrl || null,
      owner_is_playing: ownerIsPlaying !== false && isPlayingAllowed,
      owner_cricket_role: ownerCricketRole || 'BATSMAN',
      icon_player_name: iconPlayerName?.trim() || ownerName.trim(),
      icon_player_mobile: iconPlayerMobile || contactPhone || null,
      icon_player_role: iconPlayerRole || ownerCricketRole || 'BATSMAN',
      icon_player_batting_style: iconPlayerBattingStyle || 'RIGHT_HAND',
    };

    let { data: newOwner, error: insertErr } = await supabase
      .from('team_owners')
      .insert(ownerPayload)
      .select()
      .single();

    if (insertErr && insertErr.message?.includes('column')) {
      // Fallback: strip newly added schema columns if remote DB hasn't run latest SQL migration
      delete ownerPayload.team_name;
      delete ownerPayload.team_logo_url;
      delete ownerPayload.owner_is_playing;
      delete ownerPayload.owner_cricket_role;
      delete ownerPayload.icon_player_name;
      delete ownerPayload.icon_player_mobile;
      delete ownerPayload.icon_player_role;
      delete ownerPayload.icon_player_batting_style;

      const fallbackRes = await supabase
        .from('team_owners')
        .insert(ownerPayload)
        .select()
        .single();
      newOwner = fallbackRes.data;
      insertErr = fallbackRes.error;
    }

    if (insertErr || !newOwner) {
      console.error('Team Owner insert error:', insertErr);
      return NextResponse.json({ error: insertErr?.message || 'Failed to insert team owner record' }, { status: 500 });
    }

    let ownerRegistrationId: string | null = null;
    let iconRegistrationId: string | null = null;

    // 2. Create OWNER Registration record in registrations table
    if (effectiveOwnerPlayerId) {
      const ownerRegRef = 'OWNER-REG-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: ownerRegData, error: ownerRegErr } = await supabase
        .from('registrations')
        .insert({
          tournament_id: tournamentId,
          player_id: effectiveOwnerPlayerId,
          registration_reference: ownerRegRef,
          status: 'PENDING',
          registration_type: 'OWNER',
          team_name: finalTeamName,
          team_owner_id: newOwner.id,
          registered_name_snapshot: `${ownerName.trim()}`,
          registered_role_snapshot: ownerCricketRole || 'ALL_ROUNDER',
          registered_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (ownerRegErr) {
        console.warn('Could not insert OWNER registration record (falling back):', ownerRegErr.message);
      } else {
        ownerRegistrationId = ownerRegData?.id || null;
      }
    }

    // 3. Create ICON Player Profile & ICON Registration record in registrations table
    const targetIconName = iconPlayerName?.trim() || ownerName.trim();
    let effectiveIconPlayerId: string | null = null;

    if (iconPlayerName?.trim() && iconPlayerName.trim().toLowerCase() !== ownerName.trim().toLowerCase()) {
      // Create separate player profile for designated Icon player
      const iconEmail = `icon-${nextSlot}-${Date.now()}@fairplay.com`;
      const { data: iconPlayer } = await supabase
        .from('players')
        .insert({
          registration_reference: 'ICON-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
          full_name: targetIconName,
          email: iconEmail,
          mobile: iconPlayerMobile || '0000000000',
        })
        .select('id')
        .single();
      effectiveIconPlayerId = iconPlayer?.id || null;
    } else {
      // Owner is the Icon player
      effectiveIconPlayerId = effectiveOwnerPlayerId;
    }

    if (effectiveIconPlayerId) {
      const iconRegRef = 'ICON-REG-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: iconRegData, error: iconRegErr } = await supabase
        .from('registrations')
        .insert({
          tournament_id: tournamentId,
          player_id: effectiveIconPlayerId,
          registration_reference: iconRegRef,
          status: 'CONFIRMED',
          registration_type: 'ICON',
          team_name: finalTeamName,
          team_owner_id: newOwner.id,
          registered_name_snapshot: `${targetIconName}`,
          registered_role_snapshot: iconPlayerRole || ownerCricketRole || 'BATSMAN',
          registered_batting_style_snapshot: iconPlayerBattingStyle || 'RIGHT_HAND',
          registered_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (iconRegErr) {
        console.warn('Could not insert ICON registration record (falling back):', iconRegErr.message);
      } else {
        iconRegistrationId = iconRegData?.id || null;
      }
    }

    // Update team_owners with created registration IDs if column exists
    if (ownerRegistrationId || iconRegistrationId) {
      await supabase
        .from('team_owners')
        .update({
          owner_registration_id: ownerRegistrationId,
          icon_registration_id: iconRegistrationId,
        })
        .eq('id', newOwner.id);
    }

    return NextResponse.json({
      success: true,
      ownerId: newOwner.id,
      slotNumber: nextSlot,
      teamName: finalTeamName,
      status: 'PENDING',
      message: `Registered as Team Owner #${nextSlot} ("${finalTeamName}") successfully! Registered as Owner and Icon Player.`,
    });
  } catch (err: any) {
    console.error('Owner Registration error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

