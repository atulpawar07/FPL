-- Supabase Forward Migration: 20261008000000_delete_tournament_rpc.sql
-- Target: Supabase Postgres DB
-- Application: Cricket Player Registration & Payment Web Application
-- Description: Server-side atomic deletion function for tournaments and tournament-specific child records

CREATE OR REPLACE FUNCTION delete_tournament_v1(p_tournament_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament_name TEXT;
  v_reg_ids UUID[];
  v_team_owner_ids UUID[];
  v_deleted_regs INT := 0;
  v_deleted_payments INT := 0;
  v_deleted_owners INT := 0;
BEGIN
  -- 1. Check if tournament exists
  SELECT name INTO v_tournament_name
  FROM tournaments
  WHERE id = p_tournament_id;

  IF v_tournament_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tournament not found',
      'code', 404
    );
  END IF;

  -- 2. Collect registration IDs and team owner IDs for this tournament
  SELECT ARRAY_AGG(id) INTO v_reg_ids
  FROM registrations
  WHERE tournament_id = p_tournament_id;

  SELECT ARRAY_AGG(id) INTO v_team_owner_ids
  FROM team_owners
  WHERE tournament_id = p_tournament_id;

  -- 3. Delete payments linked to these registrations or team owners
  IF v_reg_ids IS NOT NULL AND array_length(v_reg_ids, 1) > 0 THEN
    DELETE FROM payments
    WHERE registration_id = ANY(v_reg_ids);
    GET DIAGNOSTICS v_deleted_payments = ROW_COUNT;
  END IF;

  IF v_team_owner_ids IS NOT NULL AND array_length(v_team_owner_ids, 1) > 0 THEN
    DELETE FROM payments
    WHERE team_owner_id = ANY(v_team_owner_ids);
  END IF;

  -- 4. Delete team owners
  DELETE FROM team_owners
  WHERE tournament_id = p_tournament_id;
  GET DIAGNOSTICS v_deleted_owners = ROW_COUNT;

  -- 5. Delete registrations
  DELETE FROM registrations
  WHERE tournament_id = p_tournament_id;
  GET DIAGNOSTICS v_deleted_regs = ROW_COUNT;

  -- 6. Delete test-only players who only belonged to this deleted tournament and have no remaining registrations
  DELETE FROM players
  WHERE is_tournament_only = true
    AND id NOT IN (SELECT DISTINCT player_id FROM registrations WHERE player_id IS NOT NULL);

  -- 7. Delete the tournament itself
  DELETE FROM tournaments
  WHERE id = p_tournament_id;

  RETURN jsonb_build_object(
    'success', true,
    'tournament_id', p_tournament_id,
    'tournament_name', v_tournament_name,
    'deleted_registrations', v_deleted_regs,
    'deleted_payments', v_deleted_payments,
    'deleted_team_owners', v_deleted_owners
  );
END;
$$;
