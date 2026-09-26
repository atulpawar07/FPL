-- Supabase Forward Migration: 20260929000000_gate2a_owner_as_complete_player.sql
-- Target: Supabase Postgres DB
-- Application: Cricket Player Registration & Payment Web Application
-- Gate 2A: Owner as Complete Player #1
--
-- Changes:
--   1. Extend allocate_owner_registration_v3 signature with complete Owner Player #1 snapshot params.
--   2. Persist Owner Player #1 complete snapshot columns into registrations:
--        registered_role_snapshot        -> owner's actual cricket role (not literal 'OWNER')
--        registered_batting_style_snapshot
--        registered_bowling_style_snapshot (new column added below)
--        registered_jersey_size_snapshot
--        registered_image_snapshot
--   3. Add registered_bowling_style_snapshot column to registrations (IF NOT EXISTS).
--   4. Owner tournament snapshot is INDEPENDENT of the reusable player profile.
--      Snapshot values are taken from submitted parameters, not from the players table.
--   5. Icon isolation from Gate 1 (20260928000000) remains FULLY intact.
--      p_icon_existing_player_id is retained in signature but ALWAYS IGNORED.
--   6. F-001 fix (COALESCE(MAX(slot_number), 0) + 1) remains FULLY intact.
--   7. Atomic 2-player-slot + 1-owner-slot capacity check remains FULLY intact.

-- -------------------------------------------------------
-- Step 1: Add registered_bowling_style_snapshot column to
--         registrations if it does not already exist.
-- -------------------------------------------------------
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS registered_bowling_style_snapshot TEXT;

-- -------------------------------------------------------
-- Step 2: Replace allocate_owner_registration_v3 with the
--         updated version accepting and persisting complete
--         Owner Player #1 snapshot fields.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION allocate_owner_registration_v3(
  p_tournament_id UUID,
  p_owner_player_id UUID,
  p_owner_name TEXT,
  p_contact_email TEXT,
  p_contact_phone TEXT,
  p_team_name TEXT,
  p_owner_role TEXT DEFAULT 'BATSMAN',
  p_owner_batting_style TEXT DEFAULT 'RIGHT_HAND',
  p_owner_bowling_style TEXT DEFAULT NULL,
  p_owner_jersey_size TEXT DEFAULT 'M',
  p_owner_image_snapshot TEXT DEFAULT NULL,
  p_team_logo_url TEXT DEFAULT NULL,
  p_screenshot_bucket TEXT DEFAULT 'payment-screenshots',
  p_screenshot_object_path TEXT DEFAULT NULL,
  p_icon_name TEXT DEFAULT NULL,
  p_icon_mobile TEXT DEFAULT NULL,
  p_icon_role TEXT DEFAULT NULL,
  p_icon_batting_style TEXT DEFAULT NULL,
  p_icon_bowling_style TEXT DEFAULT NULL,
  p_icon_existing_player_id UUID DEFAULT NULL
)
RETURNS TABLE (
  owner_id UUID,
  slot_number INTEGER,
  owner_registration_id UUID,
  icon_registration_id UUID,
  payment_id UUID,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_teams INT;
  v_max_players INT;
  v_owner_fee INT;
  v_player_fee INT;
  v_total_fee INT;
  v_current_teams INT;
  v_active_players INT;
  v_slot_num INT;
  v_owner_id UUID;
  v_owner_reg_id UUID;
  v_icon_player_id UUID;
  v_icon_reg_id UUID;
  v_pay_id UUID;
  v_owner_reg_num TEXT;
  v_icon_reg_num TEXT;
BEGIN
  -- 1. Lock tournament row for update (prevents concurrent over-allocation)
  SELECT
    max_teams,
    max_players,
    owner_registration_fee,
    registration_fee
  INTO
    v_max_teams,
    v_max_players,
    v_owner_fee,
    v_player_fee
  FROM tournaments
  WHERE id = p_tournament_id AND tournament_type = 'OWNER_BASED'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Owner-based tournament not found';
  END IF;

  -- 2. Verify Owner Slot Capacity (1 Owner Slot required)
  SELECT COUNT(*) INTO v_current_teams
  FROM team_owners
  WHERE tournament_id = p_tournament_id;

  IF v_current_teams >= v_max_teams THEN
    RAISE EXCEPTION 'All owner slots for this tournament have been filled';
  END IF;

  -- 3. Verify Player Slot Capacity (2 Player Slots required: Owner Player #1 + Icon Player #2)
  SELECT COUNT(*) INTO v_active_players
  FROM registrations
  WHERE tournament_id = p_tournament_id
    AND registration_status IN ('CONFIRMED', 'PENDING');

  IF (v_max_players - v_active_players) < 2 THEN
    RAISE EXCEPTION 'Insufficient player slots remaining for Owner + Icon registration (requires 2 player slots)';
  END IF;

  -- 4. F-001 fix: Calculate next slot number using MAX(slot_number)
  SELECT COALESCE(MAX(slot_number), 0) INTO v_current_teams
  FROM team_owners
  WHERE tournament_id = p_tournament_id;

  v_slot_num := v_current_teams + 1;
  v_total_fee := COALESCE(v_owner_fee, 0) + COALESCE(v_player_fee, 0);

  -- 5. Create Team Owner Record
  INSERT INTO team_owners (
    tournament_id,
    player_id,
    owner_name,
    contact_email,
    contact_phone,
    team_name,
    team_logo_url,
    slot_number,
    status,
    payment_status,
    icon_player_name,
    icon_player_mobile,
    icon_player_role,
    icon_player_batting_style,
    icon_player_bowling_style,
    registered_at,
    updated_at
  ) VALUES (
    p_tournament_id,
    p_owner_player_id,
    p_owner_name,
    p_contact_email,
    p_contact_phone,
    p_team_name,
    p_team_logo_url,
    v_slot_num,
    'PENDING',
    'PENDING',
    p_icon_name,
    p_icon_mobile,
    p_icon_role,
    p_icon_batting_style,
    p_icon_bowling_style,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_owner_id;

  -- 6. Create Owner Registration Record (Owner as Player #1)
  --    Snapshot is INDEPENDENT of the reusable player profile.
  --    Changing the reusable profile later does NOT alter this historical snapshot.
  v_owner_reg_num := 'OWNER-' || UPPER(SUBSTRING(p_tournament_id::text, 1, 4)) || '-' || LPAD(v_slot_num::text, 3, '0');

  INSERT INTO registrations (
    tournament_id,
    player_id,
    registration_number,
    registration_status,
    registration_type,
    team_name,
    team_owner_id,
    registered_name_snapshot,
    registered_role_snapshot,
    registered_batting_style_snapshot,
    registered_bowling_style_snapshot,
    registered_jersey_size_snapshot,
    registered_image_snapshot,
    registered_at,
    updated_at
  ) VALUES (
    p_tournament_id,
    p_owner_player_id,
    v_owner_reg_num,
    'PENDING',
    'OWNER',
    p_team_name,
    v_owner_id,
    p_owner_name,
    COALESCE(NULLIF(TRIM(p_owner_role), ''), 'BATSMAN'),
    COALESCE(NULLIF(TRIM(p_owner_batting_style), ''), 'RIGHT_HAND'),
    p_owner_bowling_style,
    COALESCE(NULLIF(TRIM(p_owner_jersey_size), ''), 'M'),
    p_owner_image_snapshot,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_owner_reg_id;

  -- 7. Create Unclaimed Icon Player Profile (Player #2)
  --    ALWAYS creates a NEW tournament-only player.
  --    p_icon_existing_player_id is ALWAYS IGNORED (Gate 1 isolation preserved).
  INSERT INTO players (
    registration_reference,
    full_name,
    mobile,
    is_tournament_only,
    player_type,
    created_at,
    updated_at
  ) VALUES (
    'ICON-REF-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8)),
    COALESCE(p_icon_name, 'Icon Player'),
    p_icon_mobile,
    true,
    'ICON',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_icon_player_id;

  -- 8. Create Icon Registration Record (Icon as Player #2)
  v_icon_reg_num := 'ICON-' || UPPER(SUBSTRING(p_tournament_id::text, 1, 4)) || '-' || LPAD(v_slot_num::text, 3, '0');

  INSERT INTO registrations (
    tournament_id,
    player_id,
    registration_number,
    registration_status,
    registration_type,
    team_name,
    team_owner_id,
    registered_name_snapshot,
    registered_role_snapshot,
    registered_batting_style_snapshot,
    registered_bowling_style_snapshot,
    registered_at,
    updated_at
  ) VALUES (
    p_tournament_id,
    v_icon_player_id,
    v_icon_reg_num,
    'PENDING',
    'ICON',
    p_team_name,
    v_owner_id,
    COALESCE(p_icon_name, 'Icon Player'),
    COALESCE(p_icon_role, 'BATSMAN'),
    p_icon_batting_style,
    p_icon_bowling_style,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_icon_reg_id;

  -- 9. Link both Registrations back to Team Owner record
  UPDATE team_owners
  SET owner_registration_id = v_owner_reg_id,
      icon_registration_id = v_icon_reg_id
  WHERE id = v_owner_id;

  -- 10. Create Combined Payment Record (Owner Fee + Player Fee)
  INSERT INTO payments (
    registration_id,
    team_owner_id,
    amount,
    owner_fee_paise,
    player_fee_paise,
    status,
    order_id,
    screenshot_bucket,
    screenshot_object_path,
    created_at,
    updated_at
  ) VALUES (
    v_owner_reg_id,
    v_owner_id,
    v_total_fee,
    COALESCE(v_owner_fee, 0),
    COALESCE(v_player_fee, 0),
    'PENDING',
    'ORD-OWNER-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8)),
    p_screenshot_bucket,
    p_screenshot_object_path,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_pay_id;

  RETURN QUERY SELECT v_owner_id, v_slot_num, v_owner_reg_id, v_icon_reg_id, v_pay_id, 'PENDING'::TEXT;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Owner slot or registration conflict for this tournament.';
END;
$$;

-- Notify PostgREST schema reload
NOTIFY pgrst, 'reload schema';
