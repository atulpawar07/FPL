# Phase 3 — API and Data Model Plan

**Document Status**: READ-ONLY Planning Document
**Date**: October 2, 2026
**Source Authority**: Actual migration files and API route handlers.

> IMPORTANT: This document is a planning artifact only. No source code, migrations, or production data have been modified.

---

## Part 1 — Data Model Design

### 1.1 Existing Tables Analysis (Phase 3 Compatibility)

| Table | Existing | Phase 3 Compatible? | Changes Required |
|:---|:---:|:---:|:---|
| players | YES | YES | None |
| tournaments | YES | YES | None |
| registrations | YES | Partial | Add admin_remarks TEXT, correction_history JSONB |
| payments | YES | YES | None (payment_status enum sufficient) |
| team_owners | YES | YES | None |
| admin_users | YES | YES | None |
| managers | YES | YES | None |
| audit_logs | YES | YES | None (new action types will be logged as TEXT strings) |
| notifications | NO | N/A | **CREATE THIS TABLE** |

### 1.2 Registrations Table — Proposed Column Additions

**DO NOT add these now. Migration required in Phase 3A.**

```sql
-- ADDITIVE ONLY — Safe for production

-- 1. Extend enum (additive, safe)
ALTER TYPE registration_status ADD VALUE IF NOT EXISTS 'CORRECTION_REQUESTED';

-- 2. Add admin_remarks column
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS admin_remarks TEXT;

-- 3. Add correction history (preserves remark history across multiple corrections)
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS correction_history JSONB DEFAULT '[]'::jsonb;

-- 4. Add resubmission tracking
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS resubmission_count INTEGER DEFAULT 0;

-- 5. Add correction_requested_at timestamp
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS correction_requested_at TIMESTAMPTZ;
```

**Rationale for each column:**
- `admin_remarks`: Active remark visible to user. Cleared (moved to history) on resubmission.
- `correction_history`: JSONB array of {remark, requested_at, resolved_at, resolved_by_auth_id}. Never deleted. Audit-safe.
- `resubmission_count`: Tracks how many times a user has resubmitted. Useful for admin visibility.
- `correction_requested_at`: Timestamp for audit trail and notification creation ordering.

### 1.3 Notifications Table — Proposed New Table

**DO NOT create this now. Migration required in Phase 3D.**

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Target: the auth user who should see this notification
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Type drives UI rendering
  type TEXT NOT NULL,  -- 'CORRECTION_REQUIRED' | 'REGISTRATION_CONFIRMED' | 'REGISTRATION_REJECTED' (future)

  -- Human-readable content
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Deep-link context
  registration_id UUID REFERENCES registrations(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,

  -- Read state
  read_at TIMESTAMPTZ,  -- NULL = unread

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_registration_id ON notifications(registration_id);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: User sees only their own notifications
CREATE POLICY "Users see own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Server (service role) can insert
-- (No user-level insert; notifications are created server-side only)
```

**Notification Type Values (Phase 3):**
| Type | Trigger | Message Template |
|:---|:---|:---|
| CORRECTION_REQUIRED | Admin: REQUEST_CORRECTION | "Action required: {admin_remarks} — {tournament_name}" |
| REGISTRATION_CONFIRMED | Admin: APPROVE (future enhancement) | "Your registration for {tournament_name} is confirmed!" |
| REGISTRATION_REJECTED | Admin: REJECT (future enhancement) | "Your registration for {tournament_name} was not approved." |

**Phase 3 must implement CORRECTION_REQUIRED only.** CONFIRMED/REJECTED notifications are future scope.

### 1.4 No New Tables Beyond notifications

**Decision: Do not create additional tables for Phase 3.**

- `correction_status` → Handled by `registrations.registration_status = CORRECTION_REQUESTED` (enum extension)
- `resubmission_tracking` → Handled by `registrations.resubmission_count` and `registrations.correction_history`
- `notification_inbox` → Handled by `notifications` table above
- `field_level_corrections` → Handled by free-text `admin_remarks` (simpler, lower risk)

---

## Part 2 — API Change Plan

### 2.1 Existing APIs to Modify

| Endpoint | Method | Change Required | Auth | Purpose |
|:---|:---:|:---|:---:|:---|
| /api/admin/registrations/[id]/approve | POST | Add action=REQUEST_CORRECTION branch. Save admin_remarks to registrations. Create notifications row. Write audit log. | requireManager() | Admin correction request |
| /api/registrations/[id] | GET | Add admin_remarks, correction_history, resubmission_count, registration_type to response. Add correction_requested_at. | Public/Auth (see REQ-032) | Registration detail fetch |
| /api/players/profile | GET | Add registration_type, admin_remarks, correction_history, payment_status to registrations array. Also return registrations WHERE created_by_auth_id = user.id. | Auth | User registration history |

### 2.2 New APIs Required

| Endpoint | Method | Purpose | Auth | Request Body | Response | DB Changes |
|:---|:---:|:---|:---:|:---|:---|:---|
| /api/registrations/[id] | PATCH | User resubmits corrected registration. Updates allowed fields. Resets status to PENDING. Archives admin_remarks. Creates audit log. Resolves notification. | Auth (created_by_auth_id check) | {registered_name_snapshot?, registered_role_snapshot?, registered_batting_style_snapshot?, registered_jersey_size_snapshot?, registered_image_snapshot?, paymentScreenshotBase64?} | {success, registrationId, status} | registrations: admin_remarks cleared, status=PENDING, resubmission_count++, correction_history updated. notifications: read_at set. audit_logs: RESUBMIT_REGISTRATION event. |
| /api/notifications | GET | User fetches their unread/recent notifications. | Auth | - | {notifications: [{id, type, title, message, registration_id, tournament_id, read_at, created_at}], unreadCount} | notifications table SELECT |
| /api/notifications/[id]/read | PATCH | User marks notification as read. | Auth (user_id check) | {} | {success} | notifications: read_at = NOW() |

### 2.3 API NOT Required (Reuse Existing)

- Screenshot upload → existing `POST /api/registrations/[id]/screenshot` works unchanged.
- Profile update → existing `POST /api/players/profile` works unchanged.
- Admin dashboard → existing `GET /api/admin/dashboard` works (CORRECTION_REQUESTED registrations appear as-is in queue).

---

## Part 3 — RPC / Database Function Plan

### 3.1 Should Correction Logic Use an RPC?

**Recommendation: YES for correction request (Phase 3B). NO for resubmission.**

**Correction Request RPC (Phase 3B)**:
```sql
-- Atomic server-side correction request
-- NOT TO BE CREATED NOW — Phase 3B implementation

CREATE OR REPLACE FUNCTION request_registration_correction(
  p_registration_id UUID,
  p_admin_user_id UUID,
  p_admin_remarks TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  old_status TEXT,
  new_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status TEXT;
  v_created_by UUID;
  v_tournament_name TEXT;
  v_reg_number TEXT;
BEGIN
  -- Get registration details
  SELECT registration_status, created_by_auth_id, registration_number
  INTO v_old_status, v_created_by, v_reg_number
  FROM registrations
  WHERE id = p_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found';
  END IF;

  IF v_old_status NOT IN ('PENDING', 'CORRECTION_REQUESTED') THEN
    RAISE EXCEPTION 'Cannot request correction for registration in % status', v_old_status;
  END IF;

  -- Archive existing remark to correction_history before overwriting
  UPDATE registrations
  SET
    registration_status = 'CORRECTION_REQUESTED',
    admin_remarks = p_admin_remarks,
    correction_requested_at = NOW(),
    resubmission_count = resubmission_count,  -- unchanged
    correction_history = CASE
      WHEN admin_remarks IS NOT NULL AND admin_remarks <> ''
      THEN correction_history || jsonb_build_array(jsonb_build_object(
        'remark', admin_remarks,
        'requested_at', correction_requested_at,
        'resolved_at', NULL
      ))
      ELSE correction_history
    END,
    updated_at = NOW()
  WHERE id = p_registration_id;

  -- Get tournament name for notification
  SELECT t.name INTO v_tournament_name
  FROM tournaments t
  JOIN registrations r ON r.tournament_id = t.id
  WHERE r.id = p_registration_id;

  -- Create notification for the creator
  INSERT INTO notifications (
    user_id, type, title, message, registration_id, tournament_id, created_at, updated_at
  )
  SELECT
    v_created_by,
    'CORRECTION_REQUIRED',
    'Action Required: Registration Correction',
    'Admin has requested a correction: ' || p_admin_remarks,
    p_registration_id,
    r.tournament_id,
    NOW(),
    NOW()
  FROM registrations r
  WHERE r.id = p_registration_id;

  RETURN QUERY SELECT TRUE, v_old_status, 'CORRECTION_REQUESTED'::TEXT;
END;
$$;
```

**Resubmission (Phase 3C)**: Keep in API route handler (no RPC). Reason: resubmission updates are simpler (no slot allocation needed) and benefit from Next.js request validation logic.

### 3.2 RPC Plan Summary

| RPC | Purpose | Phase | New/Existing | Inputs | Outputs | Tables | Security |
|:---|:---|:---:|:---:|:---|:---|:---|:---|
| request_registration_correction | Atomic correction request + notification creation | 3B | NEW | p_registration_id, p_admin_user_id, p_admin_remarks | success, old_status, new_status | registrations, notifications | SECURITY DEFINER |
| allocate_player_registration_v2 | Existing slot allocation | N/A | EXISTING | (unchanged) | (unchanged) | registrations, payments | SECURITY DEFINER |
| allocate_owner_registration_v4 | Existing owner+icon allocation | N/A | EXISTING | (unchanged) | (unchanged) | registrations, payments, team_owners, players | SECURITY DEFINER |

---

## Part 4 — Audit Logging Plan

### Required Audit Events (Phase 3)

| Event Name | Trigger | Logged Fields | Valuable? |
|:---|:---|:---|:---:|
| REQUEST_REGISTRATION_CORRECTION | Admin calls action=REQUEST_CORRECTION | admin_user_id, registration_id, old_status, new_status, admin_remarks | YES — critical for accountability |
| RESUBMIT_REGISTRATION | User calls PATCH /api/registrations/[id] | user_auth_id, registration_id, old_status=CORRECTION_REQUESTED, new_status=PENDING, fields_changed | YES — tracks user corrections |
| MARK_NOTIFICATION_READ | User calls PATCH /api/notifications/[id]/read | user_auth_id, notification_id | NO — low value; avoid noise |
| VIEW_CORRECTION_REQUEST | User opens /registration/[id] in correction state | user_auth_id, registration_id | NO — page views not worth logging |

**Recommended: Log REQUEST_REGISTRATION_CORRECTION and RESUBMIT_REGISTRATION only.**

---

## Part 5 — Notification Architecture

### 5.1 Where Notifications Appear

| Location | Component | Implementation |
|:---|:---|:---|
| Homepage (/) | New NotificationBanner client component | Fetch GET /api/notifications, show unread count + latest action-required alert. Only visible to authenticated users. |
| /profile | Inline action-required badge on history cards | If registration.registration_status = CORRECTION_REQUESTED, show amber badge + "Correct Now" button. No separate fetch needed (profile API already returns status). |
| /registration/[id] | ACTION REQUIRED banner at top of page | If registration_status = CORRECTION_REQUESTED, render prominent banner with admin_remarks. |
| Header | Notification bell icon (optional Phase 3F+ enhancement) | Bell icon with unread count. Clicking shows dropdown or navigates to /profile. |

### 5.2 Persistent Notification Inbox

**Decision: NOT required for Phase 3.**

The /profile page already serves as a natural "My Registrations" history. The homepage notification banner handles action-required alerts. A separate /notifications inbox page adds complexity without commensurate value at this stage.

If needed in future, the notifications table schema supports a full inbox view without schema changes.

### 5.3 Notification Design Details

```
Homepage banner (authenticated user):

+-----------------------------------------------------------------------+
| ⚠️  Action Required (1)                                               |
|                                                                       |
| Payment issue for: FPL Clash of Champions                             |
| "Payment screenshot is not readable. Please upload a clear image."   |
|                                                               [View & Correct] |
+-----------------------------------------------------------------------+

Click: navigates to /registration/[registration_id]
```

---

## Part 6 — Access Control Design

### 6.1 Registration Access Rules

| Action | Endpoint | Auth Required | Authorization Rule |
|:---|:---|:---:|:---|
| View registration details | GET /api/registrations/[id] | Optional (semi-public for receipt sharing) | No change. UUID is hard to guess. |
| Edit registration (correction) | PATCH /api/registrations/[id] | YES | server-side: created_by_auth_id = auth_user_id |
| Upload screenshot | POST /api/registrations/[id]/screenshot | Optional | No change (existing behavior) |
| Request correction | POST /api/admin/registrations/[id]/approve | YES | requireManager() (existing) |
| Approve/Reject | POST /api/admin/registrations/[id]/approve | YES | requireManager() (existing) |
| Fetch notifications | GET /api/notifications | YES | Filter by user_id = auth_user_id server-side |
| Mark notification read | PATCH /api/notifications/[id]/read | YES | Verify notification.user_id = auth_user_id |

### 6.2 Multi-Person Registration Access

```
Logged-in user: Atul (auth_user_id = X)

Atul registers himself:
  registrations.created_by_auth_id = X
  registrations.player_id = players.id where auth_user_id = X

Atul registers Participant B:
  registrations.created_by_auth_id = X       <-- Atul can view/edit
  registrations.player_id = B_player_id      <-- B's player profile (is_tournament_only=true)
  
Atul registers Participant C:
  registrations.created_by_auth_id = X       <-- Atul can view/edit
  registrations.player_id = C_player_id

Result:
  - GET /api/players/profile for Atul returns ALL THREE registrations
    (WHERE player_id = atul_player_id OR created_by_auth_id = X)
  - Notifications for corrections on B or C go to Atul (created_by_auth_id = X)
  - Only Atul can resubmit corrections for B and C
```

---

*Generated: 2026-10-02. No code changes made.*
