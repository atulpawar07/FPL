# Phase 3 — State Machines

**Document Status**: READ-ONLY Planning Document
**Date**: October 2, 2026
**Source Authority**: Actual migration files and source code (not assumptions).

> IMPORTANT: This document is a planning artifact only. No source code, migrations, or production data have been modified.

---

## 1. CURRENT Registration State Machine

### Evidence Source
- Migration: `20260926000000_phase1_registration_status_constraint.sql`
- Migration: `20261011000000_phase2_stabilization_rpc_updates.sql` (RPC casts `v_status::registration_status`)
- Approve route: `src/app/api/admin/registrations/[id]/approve/route.ts` (lines 29-40)

### Current Enum Values (production-confirmed)
```
registration_status:
  PENDING
  CONFIRMED
  WAITING_LIST
  CANCELLED
  REJECTED
```

### Current State Transition Diagram

```
                    [User Submits Registration]
                             |
                             v
                    +------------------+
                    |     PENDING      |  <-- RPC allocate_player_registration_v2
                    +------------------+      or allocate_owner_registration_v4
                             |
             +---------------+---------------+---------------+
             |               |               |               |
             v               v               v               v
     +----------+    +----------+   +-----------+   +-----------+
     | CONFIRMED|    | REJECTED |   | CANCELLED |   |WAITING_LIST|
     +----------+    +----------+   +-----------+   +-----------+
                                                           |
                                                           v
                                                    +----------+
                                                    | PENDING  |  (if promoted from waitlist)
                                                    +----------+
                                                           |
                                                     [continues above]
```

### Current Transition Triggers

| From | To | Trigger | Actor |
|:---|:---|:---|:---|
| (new) | PENDING | allocate_player_registration_v2 RPC (slots available) | System (atomic RPC) |
| (new) | WAITING_LIST | allocate_player_registration_v2 RPC (capacity full) | System (atomic RPC) |
| PENDING | CONFIRMED | action=APPROVE in approve/route.ts | Admin/Manager |
| PENDING | REJECTED | action=REJECT in approve/route.ts | Admin/Manager |
| PENDING | CANCELLED | action=CANCEL in approve/route.ts | Admin/Manager |
| WAITING_LIST | CONFIRMED | Promotion logic (manual or automated) | Admin/System |

### Current Limitations
- No way to send a registration back to the user for correction.
- No distinction between "new pending" and "resubmitted pending."
- Admin remark cannot be associated with any status.

---

## 2. CURRENT Payment State Machine

### Evidence Source
- Migration: `20260927000000_phase1_payment_status_constraint.sql`
- Migration: `20261009000000_phase2_organiser_acknowledgement_payment.sql`
- Approve route: lines 31-40, payments update block (lines 124-156)

### Current Payment Enum Values (production-confirmed)
```
payment_status:
  CREATED
  PENDING
  PROCESSING
  AWAITING_ORGANISER_ACKNOWLEDGEMENT
  SUCCESSFUL
  FAILED
  REFUNDED
  CANCELLED
```

### Current Payment State Diagram

```
                    [Registration created]
                             |
                             v
                    +------------------+
                    |     PENDING      |  <-- RPC inserts payment record
                    +------------------+
                      |             |
         [UPI payment] |             | [ACKNOWLEDGE_BY_ORGANISER]
                       |             v
                       |   +----------------------------+
                       |   | AWAITING_ORGANISER_ACKNOWLEDGEMENT |
                       |   +----------------------------+
                       |             |
                       +-------------+
                             |
                    [Admin verifies]
                      |             |
                      v             v
             +----------+       +----------+
             | SUCCESSFUL|      |  FAILED  |
             +----------+       +----------+
                  |                  |
         [Registration -> CONFIRMED]  [Registration -> REJECTED]
```

### Payment Transitions (Current)

| From | To | Trigger |
|:---|:---|:---|
| (new) | PENDING | RPC creates payment record |
| PENDING | AWAITING_ORGANISER_ACKNOWLEDGEMENT | payment_method=ACKNOWLEDGE_BY_ORGANISER |
| PENDING | AWAITING_ORGANISER_ACKNOWLEDGEMENT | User uploads screenshot (screenshot route) |
| AWAITING_ORGANISER_ACKNOWLEDGEMENT | SUCCESSFUL | action=APPROVE or ACKNOWLEDGE_AND_APPROVE |
| AWAITING_ORGANISER_ACKNOWLEDGEMENT | FAILED | action=REJECT |
| PENDING | FAILED | action=REJECT (direct) |
| PENDING | REFUNDED | action=CANCEL |

---

## 3. PROPOSED PHASE 3 Registration State Machine

### Design Decision: Where Does CORRECTION_REQUESTED Fit?

**Option A**: Make CORRECTION_REQUESTED a registration_status enum value.
**Option B**: Add a separate correction_status column (NONE / CORRECTION_REQUESTED / RESOLVED).
**Option C**: Use a separate action_required boolean flag.

### Recommended: Option A — Registration Status Extension

**Rationale:**
1. The existing state machine is already enum-driven. All UI, API, and RPC logic reads `registration_status`.
2. Adding CORRECTION_REQUESTED as a status integrates naturally with existing badge rendering, filter tabs, and dashboard queries.
3. A separate column would require changes in MORE places (every query, every filter, every export).
4. The correction is a meaningful lifecycle state — not just a flag — because it blocks final confirmation until resolved.
5. Existing additive migration pattern (`ALTER TYPE ... ADD VALUE IF NOT EXISTS`) safely extends the enum.

### Proposed Enum (Phase 3)
```
registration_status:
  PENDING                  (existing)
  CONFIRMED                (existing)
  WAITING_LIST             (existing)
  CANCELLED                (existing)
  REJECTED                 (existing)
  CORRECTION_REQUESTED     (NEW - Phase 3A)
```

### Proposed Registration State Diagram

```
                    [User Submits Registration]
                             |
                             v
                    +------------------+
                    |     PENDING      |  <-- Initial state from RPC
                    +------------------+
                      |      |       |
             [Approve] |      |       | [Reject]
                       |      |       |
                       v      v       v
               +--------+  [Cancel] +--------+
               |CONFIRMED|           |REJECTED|
               +--------+  +--------++--------+
                            |CANCELLED|
                            +---------+
                       ^
                       |
              +------------------+
              |WAITING_LIST       |
              +------------------+
                       |
              [Promoted when slot opens]

     -------  CORRECTION FLOW (NEW)  -------

                    PENDING
                       |
              [Admin: REQUEST_CORRECTION + remark]
                       |
                       v
             +--------------------+
             | CORRECTION_REQUESTED|  <-- admin_remarks set on registrations row
             +--------------------+
                       |
              [User edits + resubmits]
                       |
                       v
                    PENDING          <-- back to standard review queue
                                         correction_history preserves old remark
                       |
                [Admin reviews again]
                  |            |
                  v            v
             CONFIRMED       REJECTED
```

### Correction State Transition Rules

| From | To | Trigger | Actor | Side Effects |
|:---|:---|:---|:---|:---|
| PENDING | CORRECTION_REQUESTED | action=REQUEST_CORRECTION in approve route | Admin/Manager | Set admin_remarks, create notifications row, write audit log |
| CORRECTION_REQUESTED | PENDING | PATCH /api/registrations/[id] (resubmit) | User (auth, created_by_auth_id check) | Clear admin_remarks (move to correction_history), resolve notification, write audit log |
| CORRECTION_REQUESTED | REJECTED | action=REJECT (admin can still reject) | Admin/Manager | Write audit log |
| CORRECTION_REQUESTED | CONFIRMED | action=APPROVE (rare but allowed) | Admin/Manager | Write audit log |

### Critical Guards
- CORRECTION_REQUESTED can only be set by Admin/Manager (server-side).
- Only the original submitter (created_by_auth_id) can resubmit.
- Resubmission resets to PENDING (not directly to CONFIRMED).
- Admin must review again from PENDING state.

---

## 4. PROPOSED PHASE 3 Payment State Machine

### Design Principle: Payment Statuses MUST Remain Independent

The correction flow does NOT automatically change `payment_status`. Payment and registration are separate lifecycles.

### How Correction Interacts with Payment

```
Scenario A: Payment already uploaded (screenshot submitted)

  registration_status: PENDING (awaiting admin review)
  payment_status: AWAITING_ORGANISER_ACKNOWLEDGEMENT

  Admin reviews, finds payment screenshot unreadable.
  Admin clicks [Request Correction] with remark.

  Result:
    registration_status: CORRECTION_REQUESTED
    payment_status: AWAITING_ORGANISER_ACKNOWLEDGEMENT  <-- UNCHANGED

  User receives notification.
  User opens registration, sees remark.
  User re-uploads screenshot (same screenshot upload endpoint).
  User resubmits.

  Result:
    registration_status: PENDING
    payment_status: AWAITING_ORGANISER_ACKNOWLEDGEMENT  <-- UNCHANGED (still needs admin verify)

  Admin reviews again, verifies screenshot.
  Admin approves.

  Result:
    registration_status: CONFIRMED
    payment_status: SUCCESSFUL


Scenario B: Registration data incorrect (not payment)

  registration_status: PENDING
  payment_status: PENDING (user has not paid yet)

  Admin sees missing jersey number or other data issue.
  Admin clicks [Request Correction].

  Result:
    registration_status: CORRECTION_REQUESTED
    payment_status: PENDING  <-- UNCHANGED

  User edits data, resubmits.

  Result:
    registration_status: PENDING
    payment_status: PENDING  <-- UNCHANGED

  User can then proceed to upload payment.
  Admin reviews and approves.
```

### Payment State Machine (Phase 3 — No Changes to Enum)

```
No new payment_status values are required for Phase 3.
The existing payment_status enum is sufficient.

PENDING -> AWAITING_ORGANISER_ACKNOWLEDGEMENT -> SUCCESSFUL / FAILED
                                                remains unchanged.

The correction flow is entirely on the registration_status side.
```

---

## 5. Owner / Icon Correction State Handling

### Current Behavior
Owner registration approval CASCADES to the linked Icon registration via `team_owner_id` (approve/route.ts lines 70-122).

### Proposed Phase 3 Behavior for Corrections

**Design Decision: Atomic Correction for OWNER registrations.**

When admin requests correction on an OWNER registration:
1. Set `registration_status = CORRECTION_REQUESTED` on the OWNER registration row.
2. Do NOT cascade `CORRECTION_REQUESTED` to the ICON registration (Icon details may be fine).
3. The notification targets the `created_by_auth_id` of the OWNER registration.
4. When user resubmits OWNER registration, only OWNER row returns to PENDING.
5. Admin reviews OWNER again.
6. Final APPROVE cascades OWNER + ICON to CONFIRMED (existing behavior preserved).

**Rationale**: Correction is about registration data accuracy, not team structure. Cascading CORRECTION_REQUESTED to ICON would be confusing and may block the Icon unnecessarily.

---

## 6. Notification Lifecycle

```
[Admin: REQUEST_CORRECTION]
          |
          v
  Notification Created
  {
    user_id: registration.created_by_auth_id,
    type: CORRECTION_REQUIRED,
    registration_id: registration.id,
    read_at: NULL,
    created_at: NOW()
  }
          |
     [User logs in]
          |
     Homepage shows notification banner
          |
     [User clicks notification]
          |
     Navigate to /registration/[registration_id]
          |
     Page shows CORRECTION_REQUESTED banner + admin_remarks
          |
     [User edits + resubmits]
          |
     notification.read_at = NOW()  (mark read on resubmit or explicit read)
     registration_status = PENDING
```

---

*Generated: 2026-10-02. Source: actual migration files and route handlers.*
