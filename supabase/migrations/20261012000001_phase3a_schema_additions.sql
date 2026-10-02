-- Migration: 20261012000001_phase3a_schema_additions.sql
-- Description: Phase 3A - Schema additions, constraint updates, notifications table, indexes, and RLS.
-- Transaction 2 of 2: Runs after 20261012000000_phase3a_enum_extension.sql has committed.

-- 1. Add Phase 3 correction tracking fields to registrations table
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS admin_remarks TEXT;

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS correction_history JSONB DEFAULT '[]'::jsonb;

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS resubmission_count INTEGER DEFAULT 0;

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS correction_requested_at TIMESTAMPTZ;

-- 2. Update registration status CHECK constraint to allow CORRECTION_REQUESTED
-- Safe casting pattern: registration_status::text IN (...)
ALTER TABLE registrations
  DROP CONSTRAINT IF EXISTS check_registration_status;

ALTER TABLE registrations
  ADD CONSTRAINT check_registration_status
  CHECK (
    registration_status::text IN (
      'PENDING',
      'CONFIRMED',
      'WAITING_LIST',
      'REJECTED',
      'CANCELLED',
      'CORRECTION_REQUESTED'
    )
  );

-- 3. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  registration_id UUID REFERENCES registrations(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create notification indexes for fast user lookup and unread filtering
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(user_id)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_registration_id
  ON notifications(registration_id);

CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON notifications(type);

-- 5. Duplicate-prevention index for active unread correction notifications
-- Note: In PostgreSQL standard unique indexing, NULL != NULL comparison ensures
-- notifications that have a NULL registration_id (e.g. system or tournament-level notices)
-- will not collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_active_correction
  ON notifications(user_id, registration_id, type)
  WHERE read_at IS NULL;

-- 6. Enable Row Level Security (RLS) on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view only their own notifications
DROP POLICY IF EXISTS "Users see own notifications" ON notifications;
CREATE POLICY "Users see own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Note: Client INSERT policy is deliberately omitted.
-- Notifications are created exclusively via server-side service role during admin actions.
