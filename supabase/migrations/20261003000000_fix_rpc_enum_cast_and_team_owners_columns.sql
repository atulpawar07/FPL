-- Supabase Forward Migration: 20261003000000_fix_rpc_enum_cast_and_team_owners_columns.sql
-- Target: Supabase Postgres DB
-- Application: Cricket Player Registration & Payment Web Application
-- Description: Gate 2C-R2 Fix RPC Enum type casting and align team_owners insert columns

-- ========================================================
-- 1. FIX allocate_player_registration_v2
--    - Explicitly cast v_status to registration_status enum (v_status::registration_status)
--    - Retain all parameters, logic, security, and return types
-- ========================================================

CREATE OR REPLACE FUNCTION allocate_player_registration_v2(
  p_tournament_id UUID,
  p_player_id UUID,
  p_registered_name_snapshot TEXT,
  p_registered_role_snapshot TEXT,
  p_registered_batting_style_snapshot TEXT DEFAULT NULL,
  p_registered_jersey_size_snapshot TEXT DEFAULT NULL,
  p_registered_image_snapshot TEXT DEFAULT NULL,
  p_screenshot_bucket TEXT DEFAULT 'payment-screenshots',
  p_screenshot_object_path TEXT DEFAULT NULL
)
RETURNS TABLE (
  registration_id UUID,
  registration_number TEXT,
  registration_status TEXT,
  waitlist_position INTEGER,
  payment_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_players INT;
  v_registration_fee INT;
  v_waitlist_enabled BOOLEAN;
  v_active_count INT;
  v_waitlist_count INT;
  v_status TEXT;
  v_waitlist_pos INT := NULL;
  v_reg_num TEXT;
  v_reg_id UUID;
  v_pay_id UUID;
  v_reg_open BOOLEAN;
BEGIN
  -- Lock tournament row for concurrency control
  SELECT
    t.max_players,
    t.registration_fee,
    COALESCE(t.waitlist_enabled, true),
    (COALESCE(t.registration_open, true) = true AND (t.registration_end_date IS NULL OR t.registration_end_date > NOW()))
  INTO
    v_max_players,
    v_registration_fee,
    v_waitlist_enabled,
    v_reg_open
  FROM tournaments t
  WHERE t.id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found';
  END IF;

  IF NOT v_reg_open THEN
    RAISE EXCEPTION 'Registration for this tournament is closed';
  END IF;

  -- Count active capacity-consuming registrations (CONFIRMED + PENDING)
  SELECT COUNT(*) INTO v_active_count
  FROM registrations r
  WHERE r.tournament_id = p_tournament_id
    AND r.registration_type = 'PLAYER'
    AND r.registration_status IN ('CONFIRMED', 'PENDING');

  IF v_active_count < v_max_players THEN
    v_status := 'PENDING';
    v_waitlist_pos := NULL;
  ELSE
    IF NOT v_waitlist_enabled THEN
      RAISE EXCEPTION 'Tournament player capacity is full and waitlist is disabled';
    END IF;
    v_status := 'WAITING_LIST';

    SELECT COUNT(*) INTO v_waitlist_count
    FROM registrations r
    WHERE r.tournament_id = p_tournament_id
      AND r.registration_type = 'PLAYER'
      AND r.registration_status = 'WAITING_LIST';

    v_waitlist_pos := COALESCE(v_waitlist_count, 0) + 1;
  END IF;

  -- Generate unique registration number
  v_reg_num := 'REG-' || UPPER(SUBSTRING(p_tournament_id::text, 1, 4)) || '-' || LPAD((v_active_count + COALESCE(v_waitlist_count, 0) + 1)::text, 4, '0');

  -- Insert Registration (Cast v_status to registration_status enum)
  INSERT INTO registrations (
    tournament_id,
    player_id,
    registration_number,
    registration_status,
    registration_type,
    registered_name_snapshot,
    registered_role_snapshot,
    registered_batting_style_snapshot,
    registered_jersey_size_snapshot,
    registered_image_snapshot,
    waitlist_position,
    registered_at,
    updated_at
  ) VALUES (
    p_tournament_id,
    p_player_id,
    v_reg_num,
    v_status::registration_status,
    'PLAYER',
    p_registered_name_snapshot,
    p_registered_role_snapshot,
    COALESCE(p_registered_batting_style_snapshot, 'RIGHT_HAND'),
    COALESCE(p_registered_jersey_size_snapshot, 'M'),
    p_registered_image_snapshot,
    v_waitlist_pos,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_reg_id;

  -- Insert Payment record
  INSERT INTO payments (
    registration_id,
    amount,
    payment_status,
    payment_method,
    screenshot_bucket,
    screenshot_object_path,
    created_at,
    updated_at
  ) VALUES (
    v_reg_id,
    COALESCE(v_registration_fee, 50000),
    'PENDING',
    'UPI_QR',
    p_screenshot_bucket,
    p_screenshot_object_path,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_pay_id;

  RETURN QUERY SELECT v_reg_id, v_reg_num, v_status, v_waitlist_pos, v_pay_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Player already registered for this tournament.';
END;
$$;

-- ========================================================
-- 2. FIX allocate_owner_registration_v3
--    - Align team_owners INSERT columns with actual schema (remove legacy icon_player_* column references)
--    - Explicitly cast registration_status enum when creating Owner and Icon registrations
--    - Retain all Gate 1 / Gate 2A isolation & atomic allocation behavior
-- ========================================================

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
  -- 1. Lock tournament row for update
  SELECT
    t.max_teams,
    t.max_players,
    t.owner_registration_fee,
    t.registration_fee
  INTO
    v_max_teams,
    v_max_players,
    v_owner_fee,
    v_player_fee
  FROM tournaments t
  WHERE t.id = p_tournament_id AND t.tournament_type = 'OWNER_BASED'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Owner-based tournament not found';
  END IF;

  -- 2. Verify Owner Slot Capacity (1 Owner Slot required)
  SELECT COUNT(*) INTO v_current_teams
  FROM team_owners o
  WHERE o.tournament_id = p_tournament_id;

  IF v_current_teams >= v_max_teams THEN
    RAISE EXCEPTION 'All owner slots for this tournament have been filled';
  END IF;

  -- 3. Verify Player Slot Capacity (2 Player Slots required: Owner Player #1 + Icon Player #2)
  SELECT COUNT(*) INTO v_active_players
  FROM registrations r
  WHERE r.tournament_id = p_tournament_id
    AND r.registration_status IN ('CONFIRMED', 'PENDING');

  IF (v_max_players - v_active_players) < 2 THEN
    RAISE EXCEPTION 'Insufficient player slots remaining for Owner + Icon registration (requires 2 player slots)';
  END IF;

  -- 4. Calculate next slot number using MAX(t_owners.slot_number) with explicit table alias
  SELECT COALESCE(MAX(t_owners.slot_number), 0) INTO v_current_teams
  FROM team_owners t_owners
  WHERE t_owners.tournament_id = p_tournament_id;

  v_slot_num := v_current_teams + 1;
  v_total_fee := COALESCE(v_owner_fee, 0) + COALESCE(v_player_fee, 0);

  -- 5. Create Team Owner Record (aligned with current team_owners columns)
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
    NOW(),
    NOW()
  )
  RETURNING id INTO v_owner_id;

  -- 6. Create Owner Registration Record (Owner as Player #1)
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
    'PENDING'::registration_status,
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
  --    ALWAYS creates a NEW tournament-only player. p_icon_existing_player_id is IGNORED.
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
    'PENDING'::registration_status,
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

  -- 10. Create Combined Payment Record
  INSERT INTO payments (
    registration_id,
    team_owner_id,
    amount,
    owner_fee_paise,
    player_fee_paise,
    payment_status,
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
