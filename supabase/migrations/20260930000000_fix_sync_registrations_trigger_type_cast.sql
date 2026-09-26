-- Supabase Migration: 20260930000000_fix_sync_registrations_trigger_type_cast.sql
-- Target: Supabase Postgres DB
-- Description: Fix PostgreSQL type mismatch in sync_registrations_canonical_fields() trigger function

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

  IF NEW.registration_status IS NOT NULL THEN
    NEW.status := NEW.registration_status::text;
  ELSIF NEW.status IS NOT NULL THEN
    IF NEW.status::text IN ('PENDING', 'CONFIRMED', 'WAITING_LIST', 'REJECTED', 'CANCELLED') THEN
      NEW.registration_status := NEW.status;
    ELSE
      RAISE EXCEPTION 'Invalid registration status value: %', NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
