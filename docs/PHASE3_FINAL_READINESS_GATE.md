# Phase 3 — Final Readiness Gate (Revised v2)

**Document Status**: AUTHORITATIVE IMPLEMENTATION GATE — Revised after Gate Correction
**Date**: October 2, 2026
**Revision**: v2 — corrects atomicity model, authorization model, field matrix, Owner/Icon isolation, notification duplication safety, rollback model, and dry-run plan.

---

## PART 1 — Hard Gate Checklist (Infrastructure Prerequisites)

| # | Requirement | Status |
|:--|:---|:---:|
| HG-01 | All 22 Phase 1 and Phase 2 migrations committed and stable | PASS |
| HG-02 | allocate_player_registration_v2 supports created_by_auth_id | PASS |
| HG-03 | allocate_owner_registration_v4 supports created_by_auth_id and payment_method | PASS |
| HG-04 | registration_status enum has: PENDING, CONFIRMED, WAITING_LIST, REJECTED, CANCELLED | PASS |
| HG-05 | payment_status enum has all 8 canonical values | PASS |
| HG-06 | registrations.created_by_auth_id column exists (Phase 2) | PASS |
| HG-07 | team_owners.created_by_auth_id column exists (Phase 2) | PASS |
| HG-08 | Storage buckets (payment-screenshots, profile-images) exist | PASS |
| HG-09 | is_manager() and is_admin() DB functions exist | PASS |
| HG-10 | audit_logs table + logAdminAction() utility exist | PASS |
| HG-11 | requireManager() throws 403 for unauthenticated requests | PASS |
| HG-12 | requireAdmin() throws 403 for non-admin requests | PASS |
| HG-13 | POST /api/registrations validates auth.uid() on every request | PASS |
| HG-14 | Admin client uses service_role key (bypasses RLS) | PASS |
| HG-15 | Server client uses user JWT (respects RLS) | PASS |

---

## PART 2 — Design Checkpoints

### DC-01: Atomicity of REQUEST_CORRECTION [REVISED]

**Previous design (rejected):** "If notification INSERT fails, log and proceed — correction state takes priority."

**Correct design:** REQUEST_CORRECTION is FULLY ATOMIC. The registration status, notification, and audit log must all succeed or all be rolled back.

**Transaction boundary:**
```
BEGIN
  1. requireManager() authorization check
  2. SELECT registration FOR UPDATE (lock row)
  3. Validate state (must be PENDING or WAITING_LIST)
  4. Validate admin_remarks non-empty
  5. Archive existing remark to correction_history JSONB
  6. UPDATE registrations (status=CORRECTION_REQUESTED, admin_remarks, correction_requested_at)
  7. INSERT notifications (upsert on duplicate — see below)
  8. INSERT audit_logs via logAdminAction
COMMIT (only if all steps succeed)
ROLLBACK (if any step 5-8 fails)
```

**Preferred implementation:** Supabase RPC (PL/pgSQL function with SECURITY DEFINER) for atomic steps 5-8. API route calls the RPC. PostgreSQL rolls back automatically on any error.

**Acceptable fallback:** Sequential operations with explicit compensation (revert UPDATE if notification/audit INSERT fails).

**Failure responses:**

| Failure | HTTP Response | DB State |
|:---|:---:|:---|
| Auth fails | 403 | No change |
| Registration not found | 404 | No change |
| Wrong state (CONFIRMED, REJECTED, etc.) | 400 | No change |
| Empty admin_remarks | 400 | No change |
| DB error on any write step | 500 | Rolled back to prior state |

**Retry safety:** State guard (status=PENDING|WAITING_LIST required) prevents duplicate correction on already-CORRECTION_REQUESTED rows. Safe to retry after timeout.

### DC-02: Multi-Person Authorization Model [REVISED]

**Invariant:**
- `created_by_auth_id` = the auth account that submitted the registration (responsible party)
- `player_id` = the participant record (may belong to a different person with no auth account)

**Consequence for Phase 3:**
- Correction notification target → `created_by_auth_id`
- PATCH authorization check → `created_by_auth_id = auth.uid()`
- Do NOT use participant's `player.auth_user_id` as the correction authorization mechanism

**Legacy NULL created_by_auth_id:**
- Notification INSERT skipped; log warning server-side
- PATCH endpoint returns 403 with: "This registration cannot be resubmitted online. Contact admin."
- Admin can still act on the registration normally (APPROVE/REJECT)

### DC-03: Correction Field Matrix [REVISED]

All registration fields classified. Fields not listed as editable MUST be silently ignored in the PATCH body.

| Field | Player | Owner | Icon | User-Editable | Payment Recheck |
|:---|:---:|:---:|:---:|:---:|:---:|
| registered_name_snapshot | YES | YES | YES | YES | NO |
| registered_role_snapshot | YES | YES | YES | YES | NO |
| registered_batting_style_snapshot | YES | YES | YES | YES | NO |
| registered_jersey_size_snapshot | YES | YES | YES | YES | NO |
| registered_image_snapshot | YES | YES | YES | YES | NO |
| payment screenshot (via screenshot endpoint) | YES | YES | YES | YES | YES |
| admin_remarks | — | — | — | NO (admin only) | — |
| correction_history | — | — | — | NO (append-only) | — |
| resubmission_count | — | — | — | NO (auto-increment) | — |
| correction_requested_at | — | — | — | NO (auto-set) | — |
| registration_status | — | — | — | NO (auto-set to PENDING) | — |
| tournament_id | — | — | — | NO (immutable) | — |
| player_id | — | — | — | NO (immutable) | — |
| registration_number | — | — | — | NO (immutable) | — |
| registration_type | — | — | — | NO (immutable) | — |
| team_owner_id | — | — | — | NO (immutable) | — |
| team_name | — | YES | YES | NO (immutable, set at allocation) | — |
| waitlist_position | — | — | — | NO (managed by RPC) | — |
| created_by_auth_id | — | — | — | NO (immutable) | — |

Notes:
- "Payment Recheck Required" = admin must re-verify payment in the approval queue after resubmission.
- If user uploads a new payment screenshot, payment_status remains PENDING. Admin re-approval required.
- Silently discard any immutable fields included in PATCH body.

### DC-04: Owner + Icon Correction Isolation [REVISED]

**Rule:** Each registration in an Owner+Icon pair is corrected independently.

- OWNER correction → does NOT automatically set ICON to CORRECTION_REQUESTED
- ICON correction → does NOT automatically set OWNER to CORRECTION_REQUESTED
- The existing approval cascade (APPROVE/REJECT cascade to sibling via team_owner_id) is PRESERVED
- REQUEST_CORRECTION branch MUST NOT trigger the sibling cascade

**Payment independence:** payment_status is NEVER changed by REQUEST_CORRECTION. Admin re-verifies after user resubmits.

### DC-05: Notification Duplicate Prevention [REVISED]

**Mechanism:** Unique partial index on active (unread) notifications:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_active_correction
  ON notifications(user_id, registration_id, type)
  WHERE read_at IS NULL;
```

**Notification upsert pattern:**
```sql
INSERT INTO notifications (user_id, type, title, message, registration_id, tournament_id)
VALUES (...)
ON CONFLICT ON CONSTRAINT uq_notifications_active_correction
DO UPDATE SET message = EXCLUDED.message, updated_at = NOW();
```

**Scenario coverage:**

| Scenario | Behavior |
|:---|:---|
| Admin double-clicks Request Correction | Second API call hits state guard (status=CORRECTION_REQUESTED). Returns 400. No duplicate notification. |
| Network timeout, client retries | State guard prevents re-correction. |
| Same correction requested twice (multiple correction cycles) | After user resubmits, status=PENDING. New correction is valid and creates a new (separate) notification. Intended. |
| Unread prior correction notification exists for same registration | Upsert updates message + updated_at. No duplicate row inserted. |

### DC-06: Migration Rollback Model [REVISED]

**CRITICAL CORRECTION from v1:** DROP ENUM VALUE is NOT a rollback option in PostgreSQL. The `CORRECTION_REQUESTED` value, once committed, cannot be removed.

**Correct rollback model:**

| Scenario | Action |
|:---|:---|
| File 1 (enum extension) succeeds, File 2 fails | Stop deployment. Enum value is inert without Phase 3B code. Create a forward-fix migration to complete File 2. Do NOT deploy Phase 3B until fixed. |
| File 2 succeeds, Phase 3B code deployment fails | Roll back application code via Vercel rollback only. No migration rollback needed. |
| Columns need removal | ALTER TABLE registrations DROP COLUMN IF EXISTS admin_remarks; (etc.) |
| Notifications table removal | DROP TABLE IF EXISTS notifications; |
| Restore 5-value constraint | DROP CONSTRAINT + ADD with 5-value CHECK |

### DC-07: Migration Dry-Run Plan [REVISED]

**18-step sequence — must be followed in full. No production migration until step 18 passes.**

```
1.  Create File 1 (phase3a_enum_extension.sql)
2.  Run local migration: supabase db push
3.  Verify: SELECT unnest(enum_range(NULL::registration_status));
    Expected: CORRECTION_REQUESTED present
4.  Create File 2 (phase3a_schema_additions.sql, timestamp +1)
5.  Run local migration: supabase db push
6.  Verify constraint: SELECT pg_get_constraintdef(oid) FROM pg_constraint
    WHERE conname = 'check_registration_status';
    Expected: CORRECTION_REQUESTED in constraint
7.  Verify notifications table exists:
    SELECT table_name FROM information_schema.tables WHERE table_name = 'notifications';
8.  Verify RLS:
    SELECT rowsecurity FROM pg_tables WHERE tablename = 'notifications';
    Expected: true
9.  Verify unique index:
    SELECT indexname FROM pg_indexes WHERE indexname = 'uq_notifications_active_correction';
    Expected: 1 row
10. Verify existing RPCs work:
    Test /api/registrations and /api/owner-registrations end-to-end locally
11. Run automated tests: npx vitest run — Expected: all pass
12. TypeScript check: npx tsc --noEmit — Expected: no errors
13. Production build: npm run build — Expected: succeeds
14. Review git diff: git diff --stat
    Expected: only migration files + src/types/database.ts changed
15. Commit to feature branch
16. Push: git push origin feature/phase-3a
17. Verify Vercel Preview deploys without build errors
18. Browser QA on Preview URL:
    - Registration flow end-to-end: OK
    - Admin approval flow end-to-end: OK
    - Existing status badges unchanged: OK

Only after Step 18 passes: open PR.
Only after PR approved: apply production migration.
```

---

## PART 3 — Phase-by-Phase Authorization Summary

### Phase 3A — Data Model
Files: 2 migration files + src/types/database.ts

### Phase 3B — Admin Correction Workflow
Files: approve/route.ts (atomic REQUEST_CORRECTION branch) + summary/route.ts + admin tournament page + Badge.tsx

### Phase 3C — User Resubmission
Files: registrations/[id]/route.ts (PATCH + GET extension) + registration/[id]/page.tsx

IDOR enforcement on PATCH:
  1. auth.uid() exists (authentication)
  2. registration.created_by_auth_id = auth.uid() (authorization)
  3. registration.registration_status = CORRECTION_REQUESTED (state guard)

### Phase 3D — Notification System
Files: /api/notifications/route.ts + /api/notifications/[id]/read/route.ts + profile page + homepage

---

## PART 4 — Gate Verdict Checklist

| Checkpoint | Criteria | Status |
|:---|:---|:---:|
| ATOMIC CORRECTION REQUEST | REQUEST_CORRECTION, notification, and audit log are transactionally bound. No partial-success allowed. Failure rolls back registration status. | PASS |
| MULTI-PERSON AUTHORIZATION | created_by_auth_id is the authorization mechanism. player_id is NOT used for correction auth. NULL legacy behavior documented. | PASS |
| CORRECTION FIELD MATRIX | All fields explicitly classified: editable YES/NO, payment recheck YES/NO, for PLAYER/OWNER/ICON. Immutable fields silently discarded. | PASS |
| OWNER/ICON ISOLATION | Correction is per-registration only. No cascade. Approval cascade preserved. Payment independence confirmed. | PASS |
| NOTIFICATION DUPLICATION SAFETY | Unique partial index on active notifications. Upsert pattern defined. All double-click and retry scenarios handled. | PASS |
| MIGRATION ROLLBACK SAFETY | DROP ENUM VALUE removed. Correct rollback procedures for each failure scenario. Enum inertness documented. | PASS |
| MIGRATION DRY-RUN PLAN | 18-step sequence with explicit verification queries at each step. No production migration until step 18 passes. | PASS |

---

## GATE DECISION

**READY FOR PHASE 3A**

All seven gate checkpoints PASS.

Implementation sequence:
  1. Phase 3A: Two migration files + TypeScript types update
  2. Phase 3B: Admin REQUEST_CORRECTION (atomic) + UI
  3. Phase 3C: User PATCH endpoint (IDOR-safe) + registration detail page
  4. Phase 3D: Notification APIs + user notification UI

Follow the 18-step dry-run sequence before any production migration is applied.
