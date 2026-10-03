# Phase 3 — Implementation Plan

**Document Status**: READ-ONLY Planning Document
**Date**: October 2, 2026
**Source Authority**: Actual application source code and migration files.

> IMPORTANT: This document is a planning artifact only. No source code, migrations, or production data have been modified.

---

## Deployment Pipeline (ALL Phase 3 Work)

```
LOCAL DEV
  |
  v
npx vitest run (all tests pass)
  |
  v
COMMIT
  |
  v
PUSH
  |
  v
PR (pull request)
  |
  v
VERCEL PREVIEW (auto-deploy)
  |
  v
BROWSER QA (check preview URL)
  |
  v
MERGE to main
  |
  v
PRODUCTION auto-deploy (Vercel)
  |
  v
SMOKE TEST on production
```

**Never modify production directly. Never skip PR review.**

---

## PHASE 3A — Data Model + State Design
**Complexity: MEDIUM**

### Objective
Add the database foundation required by all subsequent phases.

### DB Migration Required: YES

**Migration file**: `supabase/migrations/2026XXXX000000_phase3a_correction_state.sql`

**Contents (additive only)**:
```sql
-- 1. Extend registration_status enum
ALTER TYPE registration_status ADD VALUE IF NOT EXISTS 'CORRECTION_REQUESTED';

-- 2. Add admin_remarks to registrations
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS admin_remarks TEXT;

-- 3. Add correction_history (audit of past remarks)
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS correction_history JSONB DEFAULT '[]'::jsonb;

-- 4. Add resubmission_count
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS resubmission_count INTEGER DEFAULT 0;

-- 5. Add correction_requested_at
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS correction_requested_at TIMESTAMPTZ;

-- 6. Create notifications table
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

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
```

### Files Affected
- `supabase/migrations/2026XXXX000000_phase3a_correction_state.sql` (NEW)

### API Changes: None
### UI Changes: None
### Tests to Run: P3-REG-001 through P3-REG-010

### Risks
- Enum extension (`ADD VALUE IF NOT EXISTS`) is irreversible in PostgreSQL. Cannot be rolled back.
- **Mitigation**: Use IF NOT EXISTS guards. Test on local Supabase before pushing.

### Rollback Strategy
- Column additions: `ALTER TABLE registrations DROP COLUMN admin_remarks;` (safe)
- Enum value: Cannot be removed from PostgreSQL enum. Acceptable — unused values do not break anything.
- notifications table: `DROP TABLE IF EXISTS notifications;` (safe if no data)

---

## PHASE 3B — Admin Correction Workflow
**Complexity: MEDIUM**

### Objective
Give admins the ability to request corrections with a mandatory remark.

### Prerequisites: Phase 3A complete.

### Files to Modify

1. **`src/app/api/admin/registrations/[id]/approve/route.ts`**
   - Add `'REQUEST_CORRECTION'` branch in the action switch.
   - Validate `admin_remarks` is non-empty (server-side).
   - Update `registrations` row: `registration_status = 'CORRECTION_REQUESTED'`, `admin_remarks = remarks`, `correction_requested_at = NOW()`.
   - Archive existing remark to `correction_history` before overwriting.
   - INSERT into `notifications` table.
   - Call `logAdminAction` with `action = 'REQUEST_REGISTRATION_CORRECTION'`.
   - Do NOT change `payments.payment_status`.

2. **`src/app/admin/page.tsx`** (Admin Dashboard)
   - Add `[Request Correction]` button alongside `[Approve]` and `[Reject]`.
   - Show a remark textarea that becomes required when `[Request Correction]` is selected.
   - Display the registration type (PLAYER/OWNER/ICON) badge clearly.
   - Display existing `admin_remarks` if registration is in `CORRECTION_REQUESTED` state.

### DB Migration: NO (Phase 3A handles this)
### API Changes: YES (approve/route.ts extended)
### UI Changes: YES (admin dashboard)

### Tests to Run: P3-ADM-001 through P3-ADM-012 + P3-SEC-003, P3-SEC-005

### Admin UX Design

```
Admin opens pending registration:

+-------------------------------------------------+
| REG-XXXX-0001                                  |
| Player: Rahul Patil                            |
| Role: Batsman | Jersey: L | Status: PENDING    |
| Payment: PENDING | Screenshot: [view]          |
|                                                |
| Admin Actions:                                 |
|  [Confirm]  [Reject]  [Request Correction ▼]  |
|                                                |
| (when Request Correction selected):            |
| Correction Remark: *                           |
| +--------------------------------------------+|
| | Payment screenshot is not readable. Please ||
| | upload a clear payment confirmation.        ||
| +--------------------------------------------+|
|  [Send Correction Request]                     |
+-------------------------------------------------+
```

### Risks
- If notification INSERT fails, correction status is already set. Use try-catch — correction state takes priority; notification failure should log an error but not rollback the status change.
- **Mitigation**: Log notification failure; implement a retry mechanism in Phase 3D if needed.

### Rollback Strategy
- Revert approve/route.ts changes via git revert.
- Reset any CORRECTION_REQUESTED rows back to PENDING manually if needed (admin-only DB tool).

---

## PHASE 3C — User Correction / Resubmission
**Complexity: HIGH**

### Objective
Allow users to see correction requests, edit their registration, and resubmit.

### Prerequisites: Phases 3A and 3B complete.

### Files to Create/Modify

1. **`src/app/api/registrations/[id]/route.ts`** (NEW endpoint: PATCH method)
   - Auth: require authenticated session.
   - Authorization: verify `created_by_auth_id = auth_user_id` (server-side).
   - Validate: `registration_status MUST be 'CORRECTION_REQUESTED'`.
   - Allowed fields to update: `registered_name_snapshot`, `registered_role_snapshot`, `registered_batting_style_snapshot`, `registered_jersey_size_snapshot`, `registered_image_snapshot`.
   - Optional: if `paymentScreenshotBase64` in body, upload to storage and update payments.
   - State transitions: `registration_status = 'PENDING'`, `admin_remarks = NULL`, increment `resubmission_count`, append to `correction_history`.
   - Mark associated notification as read (`read_at = NOW()`).
   - Write audit log: `RESUBMIT_REGISTRATION`.

2. **`src/app/api/registrations/[id]/route.ts`** (EXTEND GET method if needed)
   - Ensure `admin_remarks`, `correction_requested_at`, `resubmission_count`, `registration_type` are returned.
   - Existing GET route is in `src/app/api/registrations/[id]/route.ts` (needs verification of current select).

3. **`src/app/registration/[id]/page.tsx`**
   - Add `CORRECTION_REQUESTED` status branch.
   - Show "ACTION REQUIRED" banner (amber/orange styling).
   - Display `admin_remarks` prominently.
   - Show an edit form (reuse Step1Personal + Step2Cricket fields, pre-filled with existing snapshot values).
   - Show payment re-upload section if payment is involved.
   - Replace primary CTA with `[Resubmit for Review]` button.
   - On success: show confirmation message and re-fetch registration state.

### DB Migration: NO (Phase 3A handles this)
### API Changes: YES (new PATCH endpoint)
### UI Changes: YES (registration detail page)

### Tests to Run: P3-USR-001 through P3-USR-012, P3-SEC-001, P3-SEC-007 through P3-SEC-010

### User UX Design — /registration/[id] in CORRECTION_REQUESTED state

```
+-----------------------------------------------------+
| FPL Clash of Champions                              |
| Reg: REG-XXXX-0001                                 |
|                                                     |
| ⚠️  ACTION REQUIRED                                |
+-----------------------------------------------------+
| Admin message:                                      |
| "Payment screenshot is not readable. Please upload  |
|  a clear payment confirmation image."               |
+-----------------------------------------------------+

[Edit form below - pre-filled with existing data]

Full Name: [Rahul Patil              ]  (pre-filled)
Cricket Role: [Batsman           ▼]    (pre-filled)
Batting Style: [Right Hand       ▼]    (pre-filled)
Jersey Size: [L                  ▼]    (pre-filled)

[Re-upload Payment Screenshot]
  Current: [existing screenshot thumbnail]
  [Change Screenshot]

                    [Resubmit for Review]
```

### Risks
- Concurrent resubmission by the same user (unlikely but possible). Use optimistic locking or check state before PATCH.
- Profile image re-upload requires the same base64 validation pipeline as original registration.
- **Mitigation**: Reuse existing `validateImageFileBuffer` and `uploadToStorageBucket` utilities from `src/lib/storage/upload.ts`.

### Rollback Strategy
- Revert PATCH endpoint via git revert.
- Revert registration detail page UI changes.
- CORRECTION_REQUESTED registrations remain in that state until admin re-reviews (no data loss).

---

## PHASE 3D — Notification System
**Complexity: MEDIUM**

### Objective
Surface notifications to the authenticated user on the homepage and profile.

### Prerequisites: Phase 3A (notifications table), Phase 3B (notification creation).

### Files to Create/Modify

1. **`src/app/api/notifications/route.ts`** (NEW)
   - `GET`: Auth required. Return `notifications WHERE user_id = auth_user_id ORDER BY created_at DESC LIMIT 20`. Include `unreadCount`.

2. **`src/app/api/notifications/[id]/route.ts`** (NEW)
   - `PATCH`: Auth required. Verify `notification.user_id = auth_user_id`. Set `read_at = NOW()`.

3. **`src/app/page.tsx`** (Homepage — CONVERT portion to client or add client sub-component)
   - The homepage is currently a Server Component with `revalidate = 60`.
   - **Recommended approach**: Add a `<NotificationBanner />` client component that self-fetches `/api/notifications` when user is authenticated.
   - This keeps the server component structure intact while adding dynamic authenticated content.
   - The NotificationBanner renders only if `unreadCount > 0` or `notifications` contains `CORRECTION_REQUIRED` type entries.

4. **`src/components/notifications/NotificationBanner.tsx`** (NEW)
   - Client component. Fetches `/api/notifications` on mount.
   - Shows unread count + latest action-required notification.
   - `[View & Correct]` button navigates to `/registration/[registration_id]`.

### DB Migration: NO (Phase 3A handled this)
### API Changes: YES (new endpoints)
### UI Changes: YES (homepage + new component)

### Tests to Run: P3-NOT-001 through P3-NOT-010

### Risks
- Homepage is currently a pure Server Component. Introducing a client fetch changes its behavior.
- **Mitigation**: Keep the homepage Server Component unchanged. The NotificationBanner is a separate Client Component that runs independently.

### Rollback Strategy
- Remove NotificationBanner from homepage JSX. New API routes are harmless if unused.

---

## PHASE 3E — User Registration History Enhancement
**Complexity: LOW-MEDIUM**

### Objective
Improve the /profile registration history to show all required information.

### Prerequisites: Phase 3A (admin_remarks column), Phase 3D (notifications visible).

### Files to Modify

1. **`src/app/api/players/profile/route.ts`**
   - Extend the registrations query to include: `registration_type`, `admin_remarks`, `correction_history`, `resubmission_count`.
   - Add secondary query: `WHERE created_by_auth_id = user.id` and merge with primary results (deduplication by registration ID).
   - Include `payment_status` (already fetched as `payments:payments(payment_status, amount)` — ensure it is passed to response).

2. **`src/app/profile/page.tsx`**
   - Add `registration_type` badge (PLAYER / OWNER / ICON) to each history card.
   - Add `payment_status` badge.
   - Add `admin_remarks` snippet if present.
   - Add `[Correct Now]` button when `registration_status = 'CORRECTION_REQUESTED'`.
   - Rename `[View Pass Receipt]` to `[View Registration]`.
   - Show correct total count (including OTHER-created registrations).

### DB Migration: NO
### API Changes: YES (profile API extended)
### UI Changes: YES (profile page history cards)

### Tests to Run: P3-HIST-001 through P3-HIST-008

### Risks
- If a user has many registrations (for others), the merged query may return many rows.
- **Mitigation**: Add pagination or limit (e.g., most recent 20). Keep existing behavior as fallback.

### Rollback Strategy
- Revert profile API and profile page changes. Existing tournament count display unchanged.

---

## PHASE 3F — Homepage Integration
**Complexity: LOW**

### Objective
Integrate the notification system into the homepage for action-required items.

### Prerequisites: Phase 3D (notifications API + NotificationBanner component).

### Files to Modify

1. **`src/app/page.tsx`**
   - Import and render `<NotificationBanner />` after the existing `isSubmitted` banner block.
   - NotificationBanner is a Client Component; it only fetches for authenticated users.

2. **`src/components/notifications/NotificationBanner.tsx`** (from Phase 3D)
   - Final polish: ensure it renders correctly on the homepage layout.

### DB Migration: NO
### API Changes: NO
### UI Changes: YES (homepage)

### Tests to Run: Manual browser QA.

### Risks: Minimal. Client component addition to a Server Component page is safe in Next.js 15.

---

## PHASE 3G — Security + Regression Testing
**Complexity: MEDIUM**

### Objective
Full security audit of all Phase 3 additions. Regression test of all existing functionality.

### Prerequisites: All phases 3A-3F complete.

### Actions

1. Run full Vitest suite: `npx vitest run` — all 177 baseline + new Phase 3 tests must pass.
2. Security audit: manually test IDOR scenarios (P3-SEC-001 through P3-SEC-010).
3. Verify REQ-038 (admin self-approval prevention) with authenticated test.
4. Verify all existing audit log events still write correctly.
5. Verify Vercel Preview deployment with full QA checklist.
6. Production smoke test after merge.

### Smoke Test Checklist (Production)
- [ ] Existing registration IDs still accessible.
- [ ] Admin dashboard loads all registrations.
- [ ] Admin can approve/reject (existing flow unchanged).
- [ ] Admin can request correction (new flow).
- [ ] Authenticated user sees notification on homepage.
- [ ] User can open correction notification and edit registration.
- [ ] User can resubmit and admin sees it in PENDING queue.
- [ ] Profile page shows PLAYER/OWNER/ICON badges and payment status.
- [ ] No console errors in production.

---

## Summary: Files Affected by Phase 3

### New Files
- `supabase/migrations/2026XXXX000000_phase3a_correction_state.sql`
- `src/app/api/notifications/route.ts`
- `src/app/api/notifications/[id]/route.ts`
- `src/components/notifications/NotificationBanner.tsx`
- `src/tests/phase3-correction-admin.test.ts`
- `src/tests/phase3-correction-user.test.ts`
- `src/tests/phase3-notifications.test.ts`
- `src/tests/phase3-registration-history.test.ts`
- `src/tests/phase3-e2e-player-correction.test.ts`
- `src/tests/phase3-e2e-owner-correction.test.ts`

### Modified Files
- `src/app/api/admin/registrations/[id]/approve/route.ts`
- `src/app/api/registrations/[id]/route.ts` (EXTEND GET + ADD PATCH)
- `src/app/api/players/profile/route.ts`
- `src/app/admin/page.tsx`
- `src/app/registration/[id]/page.tsx`
- `src/app/profile/page.tsx`
- `src/app/page.tsx`

### NOT Modified (existing behavior preserved)
- All RPC functions (allocate_player_registration_v2, allocate_owner_registration_v4)
- All payment routes
- All tournament routes
- All export routes
- All auth routes
- Storage bucket configurations
- RLS policies (except notifications table new policy)

---

## Complexity Estimates

| Phase | Complexity | Estimated Effort |
|:---|:---:|:---|
| 3A — Data Model | MEDIUM | 1 day — migration authoring + local testing |
| 3B — Admin Correction | MEDIUM | 2 days — API + admin UI |
| 3C — User Resubmission | HIGH | 3 days — PATCH endpoint + registration page redesign |
| 3D — Notification System | MEDIUM | 2 days — API + homepage component |
| 3E — History Enhancement | LOW-MEDIUM | 1 day — profile API + UI |
| 3F — Homepage Integration | LOW | 0.5 day — component placement |
| 3G — Security + Testing | MEDIUM | 2 days — full test suite + QA |
| **Total** | | **~11-12 days** |

---

*Generated: 2026-10-02. No implementation has begun.*
