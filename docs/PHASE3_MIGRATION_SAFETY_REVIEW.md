# Phase 3 — Migration Safety Review (Revised v2)

**Document Status**: FINAL PRE-IMPLEMENTATION REVIEW — Revised after Gate Correction
**Date**: October 2, 2026
**Revision**: v2 — corrects rollback model, adds dry-run sequence, adds duplicate-prevention index.

---

## 1. Migration History Risk Assessment

Phase 2 history shows that enum casts and type mismatches caused multiple fix migrations (13-16).
This is the primary risk for Phase 3A.

### Known Failure Pattern (Already Triggered in This Codebase)

When a PostgreSQL enum type is extended with ADD VALUE, the new value cannot be referenced in
the SAME transaction block where it was added. Supabase wraps each migration file in one transaction.

If Phase 3A attempted to:
  1. ADD VALUE 'CORRECTION_REQUESTED'
  2. DROP CONSTRAINT check_registration_status
  3. ADD CONSTRAINT check_registration_status CHECK (...'CORRECTION_REQUESTED'...)

...all in one file, step 3 WILL FAIL with:
  "unsafe use of new value 'CORRECTION_REQUESTED' of enum type registration_status"

This is the exact failure that produced fix migrations 13-16.

---

## 2. Required: Two Migration Files

### File 1 — Enum Extension Only

**Filename**: `2026XXXX000000_phase3a_enum_extension.sql`

```sql
-- TRANSACTION 1
-- Extend enum only. No constraint changes. No column changes.
-- This must commit before File 2 runs.
ALTER TYPE registration_status ADD VALUE IF NOT EXISTS 'CORRECTION_REQUESTED';
NOTIFY pgrst, 'reload schema';
```

### File 2 — Schema Additions, Constraint Update, Notifications Table

**Filename**: `2026XXXX000001_phase3a_schema_additions.sql`
(Timestamp must be strictly later than File 1 — increment final segment by 1)

```sql
-- TRANSACTION 2
-- Safe because CORRECTION_REQUESTED is already committed to the enum.

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS admin_remarks TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS correction_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS resubmission_count INTEGER DEFAULT 0;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS correction_requested_at TIMESTAMPTZ;

-- Drop 5-value constraint and replace with 6-value version.
-- ::text cast is required (matches existing payment_status constraint pattern in migration 20261009).
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS check_registration_status;
ALTER TABLE registrations ADD CONSTRAINT check_registration_status
  CHECK (registration_status::text IN (
    'PENDING',
    'CONFIRMED',
    'WAITING_LIST',
    'REJECTED',
    'CANCELLED',
    'CORRECTION_REQUESTED'
  ));

-- Create notifications table
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

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_registration_id ON notifications(registration_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_see_own_notifications ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- Duplicate prevention: unique partial index on active (unread) correction notifications.
-- Prevents double-notifications when admin double-clicks or client retries.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_active_correction
  ON notifications(user_id, registration_id, type)
  WHERE read_at IS NULL;

NOTIFY pgrst, 'reload schema';
```

---

## 3. CHECK Constraint — Text Cast Pattern

The existing codebase uses ::text cast in payment constraint (migration 20261009):
  CHECK (payment_status::text IN ('PENDING', ...))

Phase 3A MUST use the same pattern:
  CHECK (registration_status::text IN (...))

Do NOT use:
  CHECK (registration_status IN (...))

---

## 4. Notifications Table — RLS and Service Role

- SELECT: governed by RLS policy — users see only their own notifications.
- INSERT: performed server-side using createAdminClient (service_role key bypasses RLS).
- PATCH (mark read): must verify user_id = auth.uid() before update.

This matches how payments and registrations are handled.

---

## 5. Additive-Only Guarantee

| Change | Type | Reversible? |
|:---|:---|:---:|
| ADD VALUE to enum | Additive | NO — but harmless if Phase 3B is not deployed |
| ADD COLUMN IF NOT EXISTS | Additive | YES — DROP COLUMN |
| DROP + ADD CHECK CONSTRAINT | Structural (not data) | YES — restore 5-value constraint |
| CREATE TABLE IF NOT EXISTS | Additive | YES — DROP TABLE IF EXISTS |
| CREATE INDEX IF NOT EXISTS | Additive | YES — DROP INDEX IF EXISTS |
| CREATE UNIQUE INDEX IF NOT EXISTS | Additive | YES — DROP INDEX IF EXISTS |
| CREATE POLICY | Additive | YES — DROP POLICY |

Nothing in Phase 3A removes columns, drops tables, or modifies existing row data.

---

## 6. Migration Rollback Model [REVISED — replaces incorrect v1 section]

### What "Rollback" Means for Phase 3A

PostgreSQL enum ADD VALUE is IRREVERSIBLE. The value CORRECTION_REQUESTED
cannot be removed from the registration_status enum once committed.

DO NOT present "DROP ENUM VALUE" as a rollback operation. It is not possible.

### Correct Rollback Procedures

**Scenario A: File 1 (enum extension) succeeds, File 2 (schema additions) fails mid-way.**

Procedure:
  1. STOP deployment immediately.
  2. The enum value CORRECTION_REQUESTED now exists in the database.
     This is harmless — no rows will reference it, and the application has no
     code path that sets it until Phase 3B is deployed.
  3. Do NOT deploy Phase 3B or any subsequent phase.
  4. Investigate the failure. Create a forward-fix migration to complete
     the schema additions safely.
  5. Existing production rows are completely untouched.

**Scenario B: File 2 succeeds, Phase 3B code deployment fails.**

Procedure:
  1. The schema additions are live (columns + constraint + notifications table).
  2. Existing application code does not reference CORRECTION_REQUESTED.
     All existing API routes continue to function normally.
  3. Roll back the application code deployment via Vercel rollback (not the migration).
  4. No migration rollback is needed.

**Scenario C: Complete Phase 3A rollback of new columns (if columns need to be removed).**

Only execute if explicitly required:
```sql
ALTER TABLE registrations DROP COLUMN IF EXISTS admin_remarks;
ALTER TABLE registrations DROP COLUMN IF EXISTS correction_history;
ALTER TABLE registrations DROP COLUMN IF EXISTS resubmission_count;
ALTER TABLE registrations DROP COLUMN IF EXISTS correction_requested_at;
```

**Scenario D: Rollback notifications table.**
```sql
DROP TABLE IF EXISTS notifications;
```

**Scenario E: Restore 5-value CHECK constraint.**
```sql
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS check_registration_status;
ALTER TABLE registrations ADD CONSTRAINT check_registration_status
  CHECK (registration_status::text IN (
    'PENDING', 'CONFIRMED', 'WAITING_LIST', 'REJECTED', 'CANCELLED'
  ));
```

### Summary of Rollback Constraints

| Object | Rollback Possible? | Method |
|:---|:---:|:---|
| CORRECTION_REQUESTED enum value | NO | Accept it. It is inert without Phase 3B code. |
| admin_remarks column | YES | DROP COLUMN |
| correction_history column | YES | DROP COLUMN |
| resubmission_count column | YES | DROP COLUMN |
| correction_requested_at column | YES | DROP COLUMN |
| notifications table | YES | DROP TABLE IF EXISTS (safe if no data) |
| check_registration_status | YES | DROP + re-add 5-value version |

---

## 7. Migration Dry-Run Sequence [NEW]

This sequence MUST be followed before any production migration is applied.
No production migration until explicitly approved at each gate.

```
Step 1:  Create File 1 (enum extension migration)
         File: supabase/migrations/2026XXXX000000_phase3a_enum_extension.sql

Step 2:  Run local Supabase migration
         Command: supabase db push (local only)
         Expected: migration applies without error

Step 3:  Verify enum value exists locally
         Query: SELECT unnest(enum_range(NULL::registration_status));
         Expected: CORRECTION_REQUESTED appears in results

Step 4:  Create File 2 (schema additions migration)
         File: supabase/migrations/2026XXXX000001_phase3a_schema_additions.sql

Step 5:  Run local Supabase migration
         Command: supabase db push (local only)
         Expected: migration applies without error

Step 6:  Verify CHECK constraint updated
         Query: SELECT pg_get_constraintdef(oid) FROM pg_constraint
                WHERE conname = 'check_registration_status';
         Expected: CORRECTION_REQUESTED present in constraint definition

Step 7:  Verify notifications table exists
         Query: SELECT table_name FROM information_schema.tables
                WHERE table_name = 'notifications';
         Expected: 1 row returned

Step 8:  Verify RLS enabled on notifications
         Query: SELECT rowsecurity FROM pg_tables WHERE tablename = 'notifications';
         Expected: true

Step 9:  Verify unique index exists
         Query: SELECT indexname FROM pg_indexes
                WHERE indexname = 'uq_notifications_active_correction';
         Expected: 1 row returned

Step 10: Verify existing RPCs still work
         Action: POST /api/registrations (test registration flow)
         Action: POST /api/owner-registrations (test owner flow)
         Expected: Both complete without error; no enum cast failures

Step 11: Run full automated tests
         Command: npx vitest run
         Expected: All tests pass

Step 12: TypeScript type check
         Command: npx tsc --noEmit
         Expected: No type errors

Step 13: Production build
         Command: npm run build
         Expected: Build succeeds

Step 14: Review git diff
         Command: git diff --stat
         Expected: Only migration files + src/types/database.ts modified

Step 15: Commit to feature branch
         Message: "Phase 3A: Add CORRECTION_REQUESTED state and notifications table"

Step 16: Push feature branch
         Command: git push origin feature/phase-3a

Step 17: Verify Vercel Preview deployment succeeds
         Check: Preview URL deploys without build errors

Step 18: Browser QA on Preview URL
         - Registration flow works end-to-end
         - Admin approval flow works end-to-end
         - No regressions on existing status badges

ONLY after Step 18 passes: request PR review.
ONLY after PR approved: migrate production via Vercel + Supabase deployment.
NO production migration until these steps are completed.
```

---

## 8. RPC Compatibility Verification

### allocate_player_registration_v2

Casts: `v_status::registration_status` — only sets PENDING or WAITING_LIST.
CORRECTION_REQUESTED is never set by this RPC.
Result: No change needed. Compatible.

### allocate_owner_registration_v4

Same — sets PENDING only.
Result: No change needed. Compatible.

### sync_registrations_canonical_fields trigger

Uses TEXT comparison (NEW.registration_status). No enum cast.
Result: CORRECTION_REQUESTED passes through correctly. Compatible.

---

## 9. Migration Safety Verdict

| Check | Result |
|:---|:---:|
| All changes are additive-only (no data loss) | PASS |
| Enum extension in File 1, constraint update in File 2 | REQUIRED (2 files) |
| ::text cast used in CHECK constraint | REQUIRED |
| RLS on notifications table | REQUIRED |
| Unique partial index for duplicate-notification prevention | REQUIRED |
| Rollback model does not claim DROP ENUM VALUE is possible | PASS |
| Dry-run sequence documented | PASS |
| RPC compatibility verified | PASS |
| Trigger compatibility verified | PASS |
| No data loss risk | PASS |
