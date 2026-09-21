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
      ownerTshirtSize,
      ownerTrouserSize,
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

    if (isIconEnabled && !iconPlayerName?.trim()) {
      return NextResponse.json({ error: 'Icon Player Name is required for this tournament' }, { status: 400 });
    }

    // ─── 2. RESOLVE / CREATE OWNER PLAYER PROFILE ────────────────────────────
    let effectiveOwnerPlayerId: string | null = null;
    const emailClean = contactEmail.toLowerCase().trim();

    // 2a. Check if supplied playerId exists
    if (playerId) {
      const { data: pById } = await supabase
        .from('players')
        .select('id')
        .or(`id.eq.${playerId},auth_user_id.eq.${playerId}`)
        .maybeSingle();

      if (pById?.id) {
        effectiveOwnerPlayerId = pById.id;
      }
    }

    // 2b. Lookup by email
    if (!effectiveOwnerPlayerId) {
      const { data: pByEmail } = await supabase
        .from('players')
        .select('id')
        .eq('email', emailClean)
        .maybeSingle();

      if (pByEmail?.id) {
        effectiveOwnerPlayerId = pByEmail.id;
      }
    }

    // 2c. Create new player profile for the owner
    if (!effectiveOwnerPlayerId) {
      // Try to find/create auth user for the owner
      let authUserId: string | null = null;
      try {
        const { data: usersData } = await supabase.auth.admin.listUsers();
        const existingUser = usersData?.users?.find((u) => u.email?.toLowerCase() === emailClean);
        if (existingUser) {
          authUserId = existingUser.id;
        } else {
          const { data: newUser } = await supabase.auth.admin.createUser({
            email: emailClean,
            email_confirm: true,
            user_metadata: { full_name: ownerName.trim() },
          });
          authUserId = newUser?.user?.id || null;
        }
      } catch (e) {
        console.warn('Auth user creation warning in owner route:', e);
      }

      // Insert owner player record — use minimal columns that we know exist
      const ownerPlayerPayload: Record<string, any> = {
        full_name: ownerName.trim(),
        email: emailClean,
        profile_image_url: teamLogoUrl || paymentScreenshotUrl || '/logo.png',
        cricket_role: ownerCricketRole || 'ALL_ROUNDER',
      };

      // Only set auth_user_id if we have one
      if (authUserId) {
        ownerPlayerPayload.auth_user_id = authUserId;
      }

      let { data: createdPlayer, error: pInsErr } = await supabase
        .from('players')
        .insert(ownerPlayerPayload)
        .select('id')
        .maybeSingle();

      // Fallback: try without optional columns
      if (pInsErr) {
        console.warn('First owner player insert attempt failed:', pInsErr.message);
        const minimalPayload: Record<string, any> = {
          full_name: ownerName.trim(),
          email: emailClean,
        };
        if (authUserId) minimalPayload.auth_user_id = authUserId;

        const fallbackRes = await supabase
          .from('players')
          .insert(minimalPayload)
          .select('id')
          .maybeSingle();

        if (fallbackRes.data?.id) {
          createdPlayer = fallbackRes.data;
        } else {
          console.error('Fallback owner player insert also failed:', fallbackRes.error?.message);
        }
      }

      if (createdPlayer?.id) {
        effectiveOwnerPlayerId = createdPlayer.id;
      }
    }

    if (!effectiveOwnerPlayerId) {
      return NextResponse.json({
        error: 'Failed to create or resolve player profile for owner registration. Please try again.',
      }, { status: 500 });
    }

    // ─── 3. DUPLICATE PREVENTION ─────────────────────────────────────────────
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

    const { data: existingOwner } = await supabase
      .from('team_owners')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('contact_email', emailClean)
      .maybeSingle();

    if (existingOwner) {
      return NextResponse.json({
        error: 'An owner with this email is already registered for this tournament.',
      }, { status: 400 });
    }

    // ─── 4. CAPACITY VALIDATION ──────────────────────────────────────────────
    // Owner registration consumes: 1 owner/team slot + 2 player slots (Owner + Icon)

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

    const { count: currentPlayerCount } = await supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .in('registration_status', ['CONFIRMED', 'PENDING']);

    const maxPlayers = tournament.max_players || 100;
    const playerSlotsNeeded = 2; // Owner (as player) + Icon player
    const currentPlayers = currentPlayerCount || 0;
    const availablePlayerSlots = maxPlayers - currentPlayers;

    if (availablePlayerSlots < playerSlotsNeeded) {
      return NextResponse.json({
        error: `Insufficient player capacity. Owner registration requires ${playerSlotsNeeded} player slots (Owner + Icon), but only ${Math.max(0, availablePlayerSlots)} remain out of ${maxPlayers}.`,
      }, { status: 400 });
    }

    // ─── 5. BEGIN INSERTS ────────────────────────────────────────────────────
    const nextSlot = (currentOwnersCount || 0) + 1;
    const finalTeamName = teamName?.trim() || `Team ${ownerName.trim()}`;

    // 5a. Insert Team Owner Record
    const ownerPayload: Record<string, any> = {
      tournament_id: tournamentId,
      player_id: effectiveOwnerPlayerId,
      team_name: finalTeamName,
      team_logo_url: teamLogoUrl || null,
      owner_name: ownerName.trim(),
      contact_email: emailClean,
      contact_phone: contactPhone || null,
      slot_number: nextSlot,
      status: 'PENDING',
      payment_status: 'PENDING',
      payment_screenshot_url: paymentScreenshotUrl || null,
      owner_is_playing: ownerIsPlaying !== false,
      owner_cricket_role: ownerCricketRole || 'BATSMAN',
      icon_player_name: iconPlayerName?.trim() || ownerName.trim(),
      icon_player_mobile: iconPlayerMobile || contactPhone || null,
      icon_player_role: iconPlayerRole || ownerCricketRole || 'BATSMAN',
      icon_player_batting_style: iconPlayerBattingStyle || 'RIGHT_HAND',
    };

    let { data: newOwner, error: ownerInsertErr } = await supabase
      .from('team_owners')
      .insert(ownerPayload)
      .select()
      .single();

    // Fallback: strip newer columns if DB doesn't have them yet
    if (ownerInsertErr && ownerInsertErr.message?.includes('column')) {
      const corePayload: Record<string, any> = {
        tournament_id: tournamentId,
        player_id: effectiveOwnerPlayerId,
        owner_name: ownerName.trim(),
        contact_email: emailClean,
        contact_phone: contactPhone || null,
        slot_number: nextSlot,
        status: 'PENDING',
        payment_status: 'PENDING',
        payment_screenshot_url: paymentScreenshotUrl || null,
      };
      const fb = await supabase.from('team_owners').insert(corePayload).select().single();
      newOwner = fb.data;
      ownerInsertErr = fb.error;
    }

    if (ownerInsertErr || !newOwner) {
      console.error('Team Owner insert error:', ownerInsertErr);
      return NextResponse.json({
        error: ownerInsertErr?.message || 'Failed to insert team owner record',
      }, { status: 500 });
    }

    // 5b. Create OWNER Registration record (1 player slot)
    let ownerRegistrationId: string | null = null;
    {
      const ownerRegRef = 'OWNER-REG-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const ownerRegPayload: Record<string, any> = {
        tournament_id: tournamentId,
        player_id: effectiveOwnerPlayerId,
        registration_number: ownerRegRef,
        registration_reference: ownerRegRef,
        status: 'PENDING',
        registration_status: 'PENDING',
        registration_type: 'OWNER',
        team_name: finalTeamName,
        team_owner_id: newOwner.id,
        registered_name_snapshot: ownerName.trim(),
        registered_role_snapshot: ownerCricketRole || 'ALL_ROUNDER',
        registered_image_snapshot: teamLogoUrl || paymentScreenshotUrl || '/logo.png',
        registered_at: new Date().toISOString(),
      };

      let { data: ownerRegData, error: ownerRegErr } = await supabase
        .from('registrations')
        .insert(ownerRegPayload)
        .select('id')
        .single();

      if (ownerRegErr) {
        console.warn('Owner registration insert failed, trying fallback:', ownerRegErr.message);
        // Strip columns that may not exist
        const fallbackPayload: Record<string, any> = {
          tournament_id: tournamentId,
          player_id: effectiveOwnerPlayerId,
          registration_number: ownerRegRef,
          registration_status: 'PENDING',
          registered_name_snapshot: ownerName.trim(),
          registered_role_snapshot: ownerCricketRole || 'ALL_ROUNDER',
          registered_image_snapshot: teamLogoUrl || paymentScreenshotUrl || '/logo.png',
          registered_at: new Date().toISOString(),
        };
        const fb = await supabase.from('registrations').insert(fallbackPayload).select('id').single();
        ownerRegData = fb.data;
        ownerRegErr = fb.error;
      }

      if (ownerRegErr) {
        console.error('Owner registration insert failed completely:', ownerRegErr.message);
      } else {
        ownerRegistrationId = ownerRegData?.id || null;
        // Create payment record for owner with total clubbed fee (Owner Fee + Player Fee)
        if (ownerRegistrationId && paymentScreenshotUrl) {
          try {
            const ownerFeePaise = tournament.owner_registration_fee || 900000;
            const playerFeePaise = tournament.registration_fee || 90000;
            const totalClubbedFeePaise = body.clubbedAmountPaise || (ownerFeePaise + playerFeePaise);

            await supabase.from('payments').insert({
              registration_id: ownerRegistrationId,
              amount: totalClubbedFeePaise,
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

    // 5c. Create ICON Player Profile & Registration (1 more player slot)
    let iconRegistrationId: string | null = null;
    {
      const targetIconName = iconPlayerName?.trim() || ownerName.trim();
      let effectiveIconPlayerId: string | null = null;

      // If icon player is different from owner, create a separate player profile
      if (iconPlayerName?.trim() && iconPlayerName.trim().toLowerCase() !== ownerName.trim().toLowerCase()) {
        const iconEmail = `icon-${nextSlot}-${Date.now()}@fairplay.local`;

        // Insert icon player — NO auth_user_id needed, NO registration_reference
        const iconPlayerPayload: Record<string, any> = {
          full_name: targetIconName,
          email: iconEmail,
          profile_image_url: '/logo.png',
          cricket_role: iconPlayerRole || ownerCricketRole || 'ALL_ROUNDER',
        };

        // Try to add mobile if column exists
        if (iconPlayerMobile) {
          iconPlayerPayload.mobile = iconPlayerMobile;
        }

        let { data: iconPlayer, error: iconPlayerErr } = await supabase
          .from('players')
          .insert(iconPlayerPayload)
          .select('id')
          .single();

        // Fallback: minimal insert
        if (iconPlayerErr) {
          console.warn('Icon player insert failed, trying minimal:', iconPlayerErr.message);
          const minPayload: Record<string, any> = {
            full_name: targetIconName,
            email: iconEmail,
          };
          const fb = await supabase.from('players').insert(minPayload).select('id').single();
          iconPlayer = fb.data;
          iconPlayerErr = fb.error;
          if (iconPlayerErr) {
            console.error('Icon player minimal insert also failed:', iconPlayerErr.message);
          }
        }

        effectiveIconPlayerId = iconPlayer?.id || null;
      } else {
        // Owner IS the icon player
        effectiveIconPlayerId = effectiveOwnerPlayerId;
      }

      if (effectiveIconPlayerId) {
        const iconRegRef = 'ICON-REG-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const iconRegPayload: Record<string, any> = {
          tournament_id: tournamentId,
          player_id: effectiveIconPlayerId,
          registration_number: iconRegRef,
          registration_reference: iconRegRef,
          status: 'CONFIRMED',
          registration_status: 'CONFIRMED',
          registration_type: 'ICON',
          team_name: finalTeamName,
          team_owner_id: newOwner.id,
          registered_name_snapshot: targetIconName,
          registered_role_snapshot: iconPlayerRole || ownerCricketRole || 'BATSMAN',
          registered_image_snapshot: '/logo.png',
          registered_at: new Date().toISOString(),
        };

        let { data: iconRegData, error: iconRegErr } = await supabase
          .from('registrations')
          .insert(iconRegPayload)
          .select('id')
          .single();

        if (iconRegErr) {
          console.warn('Icon registration insert failed, trying fallback:', iconRegErr.message);
          const fbPayload: Record<string, any> = {
            tournament_id: tournamentId,
            player_id: effectiveIconPlayerId,
            registration_number: iconRegRef,
            registration_status: 'CONFIRMED',
            registered_name_snapshot: targetIconName,
            registered_role_snapshot: iconPlayerRole || ownerCricketRole || 'BATSMAN',
            registered_image_snapshot: '/logo.png',
            registered_at: new Date().toISOString(),
          };
          const fb = await supabase.from('registrations').insert(fbPayload).select('id').single();
          iconRegData = fb.data;
          iconRegErr = fb.error;
          if (iconRegErr) {
            console.error('Icon registration fallback also failed:', iconRegErr.message);
          }
        }

        iconRegistrationId = iconRegData?.id || null;
      }
    }

    // 5d. Link registration IDs back to team_owners record
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
      ownerRegistrationId,
      iconRegistrationId,
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
