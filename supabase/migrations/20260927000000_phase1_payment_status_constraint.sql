-- Phase 1: Payment Status Constraint
-- The previous migration adds the missing enum values.
-- This migration runs separately so PostgreSQL can safely use them.

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS check_payment_status;

ALTER TABLE payments
  ADD CONSTRAINT check_payment_status
  CHECK (
    payment_status IN (
      'PENDING',
      'SUCCESSFUL',
      'FAILED',
      'REFUNDED',
      'CREATED',
      'PROCESSING',
      'CANCELLED'
    )
  );
