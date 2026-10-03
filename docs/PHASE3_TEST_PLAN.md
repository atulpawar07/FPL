# Phase 3 — Test Plan

**Document Status**: READ-ONLY Planning Document
**Date**: October 2, 2026
**Test Framework**: Vitest v3.0.5 (existing, 177 passing tests baseline)

> IMPORTANT: This document is a planning artifact only. No source code, migrations, or tests have been created.

---

## 1. Baseline Preservation

All 177 existing tests must pass before AND after Phase 3 implementation.

| Suite | Test Count | Scope |
|:---|:---:|:---|
| gate2a-owner-as-player.test.ts | 23 | Owner capacity & RPC allocation |
| gate2b-storage-security.test.ts | 14 | Storage bucket policies & magic bytes |
| gate3r2-payment-security.test.ts | 18 | Payment verification security |
| gate3r3-authorization-security.test.ts | 17 | Admin & manager authorization |
| delete-tournament-security.test.ts | 6 | Tournament cascade deletion |
| upi-payment-experience.test.ts | 6 | Payment UX & UPI URI building |
| (other suites) | ~93 | Various |

---

## 2. Phase 3 New Test Requirements

### 2.1 Admin Correction Workflow Tests

**File**: `src/tests/phase3-correction-admin.test.ts` (to be created in Phase 3B)

| Test ID | Test Case | Expected Result |
|:---|:---|:---|
| P3-ADM-001 | Admin calls REQUEST_CORRECTION with valid remark on PENDING registration | registration_status = CORRECTION_REQUESTED, admin_remarks = remark |
| P3-ADM-002 | Admin calls REQUEST_CORRECTION without remark | Returns 400 validation error |
| P3-ADM-003 | Admin calls REQUEST_CORRECTION on CONFIRMED registration | Returns 400 (invalid state transition) |
| P3-ADM-004 | Admin calls REQUEST_CORRECTION on REJECTED registration | Returns 400 (invalid state transition) |
| P3-ADM-005 | Admin calls APPROVE on CORRECTION_REQUESTED registration | registration_status = CONFIRMED (edge case — admin can bypass) |
| P3-ADM-006 | Admin calls REJECT on CORRECTION_REQUESTED registration | registration_status = REJECTED |
| P3-ADM-007 | REQUEST_CORRECTION writes audit log entry with correct action name | audit_logs row with action = REQUEST_REGISTRATION_CORRECTION |
| P3-ADM-008 | REQUEST_CORRECTION creates notifications row for correct user | notifications.user_id = registrations.created_by_auth_id |
| P3-ADM-009 | REQUEST_CORRECTION does NOT change payment_status | payment_status remains unchanged before and after |
| P3-ADM-010 | Manager (not admin) can call REQUEST_CORRECTION | Returns 200 (requireManager() allows) |
| P3-ADM-011 | Unauthenticated user cannot call REQUEST_CORRECTION | Returns 401 |
| P3-ADM-012 | Admin cannot self-approve (REQ-038) | Returns 403 if registration.created_by_auth_id = admin_user_id |

### 2.2 User Correction & Resubmission Tests

**File**: `src/tests/phase3-correction-user.test.ts` (to be created in Phase 3C)

| Test ID | Test Case | Expected Result |
|:---|:---|:---|
| P3-USR-001 | User resubmits CORRECTION_REQUESTED registration with valid data | registration_status = PENDING, admin_remarks = NULL (cleared) |
| P3-USR-002 | User resubmits registration belonging to another user (IDOR) | Returns 403 |
| P3-USR-003 | Unauthenticated user calls PATCH /api/registrations/[id] | Returns 401 |
| P3-USR-004 | User resubmits registration in PENDING status (not CORRECTION_REQUESTED) | Returns 400 (invalid state) |
| P3-USR-005 | User resubmits registration in CONFIRMED status | Returns 400 (cannot edit confirmed registration) |
| P3-USR-006 | Resubmission increments resubmission_count | resubmission_count increases by 1 |
| P3-USR-007 | Resubmission archives old admin_remarks to correction_history | correction_history JSONB array has one entry with old remark |
| P3-USR-008 | Resubmission writes RESUBMIT_REGISTRATION audit log entry | audit_logs row with correct user and registration IDs |
| P3-USR-009 | Resubmission marks associated notification as read | notification.read_at is set to NOW() |
| P3-USR-010 | Multiple corrections cycle correctly (PENDING -> CORRECTION_REQUESTED -> PENDING -> CORRECTION_REQUESTED -> PENDING) | State transitions correct each time; correction_history grows |
| P3-USR-011 | User who created registration for OTHER (is_tournament_only) can resubmit | created_by_auth_id match allows PATCH |
| P3-USR-012 | Resubmission does NOT change payment_status | payment_status unchanged after resubmit |

### 2.3 Notification System Tests

**File**: `src/tests/phase3-notifications.test.ts` (to be created in Phase 3D)

| Test ID | Test Case | Expected Result |
|:---|:---|:---|
| P3-NOT-001 | GET /api/notifications returns only the auth user's notifications | Other users' notifications not included |
| P3-NOT-002 | Unread notification count is correct | unreadCount matches rows where read_at IS NULL |
| P3-NOT-003 | Unauthenticated GET /api/notifications returns 401 | 401 returned |
| P3-NOT-004 | PATCH /api/notifications/[id]/read marks notification read | notification.read_at is set |
| P3-NOT-005 | PATCH /api/notifications/[id]/read for another user's notification returns 403 | IDOR protection verified |
| P3-NOT-006 | Notification.registration_id correctly links to the triggering registration | JOIN works; URL derivable from ID |
| P3-NOT-007 | Creating a correction request creates exactly one notification | Not duplicated |
| P3-NOT-008 | Notification has correct type = CORRECTION_REQUIRED | Type field is correct |
| P3-NOT-009 | Multiple corrections for same registration create multiple notifications | Each correction gets a new notification |
| P3-NOT-010 | Deleting a registration cascades to delete notification (ON DELETE CASCADE) | notification row removed |

### 2.4 User Registration History Tests

**File**: `src/tests/phase3-registration-history.test.ts` (to be created in Phase 3E)

| Test ID | Test Case | Expected Result |
|:---|:---|:---|
| P3-HIST-001 | GET /api/players/profile returns SELF registrations | player_id match found |
| P3-HIST-002 | GET /api/players/profile returns OTHER-created registrations | created_by_auth_id match found |
| P3-HIST-003 | No duplicate registrations if user registered SELF | SELF registration appears once |
| P3-HIST-004 | registration_type (PLAYER/OWNER/ICON) included in response | Field present in each registration object |
| P3-HIST-005 | admin_remarks included in response for CORRECTION_REQUESTED registrations | Remark visible to correct user |
| P3-HIST-006 | admin_remarks NOT included for other users' registrations | Field absent or null for non-owner user |
| P3-HIST-007 | payment_status included in profile registrations response | payment_status field present |
| P3-HIST-008 | Total tournament count (including OTHER-created) is correct | Count matches combined SELF + OTHER |

### 2.5 Player Registration (PLAYER) Correction Flow — End to End

**File**: `src/tests/phase3-e2e-player-correction.test.ts`

| Test ID | Test Case | Expected Result |
|:---|:---|:---|
| P3-E2E-PLY-001 | New player registration -> PENDING | Correct state |
| P3-E2E-PLY-002 | Admin reviews -> REQUEST_CORRECTION | CORRECTION_REQUESTED state; notification created |
| P3-E2E-PLY-003 | User sees notification | GET /api/notifications returns 1 unread |
| P3-E2E-PLY-004 | User opens /registration/[id] | admin_remarks in response |
| P3-E2E-PLY-005 | User edits and resubmits | PENDING state; notification resolved |
| P3-E2E-PLY-006 | Admin sees registration back in PENDING queue | Dashboard shows registration in PENDING |
| P3-E2E-PLY-007 | Admin approves final | CONFIRMED; SUCCESSFUL payment |

### 2.6 Owner Registration Correction Flow — End to End

**File**: `src/tests/phase3-e2e-owner-correction.test.ts`

| Test ID | Test Case | Expected Result |
|:---|:---|:---|
| P3-E2E-OWN-001 | Owner registration creates OWNER + ICON registrations | Both PENDING |
| P3-E2E-OWN-002 | Admin requests correction on OWNER registration | Only OWNER becomes CORRECTION_REQUESTED; ICON stays PENDING |
| P3-E2E-OWN-003 | Notification goes to OWNER's created_by_auth_id | Correct user notified |
| P3-E2E-OWN-004 | User resubmits OWNER registration | OWNER returns to PENDING; ICON unchanged |
| P3-E2E-OWN-005 | Admin approves OWNER registration | OWNER + ICON both become CONFIRMED (cascade preserved) |
| P3-E2E-OWN-006 | Payment for OWNER+ICON marked SUCCESSFUL on approval | Combined payment updated |
| P3-E2E-OWN-007 | Icon correction (if admin targets ICON directly) | ICON becomes CORRECTION_REQUESTED; OWNER unchanged |

### 2.7 Payment Correction Flow

| Test ID | Test Case | Expected Result |
|:---|:---|:---|
| P3-PAY-001 | Payment screenshot upload after correction request | Screenshot upload endpoint still works; payment_status unchanged |
| P3-PAY-002 | Admin requests correction for payment issue | registration_status = CORRECTION_REQUESTED; payment_status = unchanged |
| P3-PAY-003 | User re-uploads screenshot after correction | Screenshot saved; payment_status = AWAITING_ORGANISER_ACKNOWLEDGEMENT |
| P3-PAY-004 | Admin verifies payment after resubmission | payment_status = SUCCESSFUL |
| P3-PAY-005 | Payment cannot be auto-confirmed by client | 403 if client tries to set payment_status = SUCCESSFUL |

### 2.8 Security Tests

| Test ID | Test Case | Expected Result |
|:---|:---|:---|
| P3-SEC-001 | User cannot PATCH another user's registration | 403 |
| P3-SEC-002 | User cannot read another user's notification | notification not in response |
| P3-SEC-003 | User cannot approve their own registration | 403 (REQ-038) |
| P3-SEC-004 | Manager cannot access admin-only routes | 403 on requireAdmin() routes |
| P3-SEC-005 | Admin role requires active admin_users record | Deactivated admin gets 403 |
| P3-SEC-006 | Notification.user_id validated server-side before read | IDOR attempt returns 403 |
| P3-SEC-007 | Correction history JSONB not overwritable by user | PATCH endpoint does not accept correction_history in body |
| P3-SEC-008 | resubmission_count not settable by user | PATCH endpoint ignores resubmission_count in body |
| P3-SEC-009 | admin_remarks not settable by user via PATCH | Only admin route sets admin_remarks |
| P3-SEC-010 | CORRECTION_REQUESTED state not settable by user | Only admin route transitions to CORRECTION_REQUESTED |

### 2.9 Regression Tests

| Test ID | Test Case | Expected Result |
|:---|:---|:---|
| P3-REG-001 | All existing player registrations still accessible after migration | GET /api/registrations/[id] works for all existing IDs |
| P3-REG-002 | All existing payments intact after migration | payments table unmodified |
| P3-REG-003 | Existing CONFIRMED registrations not affected by Phase 3 | No status change for already-approved records |
| P3-REG-004 | OWNER approval cascade still works (existing behavior) | OWNER + ICON both CONFIRMED on approval |
| P3-REG-005 | Existing audit logs readable | /admin/audit-logs still renders existing entries |
| P3-REG-006 | Storage bucket policies unchanged | payment-screenshots still private |
| P3-REG-007 | allocate_player_registration_v2 RPC unmodified | New player registration still works |
| P3-REG-008 | allocate_owner_registration_v4 RPC unmodified | New owner registration still works |
| P3-REG-009 | Profile page still shows correct tournament count | {registrations.length} badge correct |
| P3-REG-010 | Admin can still approve/reject (existing flows) | approve/reject unchanged |

---

## 3. Test Phases

| Phase | When | Tests to Run |
|:---|:---|:---|
| Phase 3A (DB migration) | After enum + column additions | P3-REG-001 through P3-REG-010 |
| Phase 3B (Admin correction) | After admin API + UI | P3-ADM-001 through P3-ADM-012 + regression |
| Phase 3C (User resubmit) | After PATCH endpoint | P3-USR-001 through P3-USR-012 + regression |
| Phase 3D (Notifications) | After notifications table + API | P3-NOT-001 through P3-NOT-010 |
| Phase 3E (History) | After profile API updates | P3-HIST-001 through P3-HIST-008 |
| Phase 3F (Homepage) | After homepage integration | Manual QA: notification banner visible |
| Phase 3G (Security) | Full security pass | P3-SEC-001 through P3-SEC-010 |
| Phase 3H (E2E) | All phases complete | P3-E2E-PLY + P3-E2E-OWN + P3-PAY |

---

## 4. Manual QA Checklist (Browser)

- [ ] Authenticated user logs in; sees notification banner on homepage if correction exists.
- [ ] Clicking notification navigates to correct /registration/[id].
- [ ] CORRECTION_REQUESTED banner and admin_remarks visible on registration page.
- [ ] Edit form fields are pre-filled with existing registration data.
- [ ] Submit button changes to "Resubmit for Review".
- [ ] After resubmit, notification banner disappears or shows "resolved".
- [ ] Admin dashboard shows resubmitted registration in PENDING queue.
- [ ] Profile page shows PLAYER/OWNER/ICON badge per registration.
- [ ] Profile page shows payment status per registration.
- [ ] Profile page shows "Correct Now" button for CORRECTION_REQUESTED registrations.
- [ ] Admin sees admin_remarks he entered when re-reviewing a resubmitted registration.

---

*Generated: 2026-10-02. No tests have been created yet.*
