-- Supabase Forward Migration: 20261007000000_fix_owner_rpc_registered_image_snapshot.sql
-- Target: Supabase Postgres DB
-- Application: Cricket Player Registration & Payment Web Application
-- Description: Gate 3-R1 STEP 1D Fix allocate_owner_registration_v3 registered_image_snapshot NOT NULL compliance
--
-- Fix 1 (Owner registration):
--   Set registered_image_snapshot = COALESCE(p_owner_image_snapshot, '')
--   to ensure non-null compliance even if owner image is omitted.
--
-- Fix 2 (Icon registration):
--   Add registered_image_snapshot to the INSERT INTO registrations column list
--   and set value = '' to comply with NOT NULL constraint.

-- ========================================================
-- 1. REPAIR allocate_owner_registration_v3
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
  --    Explicit enum casts for cricket_role/batting_style/registration_status; registered_bowling_style_snapshot is TEXT.
  --    registered_image_snapshot uses COALESCE(p_owner_image_snapshot, '') to guarantee NOT NULL compliance.
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
    COALESCE(NULLIF(TRIM(p_owner_role), ''), 'BATSMAN')::cricket_role,
    COALESCE(NULLIF(TRIM(p_owner_batting_style), ''), 'RIGHT_HAND')::batting_style,
    CASE WHEN p_owner_bowling_style IS NOT NULL AND TRIM(p_owner_bowling_style) <> '' THEN TRIM(p_owner_bowling_style) ELSE NULL END,
    COALESCE(NULLIF(TRIM(p_owner_jersey_size), ''), 'M'),
    COALESCE(p_owner_image_snapshot, ''),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_owner_reg_id;

  -- 7. Create Unclaimed Icon Player Profile (Player #2)
  --    ALWAYS creates a NEW tournament-only player. p_icon_existing_player_id is IGNORED.
  --    Aligned with actual remote players schema (no registration_reference column).
  INSERT INTO players (
    full_name,
    mobile,
    is_tournament_only,
    player_type,
    created_at,
    updated_at
  ) VALUES (
    COALESCE(p_icon_name, 'Icon Player'),
    p_icon_mobile,
    true,
    'ICON',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_icon_player_id;

  -- 8. Create Icon Registration Record (Icon as Player #2)
  --    Includes registered_image_snapshot = '' to satisfy NOT NULL constraint.
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
    registered_image_snapshot,
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
    COALESCE(NULLIF(TRIM(p_icon_role), ''), 'BATSMAN')::cricket_role,
    CASE WHEN p_icon_batting_style IS NOT NULL AND TRIM(p_icon_batting_style) <> '' THEN TRIM(p_icon_batting_style)::batting_style ELSE NULL END,
    CASE WHEN p_icon_bowling_style IS NOT NULL AND TRIM(p_icon_bowling_style) <> '' THEN TRIM(p_icon_bowling_style) ELSE NULL END,
    '',
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
