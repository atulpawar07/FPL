# Phase 3 — Requirements Traceability Matrix

**Document Status**: READ-ONLY Planning Document
**Date**: October 2, 2026
**Baseline Audit**: `docs/FPL_COMPLETE_APPLICATION_AUDIT.md`
**Source Authority**: Actual application source code and migration files.

> IMPORTANT: This document is a planning artifact only. No source code, migrations, or production data have been modified.

---

## Classification Legend

| Symbol | Meaning |
|:---:|:---|
| IMPLEMENTED | Evidence exists in current source code |
| PARTIALLY IMPLEMENTED | Some infrastructure exists; critical gap remains |
| NOT IMPLEMENTED | No relevant code exists |
| NEEDS VERIFICATION | Assertion requires runtime or DB-level confirmation |

---

## Requirements Traceability Matrix

| ID | Requirement | Status | Source Evidence | Gap | Proposed Change | DB Change? | API Change? | UI Change? | Tests Needed |
|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|:---|
| REQ-001 | Admin sees every new player registration | IMPLEMENTED | GET /api/admin/dashboard fetches all registrations rows joined to players, payments, tournaments. /admin page renders a queue filtered by registration_type=PLAYER. | None. | No change needed. | No | No | No | Regression: PLAYER rows always appear in dashboard queue. |
| REQ-002 | Admin sees every new owner registration | IMPLEMENTED | Dashboard joins team_owners table. Filter tab shows OWNER/ICON types. approve/route.ts cascades OWNER -> ICON. | None. | No change needed. | No | No | No | Regression: OWNER + ICON rows appear together. |
| REQ-003 | Admin sees complete required participant details | PARTIALLY IMPLEMENTED | Dashboard returns name/role/batting/jersey/image snapshots, contact_email, contact_phone. Missing: admin_remarks field to enter/display. | No admin_remarks column exists. | Add admin_remarks TEXT to registrations table. Surface in admin detail view. | YES | No | YES | Admin view shows all fields + remarks field. |
| REQ-004 | Admin sees payment information | IMPLEMENTED | Dashboard fetches payments (amount, payment_status, payment_method, verification_note). | None. | No change needed. | No | No | No | Regression: payment fields render for all registration types. |
| REQ-005 | Admin sees payment screenshot when available | IMPLEMENTED | GET /api/registrations/[id] generates signed URL from private payment-screenshots bucket using screenshot_object_path. | None. | No change needed. | No | No | No | Regression: signed URL is valid and admin-accessible only. |
| REQ-006 | Admin can approve registration | IMPLEMENTED | POST /api/admin/registrations/[id]/approve with action=APPROVE sets registration_status=CONFIRMED, payment_status=SUCCESSFUL, cascades to siblings, writes audit_logs. | None. | No change needed. | No | No | No | Regression: approval cascades correctly to OWNER+ICON. |
| REQ-007 | Admin can reject registration | IMPLEMENTED | Same route with action=REJECT sets registration_status=REJECTED, payment_status=FAILED. Audit log written. | None. | No change needed. | No | No | No | Regression: rejection does not affect other tournaments. |
| REQ-008 | Admin can request correction | NOT IMPLEMENTED | No CORRECTION_REQUESTED value in registration_status enum (PENDING, CONFIRMED, WAITING_LIST, CANCELLED, REJECTED confirmed in migration 20261011000000). approve/route.ts only handles APPROVE, REJECT, CANCEL, ACKNOWLEDGE_AND_APPROVE. | Entire correction request path is absent. | 1. Add CORRECTION_REQUESTED to registration_status enum. 2. Add action=REQUEST_CORRECTION branch to approve/route.ts. | YES | YES | YES | New: admin selects REQUEST_CORRECTION; status transitions correctly. |
| REQ-009 | Admin can provide correction remark | NOT IMPLEMENTED | No admin_remarks column in registrations table. verificationNote field on payments is not surfaced to users. | No field to store structured correction remark. | Add admin_remarks TEXT column to registrations. Persist remark when action=REQUEST_CORRECTION. | YES | YES | YES | New: remark saved with correction request; returned in registration GET. |
| REQ-010 | Correction request is associated with exact registration | PARTIALLY IMPLEMENTED | registrations.id (UUID) is the canonical PK used in all corrections. approve/route.ts receives registrationId from URL. Gap: no correction state stored against that ID. | Relationship exists; correction state does not. | admin_remarks stored on registrations row keyed by id. No separate table needed. | No new table | No | No | New: remark tied to correct registration_id. |
| REQ-011 | User sees correction notification | NOT IMPLEMENTED | No notifications table exists. No notification created when admin sets correction status. Homepage only shows URL-param banners (?submitted=true). | User has no mechanism to learn a correction was requested. | Create notifications table. Create notification row when admin calls REQUEST_CORRECTION. | YES | YES | YES | New: notification row created; correct user targeted. |
| REQ-012 | User sees notification on homepage | NOT IMPLEMENTED | Homepage (src/app/page.tsx) is a Server Component reading URL params only. No per-user notification fetch occurs. | No homepage notification zone for authenticated users. | Add authenticated notification banner to homepage. Client-side fetch to GET /api/notifications. | No | YES | YES | New: authenticated homepage shows unread notifications and action-required alerts. |
| REQ-013 | User can click notification | NOT IMPLEMENTED | No notification UI component exists anywhere. | No clickable notification element. | Each notification renders a button/link from registration_id. Click navigates to /registration/[id]. | No | No | YES | New: clicking notification navigates to correct registration page. |
| REQ-014 | Notification opens exact registration | PARTIALLY IMPLEMENTED | /registration/[id] page exists and correctly renders data by ID. Gap: page does not display correction state or admin remarks. | Route exists; correction-aware rendering does not. | Extend /registration/[id] to render CORRECTION_REQUESTED banner and admin_remarks. | No | No | YES | New: page renders correction banner when registration_status=CORRECTION_REQUESTED. |
| REQ-015 | User sees admin correction remark | NOT IMPLEMENTED | admin_remarks column does not exist. GET /api/registrations/[id] does not return it. /registration/[id] does not render it. | Completely absent. | 1. Add admin_remarks column. 2. Return it in GET /api/registrations/[id]. 3. Display on correction page. | YES | YES | YES | New: remark visible to correct user; not to other users. |
| REQ-016 | Required fields are identified/highlighted | NOT IMPLEMENTED | No field-level correction tagging exists. | No mechanism to mark specific fields. | Remark-based approach: admin writes free-text remark; UI displays prominently. Optional: correction_fields JSONB for field-level flags. | Optional | No | YES | New: admin remark visibly highlights what needs correction. |
| REQ-017 | User can edit the registration | NOT IMPLEMENTED | /registration/[id] is currently read-only for all statuses. No edit form exists. | User has no edit capability post-submission. | Enable edit mode on /registration/[id] when registration_status=CORRECTION_REQUESTED. Reuse form fields from /register steps. | No | No | YES | New: edit form renders in correction state; unchanged data pre-filled. |
| REQ-018 | User can resubmit corrected registration | NOT IMPLEMENTED | No PATCH /api/registrations/[id] endpoint exists. No resubmission flow exists. | No resubmission path. | Create PATCH /api/registrations/[id] (user-scoped). Updates allowed fields + resets registration_status=PENDING. Creates audit log. | No | YES | YES | New: resubmission updates correct registration; IDOR-protected. |
| REQ-019 | Resubmission returns registration to appropriate admin review state | NOT IMPLEMENTED | No resubmission path exists. | Not implemented. | On resubmit: set registration_status=PENDING, archive admin_remarks to correction_history JSONB. Resolve associated notification. | No | YES | YES | New: admin sees resubmitted registration back in PENDING queue. |
| REQ-020 | Previous registration history is preserved | IMPLEMENTED | registrations rows are never deleted on status change. Snapshot columns are immutable INSERT-time captures. History visible at /profile. | None. | No change to existing behavior. Resubmission edits live row (correct - snapshot reflects state at last submit). | No | No | No | Regression: existing registrations not mutated during Phase 3 work. |
| REQ-021 | User can see total number of tournaments registered | PARTIALLY IMPLEMENTED | /profile shows {registrations.length} Tournaments badge. Only counts by player_id (SELF registrations). | Registrations created for OTHERS (created_by_auth_id) are not counted. | Extend profile API to also count registrations where created_by_auth_id = auth_user_id. | No | YES | YES | New: count includes registrations created on behalf of others. |
| REQ-022 | User can see previous tournament registrations | PARTIALLY IMPLEMENTED | GET /api/players/profile returns registrations with tournament.name, registration_number, status, role, jersey. Missing: payment_status, registration_type, admin_remarks, correction flag, OTHER-created registrations. | Several fields missing from profile history. | Extend profile API to return these fields; update history cards. | No | YES | YES | New: all types and statuses visible in history. |
| REQ-023 | User can see current/recent registration status | PARTIALLY IMPLEMENTED | Status badge exists in /profile history cards. Gap: no CORRECTION_REQUESTED badge; no action-required distinction. | CORRECTION_REQUESTED status not rendered. | Add CORRECTION_REQUESTED badge (amber styling). Highlight row with action-required indicator. | No | No | YES | New: profile shows CORRECTION_REQUESTED badge distinctly. |
| REQ-024 | User can see payment status | PARTIALLY IMPLEMENTED | payments.payment_status is fetched in GET /api/players/profile. Gap: not rendered in profile history cards. | Payment status not displayed in history view. | Add payment status badge to profile history cards. | No | No | YES | New: payment status badge visible per registration. |
| REQ-025 | User can see admin remarks | NOT IMPLEMENTED | admin_remarks column does not exist. Not returned in any API or rendered in any UI. | Completely absent. | Add admin_remarks column; return in profile and registration APIs; display in UI. | YES | YES | YES | New: admin remark visible to correct user. |
| REQ-026 | User can open an individual registration from history | IMPLEMENTED | Profile history cards render View Pass Receipt button navigating to /registration/[id]. | Button label could be clearer; no Correct Now button. | Rename to View Registration. Add Correct Now button when status=CORRECTION_REQUESTED. | No | No | YES | Regression: navigation to correct registration ID works. |
| REQ-027 | User can distinguish PLAYER / OWNER / ICON registrations | PARTIALLY IMPLEMENTED | registration_type stored in registrations table. GET /api/players/profile fetches it but profile page query does not include it in select list. No type badge in profile history UI. | Registration type not surfaced in profile history view. | Add registration_type to profile history query and API response. Add PLAYER/OWNER/ICON badge to each history card. | No | YES | YES | New: PLAYER/OWNER/ICON badge visible per registration. |
| REQ-028 | Owner + Icon relationship remains correct | IMPLEMENTED | team_owners.owner_registration_id and icon_registration_id link both registrations. Admin approval cascades via team_owner_id. allocate_owner_registration_v4 atomically creates both. | None. | No change to existing logic. | No | No | No | Regression: OWNER approval still cascades to ICON. |
| REQ-029 | Payment and registration statuses remain separate | IMPLEMENTED | payments.payment_status and registrations.registration_status are separate columns on separate tables, independently updated. | None. | CORRECTION_REQUESTED must only touch registrations.registration_status; never auto-change payments.payment_status. | No | No | No | New: correction request does not alter payment_status. |
| REQ-030 | Admin actions are audit logged | IMPLEMENTED | logAdminAction() called in approve/route.ts for every approve/reject. audit_logs stores admin_user_id, action, entity_type, entity_id, old_value, new_value. | REQUEST_CORRECTION action not yet logged (does not exist). | Add logAdminAction call for REQUEST_CORRECTION in new correction branch. | No | No | No | New: audit log entry for REQUEST_CORRECTION action. |
| REQ-031 | Correction requests are audit logged | NOT IMPLEMENTED | No REQUEST_CORRECTION action in audit_logs. | Not implemented. | Write audit log with action=REQUEST_REGISTRATION_CORRECTION, old_value={status}, new_value={status:CORRECTION_REQUESTED, admin_remarks}. | No | No | No | New: audit event in /admin/audit-logs after correction request. |
| REQ-032 | User cannot access another user's registration | PARTIALLY IMPLEMENTED | GET /api/registrations/[id] is currently PUBLIC (no auth check). created_by_auth_id stored but not validated on GET. IDOR risk exists especially for edit/resubmit flows. | IDOR risk on edit endpoints. | For PATCH (resubmit), always require created_by_auth_id = auth_user_id server-side. For GET, view-only can remain semi-open (receipt sharing UX); document this decision. | No | YES | No | Security: IDOR test - user B cannot PATCH user A's registration. |
| REQ-033 | Admin/Manager authorization remains server-side | IMPLEMENTED | requireAdmin() and requireManager() are server-side functions calling createServerSupabaseClient() + querying admin_users/managers tables. createAdminClient() uses SERVICE_ROLE_KEY on server only. | None. | All Phase 3 admin endpoints must continue calling requireManager(). | No | No | No | Regression: admin endpoints return 403 without valid session. |
| REQ-034 | Existing FPL registrations remain compatible | IMPLEMENTED | Snapshot columns and existing enum values are backward-compatible. Adding new enum value does not break existing data. | Must use ADD VALUE IF NOT EXISTS and ADD COLUMN IF NOT EXISTS only. | All Phase 3 DB changes: additive-only migrations. No DROP, no RENAME. | No | No | No | Regression: existing confirmed/pending registrations unaffected after migration. |
| REQ-035 | Existing production data remains intact | IMPLEMENTED | Production is live. All records intact in registrations, players, payments, team_owners. | Never modify production directly. | Follow: LOCAL->TEST->BUILD->COMMIT->PUSH->PR->VERCEL PREVIEW->QA->MERGE->PRODUCTION->SMOKE TEST. | No | No | No | Smoke test: all existing registrations accessible after Phase 3 deploy. |

---

## Additional Requirements Discovered from Audit

| ID | Requirement | Status | Evidence | Gap | Proposed Change |
|:---|:---|:---:|:---|:---|:---|
| REQ-036 | Registrations created on behalf of others must appear in creator history | NOT IMPLEMENTED | registrations.created_by_auth_id stores who submitted. GET /api/players/profile only queries WHERE player_id = player.id. | Creator cannot see OTHER registrations they submitted. | Extend GET /api/players/profile to also return WHERE created_by_auth_id = user.id. Deduplicate if SELF. |
| REQ-037 | Notifications must target the correct auth user | NOT IMPLEMENTED | No notifications table exists. | Cannot target notifications. | notifications.user_id must be set to created_by_auth_id on the registration (submitter can correct it). |
| REQ-038 | Admin must not be able to self-approve | NEEDS VERIFICATION | requireManager() validates admin role. Approve route does not check if registration belongs to the admin. | Potential self-approval risk. | Add server-side check: if registration.created_by_auth_id = admin_user.id, reject with 403. |
| REQ-039 | Notifications must be markable as read | NOT IMPLEMENTED | No notification infrastructure exists. | Not applicable yet. | notifications.read_at TIMESTAMPTZ (nullable). NULL = unread. Set via PATCH /api/notifications/[id]/read. |
| REQ-040 | Resubmission must preserve correction history | NOT IMPLEMENTED | No resubmission flow exists. | Design decision needed. | On resubmit: move admin_remarks to correction_history JSONB array [{remark, requested_at, resolved_at}]. Clear active admin_remarks. Preserves audit trail. |

---

## Summary Counts

| Classification | Count |
|:---|:---:|
| IMPLEMENTED | 14 |
| PARTIALLY IMPLEMENTED | 11 |
| NOT IMPLEMENTED | 14 |
| NEEDS VERIFICATION | 1 |
| **Total** | **40** |

---

*Generated: 2026-10-02. Source of truth: actual application source files.*
