-- Supabase Forward Migration: 20260928000000_phase1_owner_icon_isolation.sql
-- Target: Supabase Postgres DB
-- Application: Cricket Player Registration & Payment Web Application
-- Phase 1 Security Patch: Isolate Owner Icon Registration to prevent unauthorized profile attachment

-- Update allocate_owner_registration_v3 to ALWAYS create a new tournament-only Icon player.
-- This explicitly ignores p_icon_existing_player_id and prevents hijacking of existing profiles.

CREATE OR REPLACE FUNCTION allocate_owner_registration_v3(
  p_tournament_id UUID,
  p_owner_player_id UUID,
  p_owner_name TEXT,
  p_contact_email TEXT,
  p_contact_phone TEXT,
  p_team_name TEXT,
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

  -- 2. Verify Team Capacity (1 Owner Slot required)
  SELECT COUNT(*) INTO v_current_teams
  FROM team_owners
  WHERE tournament_id = p_tournament_id;

  IF v_current_teams >= v_max_teams THEN
    RAISE EXCEPTION 'All owner slots for this tournament have been filled';
  END IF;

  -- 3. Verify Player Capacity (2 Player Slots required: Owner + Icon)
  SELECT COUNT(*) INTO v_active_players
  FROM registrations
  WHERE tournament_id = p_tournament_id
    AND registration_status IN ('CONFIRMED', 'PENDING');

  IF (v_max_players - v_active_players) < 2 THEN
    RAISE EXCEPTION 'Insufficient player slots remaining for Owner + Icon registration (requires 2 player slots)';
  END IF;

  -- Calculate next slot number cleanly using MAX(slot_number) to prevent collisions if intermediate slots were cancelled (F-001 Fix)
  SELECT COALESCE(MAX(slot_number), 0) INTO v_current_teams
  FROM team_owners
  WHERE tournament_id = p_tournament_id;

  v_slot_num := v_current_teams + 1;
  v_total_fee := COALESCE(v_owner_fee, 0) + COALESCE(v_player_fee, 0);

  -- 4. Create Team Owner Record
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

  -- 5. Create Owner Registration Record
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
    'OWNER',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_owner_reg_id;

  -- 6. Create Unclaimed Icon Player Profile
  -- ALWAYS create a new tournament-only player to prevent unauthorized profile attachment
  -- Note: p_icon_existing_player_id is retained in the signature for compatibility but ignored here.

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

  -- 7. Create Icon Registration Record
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
    COALESCE(p_icon_role, 'ICON'),
    p_icon_batting_style,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_icon_reg_id;

  -- 8. Link Registrations back to Team Owner
  UPDATE team_owners
  SET owner_registration_id = v_owner_reg_id,
      icon_registration_id = v_icon_reg_id
  WHERE id = v_owner_id;

  -- 9. Create Combined Payment Record
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
