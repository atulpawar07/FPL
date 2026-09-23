-- Supabase Migration: 20260924000000_phase1_canonical_foundation.sql
-- Target: Supabase Postgres DB
-- Application: Cricket Player Registration & Payment Web Application
-- Phase 1 Foundation: Security, Canonical Schema, Atomic Registration & Capacity Allocation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. DATABASE-BACKED AUTHORIZATION HELPERS
-- ==========================================

-- Admin Users Table Setup (if not already existing)
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'TOURNAMENT_ADMIN',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Initial Super Admin for Bootstrap Email (atulpawar07@gmail.com) if present in auth.users
DO $$
DECLARE
    v_bootstrap_id UUID;
BEGIN
    SELECT id INTO v_bootstrap_id FROM auth.users WHERE LOWER(email) = 'atulpawar07@gmail.com' LIMIT 1;
    IF v_bootstrap_id IS NOT NULL THEN
        INSERT INTO admin_users (id, name, email, role, status, created_at, updated_at)
        VALUES (v_bootstrap_id, 'Super Admin', 'atulpawar07@gmail.com', 'SUPER_ADMIN', 'ACTIVE', NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET role = 'SUPER_ADMIN', status = 'ACTIVE';
    END IF;
END $$;

-- Database-Backed Admin Checker
CREATE OR REPLACE FUNCTION is_admin(p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE id = p_uid AND status = 'ACTIVE'
  ) OR EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = p_uid AND LOWER(email) = 'atulpawar07@gmail.com'
  );
$$;

-- Database-Backed Manager Checker
CREATE OR REPLACE FUNCTION is_manager(p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT is_admin(p_uid) OR EXISTS (
    SELECT 1 FROM auth.users u
    JOIN managers m ON LOWER(u.email) = LOWER(m.user_email)
    WHERE u.id = p_uid AND m.is_active = true
  );
$$;

-- ==========================================
-- 2. CANONICAL SCHEMA & FIELD STANDARDIZATIONS
-- ==========================================

-- Players Table Enhancements
ALTER TABLE players ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_tournament_only BOOLEAN DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS player_type TEXT DEFAULT 'REGULAR';
ALTER TABLE players ALTER COLUMN auth_user_id DROP NOT NULL;
ALTER TABLE players ALTER COLUMN email DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_auth_user_id_unique 
  ON players(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_mobile 
  ON players(mobile) WHERE mobile IS NOT NULL;

-- Registrations Table Canonicalization
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registration_number TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registration_status TEXT DEFAULT 'PENDING';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registration_type TEXT DEFAULT 'PLAYER';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS team_name TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS team_owner_id UUID;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS waitlist_position INTEGER;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registered_name_snapshot TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registered_role_snapshot TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registered_batting_style_snapshot TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registered_jersey_size_snapshot TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registered_image_snapshot TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ DEFAULT NOW();

-- Legacy Column Compatibility Triggers (canonical <-> legacy)
CREATE OR REPLACE FUNCTION sync_registrations_canonical_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.registration_number IS NOT NULL AND (NEW.registration_reference IS NULL OR NEW.registration_reference != NEW.registration_number) THEN
    NEW.registration_reference := NEW.registration_number;
  ELSIF NEW.registration_reference IS NOT NULL AND NEW.registration_number IS NULL THEN
    NEW.registration_number := NEW.registration_reference;
  END IF;

  IF NEW.registration_status IS NOT NULL AND (NEW.status IS NULL OR NEW.status != NEW.registration_status) THEN
    NEW.status := NEW.registration_status;
  ELSIF NEW.status IS NOT NULL AND NEW.registration_status IS NULL THEN
    NEW.registration_status := NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_registrations_canonical ON registrations;
CREATE TRIGGER trg_sync_registrations_canonical
  BEFORE INSERT OR UPDATE ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION sync_registrations_canonical_fields();

-- Populate existing canonical values
UPDATE registrations 
SET registration_number = COALESCE(registration_number, registration_reference, 'REG-' || id::text),
    registration_status = COALESCE(registration_status, status, 'PENDING')
WHERE registration_number IS NULL OR registration_status IS NULL;

-- Payments Table Enhancements & Storage Object Reference Model
ALTER TABLE payments ADD COLUMN IF NOT EXISTS screenshot_bucket TEXT DEFAULT 'payment-screenshots';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS screenshot_object_path TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS owner_fee_paise BIGINT DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS player_fee_paise BIGINT DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS team_owner_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Backfill total amount logic if missing
UPDATE payments SET owner_fee_paise = 0, player_fee_paise = amount WHERE owner_fee_paise IS NULL OR owner_fee_paise = 0;

-- Audit Logs Foreign Key Protection
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_admin_user_id_fkey;
ALTER TABLE audit_logs 
  ADD CONSTRAINT audit_logs_admin_user_id_fkey 
  FOREIGN KEY (admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ==========================================
-- 3. DATA INTEGRITY CONSTRAINTS
-- ==========================================

-- Team Owners Slot Uniqueness
ALTER TABLE team_owners DROP CONSTRAINT IF EXISTS unique_tournament_owner_slot;
ALTER TABLE team_owners 
  ADD CONSTRAINT unique_tournament_owner_slot UNIQUE (tournament_id, slot_number);

-- Player Multi-Role Eligibility (DR-039 Option B: Unique per tournament, player, and role type)
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS unique_player_tournament;
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS unique_player_role_per_tournament;
ALTER TABLE registrations 
  ADD CONSTRAINT unique_player_role_per_tournament UNIQUE (tournament_id, player_id, registration_type);

-- Registration Type Check
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS check_registration_type;
ALTER TABLE registrations 
  ADD CONSTRAINT check_registration_type CHECK (registration_type IN ('PLAYER', 'OWNER', 'ICON'));

-- Registration Status Check (5 Canonical States)
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS check_registration_status;
ALTER TABLE registrations 
  ADD CONSTRAINT check_registration_status CHECK (registration_status IN ('PENDING', 'CONFIRMED', 'WAITING_LIST', 'REJECTED', 'CANCELLED'));

-- Payment Status Check
ALTER TABLE payments DROP CONSTRAINT IF EXISTS check_payment_status;
ALTER TABLE payments 
  ADD CONSTRAINT check_payment_status CHECK (status IN ('PENDING', 'SUCCESSFUL', 'FAILED', 'REFUNDED', 'CREATED', 'PROCESSING', 'CANCELLED'));

-- Payment Fee Snapshot Check
ALTER TABLE payments DROP CONSTRAINT IF EXISTS check_combined_fee_breakdown;
ALTER TABLE payments 
  ADD CONSTRAINT check_combined_fee_breakdown CHECK (amount >= 0 AND amount = (owner_fee_paise + player_fee_paise));

-- FK Relationships
ALTER TABLE team_owners DROP CONSTRAINT IF EXISTS fk_team_owners_owner_reg;
ALTER TABLE team_owners 
  ADD CONSTRAINT fk_team_owners_owner_reg 
  FOREIGN KEY (owner_registration_id) REFERENCES registrations(id) ON DELETE SET NULL;

ALTER TABLE team_owners DROP CONSTRAINT IF EXISTS fk_team_owners_icon_reg;
ALTER TABLE team_owners 
  ADD CONSTRAINT fk_team_owners_icon_reg 
  FOREIGN KEY (icon_registration_id) REFERENCES registrations(id) ON DELETE SET NULL;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS fk_payments_team_owner;
ALTER TABLE payments 
  ADD CONSTRAINT fk_payments_team_owner 
  FOREIGN KEY (team_owner_id) REFERENCES team_owners(id) ON DELETE CASCADE;

-- ==========================================
-- 4. PUBLIC TEAM DATA VS PRIVATE OWNER DATA
-- ==========================================

-- Create Public-Safe View for Teams
CREATE OR REPLACE VIEW public_teams_view AS
SELECT 
  id,
  tournament_id,
  team_name,
  team_logo_url,
  slot_number,
  status
FROM team_owners
WHERE status IN ('APPROVED', 'CONFIRMED', 'PENDING');

GRANT SELECT ON public_teams_view TO anon, authenticated;

-- ==========================================
-- 5. ATOMIC REGISTRATION RPC FUNCTIONS
-- ==========================================

-- 5.1 Atomic Normal Player Registration RPC (allocate_player_registration_v2)
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
    max_players, 
    registration_fee, 
    COALESCE(waitlist_enabled, true),
    (status = 'REGISTRATION_OPEN' OR registration_end_date IS NULL OR registration_end_date > NOW())
  INTO 
    v_max_players, 
    v_registration_fee, 
    v_waitlist_enabled,
    v_reg_open
  FROM tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found';
  END IF;

  IF NOT v_reg_open THEN
    RAISE EXCEPTION 'Registration for this tournament is closed';
  END IF;

  -- Count active capacity-consuming registrations (CONFIRMED + PENDING)
  SELECT COUNT(*) INTO v_active_count
  FROM registrations
  WHERE tournament_id = p_tournament_id 
    AND registration_type = 'PLAYER'
    AND registration_status IN ('CONFIRMED', 'PENDING');

  IF v_active_count < v_max_players THEN
    v_status := 'PENDING';
    v_waitlist_pos := NULL;
  ELSE
    IF NOT v_waitlist_enabled THEN
      RAISE EXCEPTION 'Tournament player capacity is full and waitlist is disabled';
    END IF;
    v_status := 'WAITING_LIST';
    
    SELECT COUNT(*) INTO v_waitlist_count
    FROM registrations
    WHERE tournament_id = p_tournament_id 
      AND registration_type = 'PLAYER'
      AND registration_status = 'WAITING_LIST';
    
    v_waitlist_pos := COALESCE(v_waitlist_count, 0) + 1;
  END IF;

  -- Generate unique registration number
  v_reg_num := 'REG-' || UPPER(SUBSTRING(p_tournament_id::text, 1, 4)) || '-' || LPAD((v_active_count + COALESCE(v_waitlist_count, 0) + 1)::text, 4, '0');

  -- Insert Registration
  INSERT INTO registrations (
    tournament_id,
    player_id,
    registration_number,
    registration_status,
    registration_type,
    waitlist_position,
    registered_name_snapshot,
    registered_role_snapshot,
    registered_batting_style_snapshot,
    registered_jersey_size_snapshot,
    registered_image_snapshot,
    registered_at,
    updated_at
  ) VALUES (
    p_tournament_id,
    p_player_id,
    v_reg_num,
    v_status,
    'PLAYER',
    v_waitlist_pos,
    p_registered_name_snapshot,
    p_registered_role_snapshot,
    p_registered_batting_style_snapshot,
    p_registered_jersey_size_snapshot,
    p_registered_image_snapshot,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_reg_id;

  -- Insert Payment record
  INSERT INTO payments (
    registration_id,
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
    v_reg_id,
    v_registration_fee,
    0,
    v_registration_fee,
    'PENDING',
    'ORD-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8)),
    p_screenshot_bucket,
    p_screenshot_object_path,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_pay_id;

  RETURN QUERY SELECT v_reg_id, v_reg_num, v_status, v_waitlist_pos, v_pay_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Player is already registered for this tournament under the PLAYER role.';
END;
$$;

-- 5.2 Atomic Owner + Icon Registration RPC (allocate_owner_registration_v3)
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

  -- Calculate slot number & fees
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

  -- 6. Resolve Icon Player Profile
  IF p_icon_existing_player_id IS NOT NULL THEN
    v_icon_player_id := p_icon_existing_player_id;
  ELSIF p_icon_mobile IS NOT NULL THEN
    SELECT id INTO v_icon_player_id FROM players WHERE mobile = p_icon_mobile LIMIT 1;
  END IF;

  IF v_icon_player_id IS NULL AND p_icon_name IS NOT NULL THEN
    -- Insert tournament-only Icon record (auth_user_id = NULL, email = NULL)
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
      p_icon_name,
      p_icon_mobile,
      true,
      'ICON',
      NOW(),
      NOW()
    )
    RETURNING id INTO v_icon_player_id;
  END IF;

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
