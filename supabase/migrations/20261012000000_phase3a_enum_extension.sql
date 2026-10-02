-- Migration: 20261012000000_phase3a_enum_extension.sql
-- Description: Phase 3A - Isolated registration_status enum extension.
-- Transaction 1 of 2: Must be committed before Phase 3A schema additions and constraints run.

-- Extend registration_status enum to include CORRECTION_REQUESTED
ALTER TYPE registration_status ADD VALUE IF NOT EXISTS 'CORRECTION_REQUESTED';
