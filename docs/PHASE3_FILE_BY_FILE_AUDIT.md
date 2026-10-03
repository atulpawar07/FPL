# Phase 3 — File-by-File Audit (Revised v2)

**Document Status**: FINAL PRE-IMPLEMENTATION AUDIT — Revised after Gate Correction
**Date**: October 2, 2026
**Revision**: v2 — corrects atomicity, authorization, field matrix, Owner/Icon isolation, duplicate safety, rollback model, and dry-run plan.

> This document inventories every source file, API route, and migration relevant to Phase 3.
> Changes from v1 are marked [REVISED].

---

## Legend

| Symbol | Meaning |
|:---:|:---|
| OK | No changes required — compatible as-is |
| MOD | Phase 3 will MODIFY this file |
| NEW | Phase 3 will CREATE this file |
| GAP | Gap / Risk identified |

---

## SECTION 1 — Database Migrations (22 Total)

| # | Migration File | Phase 3 Impact |
|:--|:---|:---|
| 1-6 | init through phase1_f001 | No impact — legacy foundation |
| 7 | 20260926_phase1_registration_status_constraint.sql | CRITICAL GAP: CHECK constraint only allows 5 values. CORRECTION_REQUESTED not included. Phase 3A MUST drop and recreate this constraint in a separate migration file from the enum extension. |
| 8-22 | Subsequent migrations | No impact — Phase 2 complete and stable |

### Phase 3A: TWO Migration Files Required [REVISED]

Reason: PostgreSQL cannot reference a newly-added enum value within the same transaction as ADD VALUE.
This codebase already triggered this failure pattern (fix migrations 13-16 exist because of it).

**File 1 — Enum Extension Only**
Filename: `2026XXXX000000_phase3a_enum_extension.sql`

```sql
-- TRANSACTION 1: Extend enum only. No constraint changes. No column changes.
ALTER TYPE registration_status ADD VALUE IF NOT EXISTS 'CORRECTION_REQUESTED';
NOTIFY pgrst, 'reload schema';
```

**File 2 — Schema Additions + Constraint Update**
Filename: `2026XXXX000001_phase3a_schema_additions.sql`
(Timestamp must be strictly later than File 1)

```sql
-- TRANSACTION 2: Safe because enum extension is committed in prior migration.

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS admin_remarks TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS correction_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS resubmission_count INTEGER DEFAULT 0;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS correction_requested_at TIMESTAMPTZ;

-- Drop old 5-value constraint and replace with 6-value version.
-- Use ::text cast (matches existing payment_status constraint pattern).
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

NOTIFY pgrst, 'reload schema';
```

---

## SECTION 2 — API Route Audit

### Routes Unchanged

| Route | File |
|:---|:---|
| POST /api/registrations | src/app/api/registrations/route.ts |
| POST /api/registrations/[id]/screenshot | (unchanged) |
| DELETE /api/admin/registrations/[id] | (unchanged) |
| GET/POST /api/players/profile | (unchanged) |
| GET/POST /api/admin/managers | (unchanged) |

### Routes With Gaps

| Route | File | Gap | Phase |
|:---|:---|:---|:---:|
| GET /api/registrations/[id] | registrations/[id]/route.ts | Does NOT return admin_remarks, correction_requested_at, resubmission_count, created_by_auth_id. Fallback (lines 28-54) returns fake data — must not run in edit mode. | 3C |
| PATCH /api/registrations/[id] | registrations/[id]/route.ts | Does NOT EXIST. IDOR risk: must validate created_by_auth_id = auth.uid() AND registration_status = CORRECTION_REQUESTED. | 3C |
| POST /api/admin/registrations/[id]/approve | approve/route.ts | Missing REQUEST_CORRECTION branch. Must be ATOMIC — see atomicity design below. | 3B |
| GET /api/admin/tournament/[id]/summary | summary/route.ts | pendingCount does not include CORRECTION_REQUESTED. | 3B |
| GET /api/admin/dashboard | dashboard/route.ts | correctionRequestedCount missing from stats. | 3B (LOW) |

### New Routes to Create

| Route | File | Phase |
|:---|:---|:---:|
| GET /api/notifications | src/app/api/notifications/route.ts | 3D |
| PATCH /api/notifications/[id]/read | src/app/api/notifications/[id]/read/route.ts | 3D |

---

## SECTION 3 — Atomicity Design for REQUEST_CORRECTION [REVISED]

### Current (Rejected) Design

Phase 3B initially specified: "If notification INSERT fails, use try-catch — correction state takes priority."
This is NOT acceptable per the gate correction.

### Required Atomic Design

The REQUEST_CORRECTION action MUST be fully atomic:

```
BEGIN TRANSACTION
  1. Validate manager/admin authorization (requireManager)
  2. Fetch registration (lock row: SELECT ... FOR UPDATE)
  3. Validate registration is in a correctable state
     (PENDING | WAITING_LIST — not already CORRECTION_REQUESTED, CONFIRMED, REJECTED, CANCELLED)
  4. Validate admin_remarks is non-empty (server-side, min 1 char after trim)
  5. Archive existing admin_remarks into correction_history (append to JSONB array):
     { remark, requested_at, requested_by_email }
  6. UPDATE registrations:
     registration_status = 'CORRECTION_REQUESTED'
     admin_remarks = trimmed remark
     correction_requested_at = NOW()
     resubmission_count unchanged
  7. INSERT into notifications:
     user_id = registration.created_by_auth_id (see multi-person section)
     type = 'CORRECTION_REQUIRED'
     title = 'Action Required: Correction Requested'
     message = 'Admin remark: {admin_remarks} — {tournament_name}'
     registration_id = registrationId
     tournament_id = registration.tournament_id
  8. INSERT into audit_logs via logAdminAction:
     action = 'REQUEST_REGISTRATION_CORRECTION'
     entityType = 'REGISTRATION'
     entityId = registrationId
     oldValue = { registration_status: previous_status }
     newValue = { registration_status: 'CORRECTION_REQUESTED', admin_remarks: remark }
COMMIT — only if ALL of steps 1-8 succeed

ROLLBACK — if ANY of steps 5-8 fail
```

### Implementation Strategy

Server-side transaction management in Next.js API routes cannot use BEGIN/COMMIT directly via the Supabase JS client. Options in priority order:

**Option A (Preferred): Supabase RPC for the correction action**
Create a PostgreSQL function `request_registration_correction(p_registration_id, p_admin_remarks, p_admin_user_id)` that performs steps 5-8 atomically in a single PL/pgSQL function with SECURITY DEFINER. The API route calls this RPC. If any step fails, PostgreSQL rolls back automatically.

**Option B (Acceptable fallback): Sequential operations with compensation**
If Option A is too complex for Phase 3 timeline:
- Perform steps in order: UPDATE registrations → INSERT notifications → INSERT audit_logs.
- Wrap all three in a try-catch.
- If any step throws, manually REVERT the registration status update:
  ```
  UPDATE registrations SET registration_status = original_status WHERE id = registrationId
  ```
- Return 500 to the caller.
- Log the compensation action.

NOTE: Option B has a narrow failure window (if compensation also fails), but is acceptable because the fallback state (registration stuck in wrong status) is detectable and correctable by admin.

The implementation plan documents MUST specify which option is chosen and implement it consistently.

### Failure Behavior

| Failure Point | Behavior |
|:---|:---|
| Authorization fails | 403 returned. No DB changes. |
| Registration not found | 404 returned. No DB changes. |
| Invalid state (already CONFIRMED etc.) | 400 returned. No DB changes. |
| Empty admin_remarks | 400 returned. No DB changes. |
| Registration UPDATE fails | 500 returned. No DB changes. |
| Notification INSERT fails | ROLLBACK / compensate. Registration reverts to previous status. 500 returned. |
| Audit log INSERT fails | ROLLBACK / compensate. Registration reverts to previous status. 500 returned. |

### Retry Behavior

The API is idempotent-safe: if the client retries after a network timeout, duplicate-notification prevention (see below) prevents double-notifications. The registration status guard prevents re-requesting correction on already-CORRECTION_REQUESTED rows.

### Duplicate Notification Prevention

| Scenario | Handling |
|:---|:---|
| Admin double-clicks Request Correction | Second request: registration is now CORRECTION_REQUESTED. State validation rejects with 400 (cannot request correction on CORRECTION_REQUESTED row). No duplicate notification. |
| Network response lost, client retries | Same as above — state guard prevents duplicate. |
| Admin requests correction, user resubmits, admin requests again | Registration status returns to PENDING after resubmission. Second correction request is valid and creates a new notification. This is intended behavior (multiple correction cycles). |
| User has unread prior correction notification | New notification is inserted. Old notification remains unread. User sees both in notification list. This is acceptable and informative. |

NOTE: To prevent duplicate notifications for the same correction cycle (admin requests correction before user reads the first notification), the implementation SHOULD check for an existing unread CORRECTION_REQUIRED notification for the same registration_id before inserting. If one exists, update its message and updated_at instead of inserting a new row.

```sql
-- Preferred: upsert on (user_id, registration_id, type) where read_at IS NULL
INSERT INTO notifications (user_id, type, title, message, registration_id, tournament_id)
VALUES (...)
ON CONFLICT ON CONSTRAINT uq_notifications_active_correction
DO UPDATE SET message = EXCLUDED.message, updated_at = NOW();
```

Add unique partial index:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_active_correction
  ON notifications(user_id, registration_id, type)
  WHERE read_at IS NULL;
```

This constraint must be added in Phase 3A-Part2 migration.

---

## SECTION 4 — Multi-Person Authorization Model [REVISED]

### Invariant

```
registrations.created_by_auth_id = the auth.users.id of the account that submitted the registration.
registrations.player_id = the participants record (may not have an auth.users account).
```

These are DIFFERENT for "register someone else" flows.

### Example

User A (auth_user_id = uuid-A) registers:
- Themselves (player_id = player-A, created_by_auth_id = uuid-A)
- User B (player_id = player-B, created_by_auth_id = uuid-A)
- User C (player_id = player-C, created_by_auth_id = uuid-A)

For ALL three registrations:
- Correction notification target → uuid-A (NOT player-B's auth_user_id, NOT player-C's auth_user_id)
- PATCH /api/registrations/[id] authorization → uuid-A (verify created_by_auth_id = auth.uid() = uuid-A)
- Resubmission actor → uuid-A
- History visibility → uuid-A

### Legacy NULL created_by_auth_id Behavior

Registrations created before Phase 2 (migration 20261009) have created_by_auth_id = NULL.

| Situation | Behavior |
|:---|:---|
| Admin requests correction on legacy registration | Notification INSERT is skipped (user_id cannot be NULL). Audit log is still written. Registration status is still set to CORRECTION_REQUESTED. A warning is logged server-side: "No notification sent: created_by_auth_id is NULL for registration {id}". |
| User tries to PATCH a legacy registration | PATCH endpoint must return 403 with message: "This registration was created before the correction system was enabled and cannot be resubmitted online. Please contact the tournament admin." |

---

## SECTION 5 — Correction Field Matrix [REVISED]

All registration fields classified for editability in the CORRECTION_REQUESTED state.

| Field | Player Reg | Owner Reg | Icon Reg | Editable After Correction | Payment Recheck Required |
|:---|:---:|:---:|:---:|:---:|:---:|
| registered_name_snapshot | YES | YES | YES | YES | NO |
| registered_role_snapshot | YES | YES | YES | YES | NO |
| registered_batting_style_snapshot | YES | YES | YES | YES | NO |
| registered_jersey_size_snapshot | YES | YES | YES | YES | NO |
| registered_image_snapshot | YES | YES | YES | YES | NO |
| admin_remarks | — | — | — | NOT BY USER | — |
| correction_history | — | — | — | NOT BY USER (append-only) | — |
| resubmission_count | — | — | — | NOT BY USER (auto-increment) | — |
| correction_requested_at | — | — | — | NOT BY USER | — |
| registration_status | — | — | — | NOT BY USER (auto-set to PENDING) | — |
| payment screenshot | YES | YES | YES | YES (via screenshot endpoint) | YES — admin must re-verify |
| tournament_id | — | — | — | NO (immutable) | — |
| player_id | — | — | — | NO (immutable) | — |
| registration_number | — | — | — | NO (immutable) | — |
| registration_type | — | — | — | NO (immutable) | — |
| team_owner_id | — | — | — | NO (immutable) | — |
| team_name | YES (N/A) | YES | YES | NO (immutable — set at slot allocation) | — |
| waitlist_position | — | — | — | NO (managed by RPC) | — |
| created_by_auth_id | — | — | — | NO (immutable) | — |

Notes:
- "Editable After Correction" means: the user can submit a new value in the PATCH body.
- "Payment Recheck Required" means: admin must re-verify payment even if screenshot was not changed.
- If user uploads a new payment screenshot, the existing payment.payment_status remains PENDING (not changed by the PATCH endpoint). Admin re-verification through the approval queue is required.
- Fields marked NO must be silently ignored if included in the PATCH body (do not throw an error, just discard).

---

## SECTION 6 — Owner + Icon Correction Isolation [REVISED]

### Rule

OWNER correction does NOT automatically put ICON into CORRECTION_REQUESTED.
ICON correction does NOT automatically put OWNER into CORRECTION_REQUESTED.

Each registration in an Owner+Icon pair is corrected independently.

### State Machine

```
OWNER: PENDING   <----[Admin: Request Correction]---- OWNER: CORRECTION_REQUESTED
ICON:  PENDING                                        ICON:  PENDING  (unchanged)

OWNER: PENDING   ----[Admin: Approve]----> OWNER: CONFIRMED
ICON:  CORRECTION_REQUESTED               ICON:  CORRECTION_REQUESTED  (not cascaded)
```

### Approval Cascade Behavior (Preserved from Phase 2)

The existing cascade in approve/route.ts (lines 70-122) cascades APPROVE and REJECT to sibling registrations via team_owner_id. This cascade behavior is PRESERVED for APPROVE and REJECT actions.

The REQUEST_CORRECTION branch MUST NOT touch the sibling cascade logic. It must only update the single target registration.

### Payment Status Rule

When REQUEST_CORRECTION is issued:
- payment_status is NOT changed.
- The admin can still view the screenshot via the existing View Receipt button.
- Payment re-verification happens after the user resubmits (payment_status remains PENDING until admin re-approves).

---

## SECTION 7 — Pages and Components Audit

### Pages - Changes Required

| File | Current State | Required Change | Phase |
|:---|:---|:---|:---:|
| src/app/admin/tournament/[id]/page.tsx | Shows Reject + Approve + AckAndApprove | Add Request Correction button + remark textarea (required). Add CORRECTION_REQUESTED to pendingApprovals filter. | 3B |
| src/app/registration/[id]/page.tsx | Shows Confirmed or Waitlist banner only | Add CORRECTION_REQUESTED branch: amber banner, admin_remarks, edit form, Resubmit CTA | 3C |
| src/app/profile/page.tsx | Shows registration list | Add CORRECTION_REQUESTED badge + link per registration row | 3D |
| src/app/page.tsx | Server Component homepage | Show notification alert if user has CORRECTION_REQUESTED registrations | 3D |

### Components - Changes Required

| File | Gap | Phase |
|:---|:---|:---:|
| src/components/ui/Badge.tsx | No CORRECTION_REQUESTED color styling | 3B |

### Components - No Change

| File | Usage in Phase 3 |
|:---|:---|
| src/components/ui/Modal.tsx | Reused for correction remark input |
| src/components/register/Step1Personal.tsx | Reused in registration edit form |
| src/components/register/Step2Cricket.tsx | Reused in registration edit form |

---

## SECTION 8 — TypeScript Types Audit

| File | Gap | Phase |
|:---|:---|:---:|
| src/types/database.ts | RegistrationStatus missing CORRECTION_REQUESTED. DbRegistration missing admin_remarks, correction_history, resubmission_count, correction_requested_at. DbNotification interface does not exist. | 3A |
| src/types/index.ts | Auto-covered via re-export. No change needed. | — |

---

## SECTION 9 — Library Files Audit

| File | Verdict |
|:---|:---|
| src/lib/auth/is-manager.ts | No change needed |
| src/lib/auth/is-admin.ts | No change needed |
| src/lib/audit/logger.ts | No change — new action names are plain strings |
| src/lib/supabase/admin.ts | No change needed |
| src/lib/supabase/server.ts | No change needed |
| src/lib/supabase/client.ts | No change needed |
| src/lib/validation/registration.ts | Must add Zod schema for PATCH resubmit body |
| src/lib/storage/upload.ts | No change needed — reused for correction screenshot |

---

## MASTER GAP TABLE

| # | Gap | Severity | Phase |
|:--|:---|:---:|:---:|
| G1 | check_registration_status constraint missing CORRECTION_REQUESTED | CRITICAL | 3A |
| G2 | Enum ADD VALUE and CHECK constraint must run in separate migration files | CRITICAL | 3A |
| G3 | Notification duplicate prevention: unique partial index required | CRITICAL | 3A |
| G4 | GET /api/registrations/[id] missing admin_remarks and Phase 3 fields | CRITICAL | 3C |
| G5 | PATCH /api/registrations/[id] does not exist — IDOR risk if not locked | CRITICAL | 3C |
| G6 | REQUEST_CORRECTION must be atomic — current design is NOT acceptable | CRITICAL | 3B |
| G7 | Legacy NULL created_by_auth_id: PATCH must return 403, notification must be skipped | MEDIUM | 3C |
| G8 | CORRECTION_REQUESTED not styled in Badge.tsx | MEDIUM | 3B |
| G9 | Admin approval queue missing CORRECTION_REQUESTED filter/button | MEDIUM | 3B |
| G10 | registration/[id]/page.tsx missing CORRECTION_REQUESTED branch | MEDIUM | 3C |
| G11 | Notification APIs do not exist | MEDIUM | 3D |
| G12 | RegistrationStatus TypeScript type missing CORRECTION_REQUESTED | MEDIUM | 3A |
| G13 | dashboard/route.ts missing correctionRequestedCount stat | LOW | 3B |
| G14 | tournament summary stats missing correctionRequestedCount | LOW | 3B |
