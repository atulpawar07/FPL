-- Phase 1: Registration Status Constraint
-- REJECTED was added to the enum by the previous migration.
-- This migration runs separately so PostgreSQL can safely use the new enum value.

ALTER TABLE registrations
  DROP CONSTRAINT IF EXISTS check_registration_status;

ALTER TABLE registrations
  ADD CONSTRAINT check_registration_status
  CHECK (
    registration_status IN (
      'PENDING',
      'CONFIRMED',
      'WAITING_LIST',
      'REJECTED',
      'CANCELLED'
    )
  );
