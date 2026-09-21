-- Migration: Fix Constraints v4 - Relax NOT NULL constraints for icon/owner player creation
-- Target: Supabase Postgres DB

-- 1. Relax players table constraints so icon/owner players can be inserted without auth_user_id
-- auth_user_id was UNIQUE NOT NULL, but icon players don't have auth accounts
ALTER TABLE players ALTER COLUMN auth_user_id DROP NOT NULL;
ALTER TABLE players ALTER COLUMN profile_image_url DROP NOT NULL;
ALTER TABLE players ALTER COLUMN cricket_role DROP NOT NULL;

-- Drop old UNIQUE constraint on auth_user_id (icon players won't have one)
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_auth_user_id_key;

-- Add a partial unique index that only enforces uniqueness when auth_user_id IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_auth_user_id_unique ON players(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- 2. Add mobile column to players if not exists (needed for icon player records)
ALTER TABLE players ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS player_type TEXT DEFAULT 'REGULAR'; -- REGULAR, OWNER, ICON

-- 3. Add verified_by as TEXT if not exists (admin email reference)
ALTER TABLE payments DROP COLUMN IF EXISTS verified_by;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT;

-- 4. Add status column to registrations (alias for registration_status)
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registration_reference TEXT;

-- Update status from registration_status for existing records
UPDATE registrations SET status = registration_status WHERE status IS NULL;

-- 5. Add updated_at to team_owners
ALTER TABLE team_owners ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 6. Add updated_at to registrations
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ DEFAULT now();

-- 7. Ensure all required columns in payments table exist
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT;

-- 8. Allow service role full access to players, registrations, payments (bypass RLS for admin client)
-- Admin client already uses service role which bypasses RLS

-- 9. Create index on players email for faster lookup
CREATE INDEX IF NOT EXISTS idx_players_email ON players(email) WHERE email IS NOT NULL;

-- 10. Add player_type index
CREATE INDEX IF NOT EXISTS idx_players_player_type ON players(player_type);

-- Notify Supabase to reload schema cache
NOTIFY pgrst, 'reload schema';
