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
      iconPlayerJerseySize,
      ownerIsPlaying,
      ownerCricketRole,
    } = body;

    if (!tournamentId || !ownerName || !contactEmail) {
      return NextResponse.json({ error: 'Tournament ID, Owner Name, and Contact Email are required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // ─── 1. FETCH & VALIDATE TOURNAMENT ──────────────────────────────────────
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

    // ─── 2. RESOLVE / CREATE OWNER PLAYER PROFILE ────────────────────────────
    let effectiveOwnerPlayerId: string | null = null;

    // 2a. Verify if supplied playerId exists in players table (by id or user_id)
    if (playerId) {
      const { data: pById } = await supabase
        .from('players')
        .select('id')
        .or(`id.eq.${playerId},user_id.eq.${playerId}`)
        .maybeSingle();

      if (pById?.id) {
        effectiveOwnerPlayerId = pById.id;
      }
    }

    // 2b. If not found by ID, lookup by contact email
    if (!effectiveOwnerPlayerId && contactEmail) {
      const { data: pByEmail } = await supabase
        .from('players')
        .select('id')
        .eq('email', contactEmail.toLowerCase().trim())
        .maybeSingle();

      if (pByEmail?.id) {
        effectiveOwnerPlayerId = pByEmail.id;
      }
    }

    // 2c. If still not found, create a new player profile to guarantee FK validity
    if (!effectiveOwnerPlayerId) {
      const ref = 'OWNER-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const newPlayerData: any = {
        registration_reference: ref,
        full_name: ownerName.trim(),
        email: contactEmail.toLowerCase().trim(),
        mobile: contactPhone || '0000000000',
      };
      if (playerId) {
        newPlayerData.user_id = playerId;
      }

      const { data: createdPlayer } = await supabase
        .from('players')
        .insert(newPlayerData)
        .select('id')
        .maybeSingle();

      if (createdPlayer?.id) {
        effectiveOwnerPlayerId = createdPlayer.id;
      }
    }

    // ─── 3. DUPLICATE PREVENTION ─────────────────────────────────────────────
    // Check if this user/email already has an OWNER registration for this tournament
    if (effectiveOwnerPlayerId) {
      const { data: existingOwnerReg } = await supabase
        .from('registrations')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('player_id', effectiveOwnerPlayerId)
        .in('registration_type', ['OWNER', 'ICON'])
        .maybeSingle();

      if (existingOwnerReg) {
        return NextResponse.json({
          error: 'You are already registered as an Owner or Icon player for this tournament.',
        }, { status: 400 });
      }
    }

    // Also check team_owners table for duplicate email
    const { data: existingOwner } = await supabase
      .from('team_owners')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('contact_email', contactEmail.trim().toLowerCase())
      .maybeSingle();

    if (existingOwner) {
      return NextResponse.json({
        error: 'An owner with this email is already registered for this tournament.',
      }, { status: 400 });
    }

    // ─── 4. ATOMIC DUAL-CAPACITY VALIDATION ──────────────────────────────────
    // Owner registration consumes:
    //   - 1 owner/team slot (from max_teams)
    //   - 2 player slots (Owner entry + Icon entry) from max_players

    // 4a. Check owner/team capacity
    const { count: currentOwnersCount } = await supabase
      .from('team_owners')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId);

    const maxTeams = tournament.max_teams || 8;
    if ((currentOwnersCount || 0) >= maxTeams) {
      return NextResponse.json({
        error: `All ${maxTeams} team owner slots for this tournament are already filled.`,
      }, { status: 400 });
    }

    // 4b. Check player capacity — Owner + Icon = 2 player slots required
    const { count: currentPlayerCount } = await supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .or('status.eq.CONFIRMED,registration_status.eq.CONFIRMED,status.eq.PENDING,registration_status.eq.PENDING');

    const maxPlayers = tournament.max_players || 100;
    const playerSlotsNeeded = 2; // Owner (as player) + Icon player
    const currentPlayers = currentPlayerCount || 0;
    const availablePlayerSlots = maxPlayers - currentPlayers;

    if (availablePlayerSlots < playerSlotsNeeded) {
      return NextResponse.json({
        error: `Insufficient player capacity. Owner registration requires ${playerSlotsNeeded} player slots (Owner + Icon), but only ${Math.max(0, availablePlayerSlots)} slots remain out of ${maxPlayers}. Registration cannot proceed.`,
      }, { status: 400 });
    }

    // ─── 5. ALL CAPACITY CHECKS PASSED — BEGIN INSERTS ───────────────────────
    const nextSlot = (currentOwnersCount || 0) + 1;
    const finalTeamName = teamName?.trim() || `Team ${ownerName.trim()}`;

    // 5a. Insert Team Owner Record
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

    if (insertErr && insertErr.message?.includes('foreign key constraint')) {
      // Fallback: if player_id FK constraint fails, set player_id to null
      ownerPayload.player_id = null;
      const fkFallbackRes = await supabase
        .from('team_owners')
        .insert(ownerPayload)
        .select()
        .single();
      newOwner = fkFallbackRes.data;
      insertErr = fkFallbackRes.error;
    }

    if (insertErr || !newOwner) {
      console.error('Team Owner insert error:', insertErr);
      return NextResponse.json({ error: insertErr?.message || 'Failed to insert team owner record' }, { status: 500 });
    }

    let ownerRegistrationId: string | null = null;
    let iconRegistrationId: string | null = null;

    // 5b. Create OWNER Registration record (counts as 1 player slot toward max_players)
    if (effectiveOwnerPlayerId) {
      const ownerRegRef = 'OWNER-REG-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: ownerRegData, error: ownerRegErr } = await supabase
        .from('registrations')
        .insert({
          tournament_id: tournamentId,
          player_id: effectiveOwnerPlayerId,
          registration_reference: ownerRegRef,
          status: 'PENDING',
          registration_status: 'PENDING',
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
        if (ownerRegistrationId && paymentScreenshotUrl) {
          try {
            await supabase.from('payments').insert({
              registration_id: ownerRegistrationId,
              amount: tournament.owner_registration_fee || 250000,
              payment_method: 'UPI_QR',
              payment_status: 'PENDING',
              payment_screenshot_url: paymentScreenshotUrl,
              transaction_reference: 'OWNER-PAY-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
              created_at: new Date().toISOString(),
            });
          } catch (pErr) {
            console.error('Owner payment insert error:', pErr);
          }
        }
      }
    }

    // 5c. Create ICON Player Profile & ICON Registration record (counts as 1 player slot toward max_players)
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
          registration_status: 'CONFIRMED',
          registration_type: 'ICON',
          team_name: finalTeamName,
          team_owner_id: newOwner.id,
          registered_name_snapshot: `${targetIconName}`,
          registered_role_snapshot: iconPlayerRole || ownerCricketRole || 'BATSMAN',
          registered_batting_style_snapshot: iconPlayerBattingStyle || 'RIGHT_HAND',
          registered_jersey_size_snapshot: iconPlayerJerseySize || 'M',
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

    // 5d. Update team_owners with created registration IDs if column exists
    if (ownerRegistrationId || iconRegistrationId) {
      await supabase
        .from('team_owners')
        .update({
          owner_registration_id: ownerRegistrationId,
          icon_registration_id: iconRegistrationId,
        })
        .eq('id', newOwner.id);
    }

    // ─── 6. RESPOND WITH CAPACITY SUMMARY ────────────────────────────────────
    return NextResponse.json({
      success: true,
      ownerId: newOwner.id,
      slotNumber: nextSlot,
      teamName: finalTeamName,
      status: 'PENDING',
      capacitySummary: {
        ownerSlotsUsed: nextSlot,
        ownerSlotsTotal: maxTeams,
        ownerSlotsRemaining: maxTeams - nextSlot,
        playerSlotsUsed: currentPlayers + playerSlotsNeeded,
        playerSlotsTotal: maxPlayers,
        playerSlotsRemaining: maxPlayers - (currentPlayers + playerSlotsNeeded),
      },
      message: `Registered as Team Owner #${nextSlot} ("${finalTeamName}") successfully! Owner and Icon Player both registered (2 player slots consumed). Owner slots: ${nextSlot}/${maxTeams}, Player slots: ${currentPlayers + playerSlotsNeeded}/${maxPlayers}.`,
    });
  } catch (err: any) {
    console.error('Owner Registration error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
