-- Migration: Enhance v3 - Multi-tournament types, Manager role, and Atomic Slot Allocation
-- Target: Supabase Postgres DB

-- 1. Create Tournament Type Enum / Columns
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tournament_type_enum') THEN
        CREATE TYPE tournament_type_enum AS ENUM ('OWNER_BASED', 'NON_OWNER_BASED');
    END IF;
END $$;

ALTER TABLE tournaments 
  ADD COLUMN IF NOT EXISTS tournament_type TEXT DEFAULT 'NON_OWNER_BASED',
  ADD COLUMN IF NOT EXISTS max_teams INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS owner_registration_fee INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN DEFAULT true;

-- 2. Create Managers Table
CREATE TABLE IF NOT EXISTS managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  granted_by UUID,
  user_email TEXT NOT NULL UNIQUE,
  user_id UUID,
  display_name TEXT,
  granted_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Index for fast manager lookups
CREATE INDEX IF NOT EXISTS idx_managers_user_email ON managers(user_email) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_managers_user_id ON managers(user_id) WHERE is_active = true;

-- 3. Create Team Owners Table
CREATE TABLE IF NOT EXISTS team_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  slot_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  payment_screenshot_url TEXT,
  registered_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_tournament_owner_slot UNIQUE (tournament_id, slot_number),
  CONSTRAINT unique_tournament_owner_player UNIQUE (tournament_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_team_owners_tournament_id ON team_owners(tournament_id);

-- 4. Helper Functions for RLS and Authorization

-- Function: Check if auth user is the super admin (atulpawar07@gmail.com)
CREATE OR REPLACE FUNCTION is_admin(p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = p_uid AND LOWER(email) = 'atulpawar07@gmail.com'
  );
$$;

-- Function: Check if auth user is a manager or admin
CREATE OR REPLACE FUNCTION is_manager(p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT is_admin(p_uid) OR EXISTS (
    SELECT 1 FROM auth.users u
    JOIN managers m ON LOWER(u.email) = LOWER(m.user_email)
    WHERE u.id = p_uid AND m.is_active = true
  );
$$;

-- 5. RLS Policies Updates

-- Managers Table RLS
ALTER TABLE managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to managers" 
  ON managers FOR ALL 
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can read own manager record" 
  ON managers FOR SELECT 
  USING (
    LOWER(user_email) = (SELECT LOWER(email) FROM auth.users WHERE id = auth.uid())
  );

-- Team Owners Table RLS
ALTER TABLE team_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view team owners" 
  ON team_owners FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated user can register as team owner" 
  ON team_owners FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Manager or Admin can update team owners" 
  ON team_owners FOR UPDATE 
  USING (is_manager(auth.uid()));

-- 6. Atomic Slot Allocation PL/pgSQL Function for Player Registration
CREATE OR REPLACE FUNCTION allocate_registration_slot(
  p_tournament_id UUID,
  p_player_id UUID,
  p_registered_name_snapshot TEXT,
  p_registered_role_snapshot TEXT,
  p_registered_batting_style_snapshot TEXT DEFAULT NULL,
  p_registered_jersey_size_snapshot TEXT DEFAULT NULL,
  p_registered_image_snapshot TEXT DEFAULT NULL
)
RETURNS TABLE (
  registration_id UUID,
  registration_number TEXT,
  registration_status TEXT,
  waitlist_position INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_players INT;
  v_waitlist_enabled BOOLEAN;
  v_confirmed_count INT;
  v_waitlist_count INT;
  v_status TEXT;
  v_waitlist_pos INT := NULL;
  v_reg_num TEXT;
  v_reg_id UUID;
BEGIN
  -- Lock tournament row for concurrency control
  SELECT max_players, COALESCE(waitlist_enabled, true)
  INTO v_max_players, v_waitlist_enabled
  FROM tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found';
  END IF;

  -- Count current confirmed registrations
  SELECT COUNT(*) INTO v_confirmed_count
  FROM registrations
  WHERE tournament_id = p_tournament_id AND registration_status = 'CONFIRMED';

  IF v_confirmed_count < v_max_players THEN
    v_status := 'CONFIRMED';
    v_waitlist_pos := NULL;
  ELSE
    IF NOT v_waitlist_enabled THEN
      RAISE EXCEPTION 'Tournament is full and waitlist is disabled';
    END IF;
    v_status := 'WAITING_LIST';
    
    SELECT COUNT(*) INTO v_waitlist_count
    FROM registrations
    WHERE tournament_id = p_tournament_id AND registration_status = 'WAITING_LIST';
    
    v_waitlist_pos := v_waitlist_count + 1;
  END IF;

  -- Generate registration number
  v_reg_num := 'REG-' || UPPER(SUBSTRING(p_tournament_id::text, 1, 4)) || '-' || LPAD((v_confirmed_count + COALESCE(v_waitlist_count, 0) + 1)::text, 4, '0');

  -- Insert registration
  INSERT INTO registrations (
    tournament_id,
    player_id,
    registration_number,
    registration_status,
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

  RETURN QUERY SELECT v_reg_id, v_reg_num, v_status, v_waitlist_pos;
END;
$$;

-- 7. Atomic Slot Allocation for Team Owners
CREATE OR REPLACE FUNCTION allocate_owner_slot(
  p_tournament_id UUID,
  p_player_id UUID,
  p_owner_name TEXT,
  p_contact_email TEXT,
  p_contact_phone TEXT DEFAULT NULL,
  p_payment_screenshot_url TEXT DEFAULT NULL
)
RETURNS TABLE (
  owner_id UUID,
  slot_number INTEGER,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_teams INT;
  v_current_teams INT;
  v_slot_num INT;
  v_owner_id UUID;
BEGIN
  -- Lock tournament row
  SELECT max_teams
  INTO v_max_teams
  FROM tournaments
  WHERE id = p_tournament_id AND tournament_type = 'OWNER_BASED'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Owner-based tournament not found';
  END IF;

  SELECT COUNT(*) INTO v_current_teams
  FROM team_owners
  WHERE tournament_id = p_tournament_id;

  IF v_current_teams >= v_max_teams THEN
    RAISE EXCEPTION 'All owner slots for this tournament have been filled';
  END IF;

  v_slot_num := v_current_teams + 1;

  INSERT INTO team_owners (
    tournament_id,
    player_id,
    owner_name,
    contact_email,
    contact_phone,
    slot_number,
    status,
    payment_status,
    payment_screenshot_url,
    registered_at
  ) VALUES (
    p_tournament_id,
    p_player_id,
    p_owner_name,
    p_contact_email,
    p_contact_phone,
    v_slot_num,
    'PENDING',
    'PENDING',
    p_payment_screenshot_url,
    NOW()
  )
  RETURNING id INTO v_owner_id;

  RETURN QUERY SELECT v_owner_id, v_slot_num, 'PENDING'::TEXT;
END;
$$;
