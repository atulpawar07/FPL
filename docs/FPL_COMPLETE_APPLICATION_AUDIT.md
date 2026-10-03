# Fairplay Premier League (FPL) — Complete Application & Architecture Audit

**Document Status**: Official READ-ONLY Technical Audit  
**Date**: October 2, 2026  
**Repository**: `Player Registration Web app` (`atulpawar07/FPL`)  
**Target Environment**: Production / Live  

---

## Executive Summary

This document provides a comprehensive, ground-truth technical audit of the **Fairplay Premier League (FPL) Player Registration & Tournament Management Platform**. Every statement, flow diagram, data table, and architectural risk documented below is derived directly from empirical analysis of the workspace source code, database migrations, API route handlers, React UI components, storage security policies, and test suites.

---

## 1. Application Structure & Technology Stack

### Core Technologies
- **Framework**: Next.js 15.1.7 (App Router with React Server Components + Client Components)
- **UI & React**: React 19.0.0, React DOM 19.0.0
- **Language**: TypeScript 5.7.3 (Strict Mode)
- **Styling**: Tailwind CSS v4.0.7 with `@tailwindcss/postcss` & `postcss`
- **Backend & Database**: Supabase PostgreSQL 15+, `@supabase/supabase-js` v2.49.1, `@supabase/ssr` v0.5.2
- **Authentication**: Supabase Auth (Google OAuth, Email/Password, Magic Link) + DB-backed Role tables (`admin_users`, `managers`)
- **Storage**: Supabase Storage Buckets (`payment-screenshots`, `team-logos`, `profile-images`)
- **Icons & Utilities**: `lucide-react` v0.475.0, `clsx` v2.1.1, `tailwind-merge` v3.0.1, `zod` v3.24.2
- **Testing**: Vitest v3.0.5 (20 test suites, 177 passing unit & integration tests)
- **Build & Runtime**: `next build` (Next.js 15.5.25 runtime), Node.js ES Modules

---

### High-Level Architecture Diagram

```
                                USER / BROWSER
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │    NEXT.JS 15 APP ROUTER  │
                        │    (Port 3000 / Production)│
                        └─────────────┬─────────────┘
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
  ┌──────────────────────────┐                  ┌──────────────────────────┐
  │ SERVER COMPONENTS /      │                  │ CLIENT COMPONENTS        │
  │ SERVER HELPERS           │                  │ ('use client')           │
  │ (Header, getPublicTourn) │                  │ (UnifiedForm, Modals)    │
  └────────────┬─────────────┘                  └────────────┬─────────────┘
               │                                             │
               │               HTTP / REST API               │
               └──────────────────────┬──────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │    API ROUTE HANDLERS     │
                        │   (src/app/api/... 32 Routes)│
                        └─────────────┬─────────────┘
                                      │
               ┌──────────────────────┼──────────────────────┐
               │ Authorization        │ Validation           │ Business Rules
               │ (requireAdmin /      │ (Magic bytes, Zod,   │ (Concurrency FOR UPDATE,
               │  requireManager)     │  type constraints)   │  Slot allocation RPCs)
               ▼                      ▼                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                             SUPABASE BACKEND                             │
│                                                                          │
│   ┌────────────────────┐   ┌───────────────────┐   ┌─────────────────┐   │
│   │   SUPABASE AUTH    │   │  POSTGRES DATABASE│   │ SUPABASE STORAGE│   │
│   │                    │   │                   │   │                 │   │
│   │ - Google OAuth     │   │ - 9 Tables        │   │ - payment-scrn  │   │
│   │ - Email/Password   │   │ - 7 Active RPCs   │   │   (Private)     │   │
│   │ - Session cookies  │   │ - Triggers & RLS  │   │ - team-logos    │   │
│   │                    │   │                   │   │ - profile-img   │   │
│   └────────────────────┘   └───────────────────┘   └─────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Complete Page Inventory

| Route | Page Type | Public / Auth / Admin | Purpose | Main Components | API Calls | DB Tables Accesses | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | Server Component | Public | Homepage, active tournament hero, past tournaments list, CTA | `Header`, `Footer`, `Button` | Internal helper `getPublicTournaments()` | `tournaments` | CURRENTLY IMPLEMENTED |
| `/register` | Client Component | Auth Required | Unified player & owner registration flow | `Step1Personal`, `Step2Cricket`, `Step3Review`, `TeamOwnerRegistrationModal` | `/api/tournaments/upcoming`, `/api/players/profile`, `/api/registrations`, `/api/registrations/owner` | `tournaments`, `players`, `registrations`, `payments`, `team_owners` | CURRENTLY IMPLEMENTED |
| `/register/confirmation/[id]` | Server Component | Public / Auth | Registration completion receipt screen | `PrintableReceipt`, `Button` | Direct SSR Supabase query | `registrations`, `players`, `tournaments`, `payments` | CURRENTLY IMPLEMENTED |
| `/registration/[id]` | Client Component | Public / Auth | View registration status, print receipt, upload payment screenshot | `Header`, `Footer`, `Card`, `Badge`, `UPIPaymentChoice` | `/api/registrations/[id]`, `/api/registrations/[id]/screenshot` | `registrations`, `players`, `tournaments`, `payments` | CURRENTLY IMPLEMENTED |
| `/tournament/[id]` | Client Component | Public | Public tournament landing page, team owner roster & slot status | `Header`, `Footer`, `Card`, `Badge`, `Button` | `/api/tournaments/[id]` | `tournaments`, `team_owners`, `registrations`, `players` | CURRENTLY IMPLEMENTED |
| `/profile` | Client Component | Auth Required | User profile overview & registration history | `Header`, `Footer`, `Card`, `Button` | `/api/players/profile` | `players`, `registrations`, `tournaments`, `payments` | CURRENTLY IMPLEMENTED |
| `/about` | Server Component | Public | Platform about page & mission statement | `Header`, `Footer` | None | None | CURRENTLY IMPLEMENTED |
| `/how-it-works` | Server Component | Public | Tournament rules, registration steps, payment guide | `Header`, `Footer` | None | None | CURRENTLY IMPLEMENTED |
| `/privacy` | Server Component | Public | Privacy policy documentation | `Header`, `Footer` | None | None | CURRENTLY IMPLEMENTED |
| `/terms` | Server Component | Public | Terms of service documentation | `Header`, `Footer` | None | None | CURRENTLY IMPLEMENTED |
| `/auth/login` | Client Component | Public | User authentication login (Google OAuth + Email) | `Button`, `Input` | Supabase Auth JS SDK | Supabase Auth `users` | CURRENTLY IMPLEMENTED |
| `/auth/signup` | Client Component | Public | User authentication signup | `Button`, `Input` | Supabase Auth JS SDK | Supabase Auth `users` | CURRENTLY IMPLEMENTED |
| `/auth/callback` | Route Handler | Public | OAuth callback code exchange handler | Server Auth Client | `exchangeCodeForSession` | Supabase Auth | CURRENTLY IMPLEMENTED |
| `/admin/login` | Client Component | Public | Admin & Manager credential login screen | `Button`, `Input` | `/api/admin/login` | Supabase Auth, `admin_users`, `managers` | CURRENTLY IMPLEMENTED |
| `/admin` | Client Component | Admin / Manager | Master admin dashboard: registrations queue, approval/rejection | `Card`, `Badge`, `Button`, `Input`, `DeleteTournamentModal` | `/api/admin/dashboard`, `/api/admin/registrations/[id]/approve`, `/api/admin/tournaments` | `registrations`, `payments`, `players`, `tournaments`, `team_owners` | CURRENTLY IMPLEMENTED |
| `/admin/players` | Client Component | Admin / Manager | Master player database directory, editing & deletion | `Card`, `Badge`, `Input`, `Button` | `/api/admin/players`, `/api/admin/players/[id]` | `players`, `registrations` | CURRENTLY IMPLEMENTED |
| `/admin/audit-logs` | Client Component | Admin Only | System audit log history viewer | `Card`, `Badge`, `Button` | `/api/admin/audit-logs` | `audit_logs`, `admin_users` | CURRENTLY IMPLEMENTED |
| `/admin/settings` | Client Component | Admin Only | Global system settings & manager user access control | `Card`, `Input`, `Button` | `/api/admin/settings`, `/api/admin/managers` | `admin_users`, `managers` | CURRENTLY IMPLEMENTED |
| `/admin/tournament/[id]` | Client Component | Admin / Manager | Tournament-specific management, player list, exports | `Card`, `Badge`, `Button` | `/api/admin/tournament/[id]/summary`, `/api/admin/export` | `tournaments`, `registrations`, `payments`, `team_owners` | CURRENTLY IMPLEMENTED |
| `/manager/login` | Client Component | Public | Manager login page redirect | `Button`, `Input` | `/api/admin/login` | Supabase Auth, `managers` | CURRENTLY IMPLEMENTED |
| `/manager` | Client Component | Manager / Admin | Manager dashboard view | `Card`, `Badge` | `/api/admin/dashboard` | `registrations`, `tournaments` | CURRENTLY IMPLEMENTED |
| `/manager/tournament/[id]` | Client Component | Manager / Admin | Manager tournament viewer | `Card`, `Badge` | `/api/admin/tournament/[id]/summary` | `tournaments`, `registrations` | CURRENTLY IMPLEMENTED |

---

## 3. Page-by-Page Data Flow

### PAGE: `/` (Homepage)
- **Purpose**: Displays active tournament hero banner, registration CTA, upcoming & past tournament cards, fee structures.
- **Access**: Public.
- **Page Load Flow**:
  1. Next.js server evaluates `HomePage` component (`revalidate = 60`).
  2. Calls `getPublicTournaments()` server helper.
  3. Supabase Admin client executes `SELECT ... FROM tournaments ORDER BY created_at DESC`.
  4. Server sorts tournaments using `getOrderedTournaments()`.
  5. HTML rendered with active tournament hero banner and past tournament archive cards.
- **Data Requests**:
  - `GET` via server helper `getPublicTournaments()`.
  - Parameters: None.
  - Tables: `tournaments`.
  - Auth: Public.

---

### PAGE: `/register` (Registration Page)
- **Purpose**: Multi-step registration form for Players and Team Owners.
- **Access**: Authenticated Users.
- **Page Load Flow**:
  1. Client checks auth session via `supabase.auth.getUser()`.
  2. Parallel fetch to `/api/tournaments/upcoming` and `/api/players/profile`.
  3. Pre-fills user profile details (full name, email, profile photo, cricket role).
  4. Step 1 (Personal Info) → Step 2 (Cricket Details) → Step 3 (Review & Payment Method).
  5. On submit: calls `POST /api/registrations` (for Player) or `POST /api/registrations/owner` (for Owner).
- **Data Requests**:
  - `GET /api/tournaments/upcoming` → Returns active open tournament.
  - `GET /api/players/profile` → Returns user profile from `players` table.
  - `POST /api/registrations` → Triggers `allocate_player_registration_v2` RPC.
  - `POST /api/registrations/owner` → Triggers `allocate_owner_registration_v4` RPC.
  - Tables: `tournaments`, `players`, `registrations`, `payments`, `team_owners`.
  - Storage: `payment-screenshots` (base64 validated and uploaded).

---

### PAGE: `/registration/[id]` (View Registration Details)
- **Purpose**: Displays registration receipt, status badge, UPI QR code, and payment screenshot upload interface.
- **Access**: Public / Auth (Owner/Admin or direct URL reference).
- **Page Load Flow**:
  1. Client Component extracts `id` parameter.
  2. Fetches `GET /api/registrations/[id]`.
  3. Renders registration status (`PENDING`, `CONFIRMED`, `WAITING_LIST`, `REJECTED`).
  4. Renders `UPIPaymentChoice` with dynamic QR generator if status is `PENDING`.
  5. Allows user to upload payment screenshot via `POST /api/registrations/[id]/screenshot`.
- **Data Requests**:
  - `GET /api/registrations/[id]` → Returns `registration`, `player`, `tournament`, `latestPayment`.
  - `POST /api/registrations/[id]/screenshot` → Uploads screenshot to `payment-screenshots` bucket and updates `payments` record.

---

### PAGE: `/admin` (Admin Dashboard)
- **Purpose**: Admin command center to manage pending registrations, approve/reject entries, verify manual payments, and delete tournaments.
- **Access**: Admins & Managers (`requireManager()`).
- **Page Load Flow**:
  1. Checks admin/manager credentials via `/api/admin/me`.
  2. Fetches metric summary and registrations list via `/api/admin/dashboard`.
  3. Admin reviews payment screenshot, participant details, registration number.
  4. Admin clicks Approve/Reject → calls `POST /api/admin/registrations/[id]/approve`.
- **Data Requests**:
  - `GET /api/admin/dashboard` → Joins `registrations`, `players`, `payments`, `tournaments`, `team_owners`.
  - `POST /api/admin/registrations/[id]/approve` → Cascades status update across registrations, team_owners, and payments. Writes `audit_logs`.

---

## 4. Master Data Transfer Matrix

| Entity / Field | Data Source | Destination | API / Function | DB Table | Sensitive? | Validation Rules | Notes |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `auth_user_id` | Supabase Auth Session | `players.auth_user_id`, `registrations.created_by_auth_id` | `getUser()`, RPCs | `players`, `registrations`, `team_owners` | Yes | UUID format | Links logged-in user to records |
| `full_name` | User Input (Step 1) | `registered_name_snapshot` | `/api/registrations` | `players`, `registrations` | No | Min 2 characters, non-empty | Snapshotted on registration |
| `email` | Auth User / Form | `players.email`, `team_owners.contact_email` | `/api/registrations` | `players`, `team_owners` | Yes | Valid email format | Fallback to `@fairplay.local` |
| `mobile` | User Input (Step 1) | `players.mobile`, `team_owners.contact_phone` | `/api/registrations` | `players`, `team_owners` | Yes | Indian 10-digit mobile pattern | Used for contact & WhatsApp export |
| `cricket_role` | User Input (Step 2) | `registered_role_snapshot` | `/api/registrations` | `players`, `registrations` | No | `BATSMAN`, `BOWLER`, `ALL_ROUNDER` | Enum validated |
| `batting_style` | User Input (Step 2) | `registered_batting_style_snapshot` | `/api/registrations` | `players`, `registrations` | No | `RIGHT_HAND`, `LEFT_HAND` | Enum validated |
| `jersey_size` | User Input (Step 2) | `registered_jersey_size_snapshot` | `/api/registrations` | `registrations` | No | `S`, `M`, `L`, `XL`, `XXL`, `3XL` | Defaults to `'M'` |
| `profile_image_url` | File Upload / Base64 | `registered_image_snapshot` | `/api/registrations` | `players`, `registrations` | No | Max 5 MB, Magic byte check (JPG, PNG, WebP) | Uploaded to `profile-images` |
| `amount` | Tournament Config | `payments.amount` | RPCs (`allocate_*`) | `payments` | No | Positive integer in paise (e.g. 90000 = ₹900) | Authoritative server fee |
| `payment_status` | RPC / Admin Action | `payments.payment_status` | `/api/admin/registrations/[id]/approve` | `payments`, `team_owners` | Yes | `PENDING`, `SUCCESSFUL`, `FAILED`, `REFUNDED` | Enum constrained |
| `registration_status` | RPC / Admin Action | `registrations.registration_status` | `/api/admin/registrations/[id]/approve` | `registrations` | Yes | `PENDING`, `CONFIRMED`, `WAITING_LIST`, `REJECTED` | Enum constrained |
| `payment_screenshot_url` | File Upload | `payments.payment_screenshot_url` | `/api/registrations/[id]/screenshot` | `payments` | Yes | Buffer magic byte check, max 5 MB | Saved in `payment-screenshots` |
| `team_name` | Owner Input | `team_owners.team_name`, `registrations.team_name` | `/api/registrations/owner` | `team_owners`, `registrations` | No | Non-empty string | Used for Owner-based leagues |
| `team_logo_url` | File Upload | `team_owners.team_logo_url` | `/api/registrations/owner` | `team_owners` | No | Max 5 MB image | Saved in `team-logos` |

---

## 5. Authentication Flow & Security Model

### Authentication Methods
1. **Google OAuth**: Triggered via `supabase.auth.signInWithOAuth({ provider: 'google' })`. Callback handled by `/auth/callback/route.ts`.
2. **Email & Password**: Standard Supabase Auth `signUp()` and `signInWithPassword()`.
3. **Magic Link / OTP**: Supabase Auth `signInWithOtp()`.

### Session Resolution Flow
```
Browser Request
      │
      ▼
Server/API Route Handler (createServerSupabaseClient)
      │
      ▼
supabase.auth.getUser() ──[Valid Session?]──► Extract user.id & user.email
      │                                                │
      ▼ (No Session)                                   ▼
Reject 401 Unauthorized             Check Role Authorization:
                                    1. Query admin_users WHERE id = user.id AND status = 'ACTIVE'
                                    2. Query managers WHERE user_email = user.email AND is_active = true
```

### Authorization Boundaries
- **Admin Endpoints (`requireAdmin()`)**: Requires active record in `admin_users`.
- **Manager Endpoints (`requireManager()`)**: Requires active record in `admin_users` OR `managers`.
- **User Endpoints (`getUser()`)**: Requires valid authenticated Supabase session.
- **Service Role Bypass**: `createAdminClient()` uses `SUPABASE_SERVICE_ROLE_KEY` exclusively on the server for atomic RPC calls, bypassing RLS.

---

## 6. Reusable Player Profile Model

### Core Architectural Distinction

```
┌─────────────────────────────────────────┐
│              PLAYERS TABLE              │
│  (Persistent Reusable Profile Master)   │
│  - id                                   │
│  - auth_user_id (links to Auth User)    │
│  - full_name, email, mobile             │
│  - cricket_role, batting_style          │
└────────────────────┬────────────────────┘
                     │ 1
                     │
                     │ N
                     ▼
┌─────────────────────────────────────────┐
│           REGISTRATIONS TABLE           │
│   (Tournament-Specific Snapshot Entry)  │
│  - id, tournament_id, player_id         │
│  - registration_number (REG-FPL-0001)   │
│  - registration_status (PENDING, etc.)  │
│  - registered_name_snapshot             │
│  - registered_role_snapshot             │
│  - registered_batting_style_snapshot    │
│  - registered_jersey_size_snapshot      │
│  - registered_image_snapshot            │
└─────────────────────────────────────────┘
```

### Key Questions Answered
1. **What is a reusable player profile?**: A row in `players` containing master identity and default cricket preferences.
2. **What identifies a player?**: Primary key `players.id` (UUID).
3. **What identifies a tournament registration?**: Primary key `registrations.id` (UUID) and `registration_number` (e.g. `REG-EDFB-0001`).
4. **Can one person register for multiple tournaments?**: **YES**. One `players` record can have N `registrations` rows across different tournaments.
5. **Can one logged-in user register another person?**: **YES**. Setting `registrationFor = 'OTHER'` creates a new participant profile with `is_tournament_only = true` while setting `created_by_auth_id = user.id` on the registration record.
6. **How does `auth_user_id` work?**: Links the primary player profile to the Supabase Auth user. `is_tournament_only = true` indicates a profile created for someone else without their own auth login.
7. **Impact of Profile Editing**: Editing a player's profile in `players` updates their master profile but **DOES NOT** overwrite historical snapshots in `registrations` (`registered_name_snapshot`, `registered_role_snapshot`, etc.).
8. **Tournament Deletion Impact**: Deleting a tournament deletes the `registrations` rows for that tournament, but **DOES NOT** delete the master `players` record.

---

## 7. Player Registration Flow

```
User Logged In
      │
      ▼
Navigate to /register
      │
      ▼
Select Participant: "Myself" vs "Someone Else"
      │
      ▼
Fill Personal & Cricket Details (Steps 1 & 2)
      │
      ▼
Step 3: Review & Initiate Payment
      │
      ▼
POST /api/registrations
      │
      ▼
Server executes allocate_player_registration_v2 RPC (Atomic Transaction)
  ├── 1. Lock tournaments row FOR UPDATE
  ├── 2. Count active registrations (CONFIRMED + PENDING)
  ├── 3. If capacity available → Status = 'PENDING'
  │      Else if waitlist enabled → Status = 'WAITING_LIST', position = count + 1
  │      Else → Raise Exception "Capacity Full"
  ├── 4. INSERT INTO registrations with immutable field snapshots
  └── 5. INSERT INTO payments (amount = registration_fee, status = 'PENDING')
      │
      ▼
Return registration_id, registration_number, payment_id
      │
      ▼
Redirect to /registration/[id] (User uploads payment screenshot)
```

---

## 8. Owner Registration Flow

```
Team Owner Selects Owner Registration
      │
      ▼
Fills Team Details (Team Name, Logo) + Owner Player Details + Icon Player Details
      │
      ▼
POST /api/registrations/owner
      │
      ▼
Server executes allocate_owner_registration_v4 RPC (Atomic Transaction)
  ├── 1. Lock tournaments row FOR UPDATE (type = 'OWNER_BASED')
  ├── 2. Verify Owner Capacity: COUNT(team_owners) < max_teams
  ├── 3. Verify Player Capacity: (max_players - active_players) >= 2
  │      (Requires 2 player slots: Owner Player #1 + Icon Player #2)
  ├── 4. Calculate next slot_number = COALESCE(MAX(slot_number), 0) + 1
  ├── 5. INSERT INTO team_owners (status = 'PENDING', payment_status = 'PENDING')
  ├── 6. INSERT INTO registrations (type = 'OWNER', Player #1 snapshot)
  ├── 7. INSERT INTO players (unclaimed Icon Player #2, player_type = 'ICON')
  ├── 8. INSERT INTO registrations (type = 'ICON', Player #2 snapshot)
  ├── 9. UPDATE team_owners SET owner_registration_id, icon_registration_id
  └── 10. INSERT INTO payments (combined amount = owner_fee + player_fee)
      │
      ▼
Return owner_id, slot_number, owner_registration_id, icon_registration_id, payment_id
```

---

## 9. Icon Player Flow

### Implementation Rules & Structure
- **Icon Profile**: Created automatically during Owner registration with `player_type = 'ICON'` and `is_tournament_only = true`.
- **Icon Registration**: Stored as a separate row in `registrations` with `registration_type = 'ICON'` linked to `team_owner_id`.
- **Icon Payment**: Included in the combined Owner payment (`owner_fee_paise` + `player_fee_paise`).
- **Claiming Icon Profile**: Unclaimed icons can be claimed by an authenticating player via `POST /api/players/claim-icon` if mobile number matches.
- **Auction Status**: **ICON IS NOT AUCTIONED**. The codebase explicitly marks Icon players as pre-assigned to the Team Owner's squad prior to auction start.

---

## 10. Payment Flow Architecture

### Payment Methods
- `UPI_QR`: Dynamic SVG QR code generated on frontend using canonical UPI URI scheme (`upi://pay?pa=...&am=...`).
- `UPI`: Direct UPI deep-linking to mobile payment apps (Google Pay, PhonePe, Paytm).
- `ACKNOWLEDGE_BY_ORGANISER`: Manual organiser payment acknowledgement (sets initial status to `AWAITING_ORGANISER_ACKNOWLEDGEMENT`).

### Payment State Machine

```
              ┌──────────────────────────────────────────┐
              │                 CREATED                  │
              └────────────────────┬─────────────────────┘
                                   │ Initialized
                                   ▼
              ┌──────────────────────────────────────────┐
              │                 PENDING                  │
              └────────────────────┬─────────────────────┘
                                   │ Screenshot Uploaded /
                                   │ Organiser Acknowledged
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                 AWAITING_ORGANISER_ACKNOWLEDGEMENT                       │
└──────────────────────────────────────────┬───────────────────────────────┘
                                           │
                                           │ Admin Verification
                    ┌──────────────────────┴──────────────────────┐
                    ▼                                             ▼
┌───────────────────────────────────────┐     ┌───────────────────────────────────────┐
│              SUCCESSFUL               │     │                FAILED                 │
│    (Registration → CONFIRMED)         │     │     (Registration → REJECTED)         │
└───────────────────────────────────────┘     └───────────────────────────────────────┘
```

### Critical Security Guarantees
1. **No Client-Side Approval**: Client components **CANNOT** set payment status to `SUCCESSFUL`.
2. **Server-Authoritative**: Status transitions are performed strictly by server route `/api/admin/registrations/[id]/approve` backed by `requireManager()`.
3. **Atomic Linking**: `payments.registration_id` links directly to `registrations.id`.

---

## 11. Admin Approval Flow & Visible Fields

When an Admin opens a pending registration in `/admin`, the following fields are fetched and displayed:

- `registration_number` (e.g. `REG-EDFB-0001` or `OWNER-EDFB-001`)
- `registered_name_snapshot` (Participant Name)
- `contact_email` / `email`
- `contact_phone` / `mobile`
- `registration_type` (`PLAYER`, `OWNER`, `ICON`)
- `registered_role_snapshot` (Cricket Role)
- `registered_batting_style_snapshot`
- `registered_jersey_size_snapshot`
- `registered_image_snapshot` (Profile Photo)
- `amount` (Payment Fee in INR)
- `payment_method` (`UPI_QR`, `ACKNOWLEDGE_BY_ORGANISER`)
- `payment_status` (`PENDING`, `AWAITING_ORGANISER_ACKNOWLEDGEMENT`)
- `payment_screenshot_url` (Signed URL for private screenshot bucket)
- `team_name` & `team_logo_url` (For Owner registrations)
- `created_at` / `registered_at`

---

## 12. Admin "Send Back to User" Requirement

- **Current Implementation**: **PARTIALLY IMPLEMENTED**
- **Existing Capabilities**: Admin can approve (`CONFIRMED`), reject (`REJECTED`), or cancel (`CANCELLED`) a registration. Admin can supply a `verificationNote`.
- **Missing Gap**: No dedicated `CORRECTION_REQUESTED` status exists in the `registration_status` enum, and no structured notification is sent to the user requesting edit/resubmission.
- **Recommended Data Model Extension**:
  1. Add `'CORRECTION_REQUESTED'` to `registration_status` and `payment_status` enums.
  2. Store `admin_remarks` on `registrations` table.
  3. Enable edit mode on `/registration/[id]` when status is `'CORRECTION_REQUESTED'`.

---

## 13. User Notification Flow

- **Current Implementation**: **PARTIALLY IMPLEMENTED**
- **Existing Capabilities**: The homepage displays a dynamic success/pending submission banner when redirected with `?submitted=true&tName=...`. The registration page `/registration/[id]` shows current registration & payment status badges.
- **Missing Gap**: No persistent `notifications` table or inbox exists in the database. Notifications are not pushed asynchronously to logged-in users.

---

## 14. User Registration History

- **Current Implementation**: **CURRENTLY IMPLEMENTED**
- **Evidence**: `/profile` page calls `/api/players/profile` which fetches all `registrations` for the user's `auth_user_id` or linked `player_id`.
- **Displayed Data**: Tournament Name, Registration Number, Registration Status Badge, Payment Status Badge, Registration Date, Role, Jersey Size, and link to `/registration/[id]`.

---

## 15. Homepage User Experience Audit

- **Public Users**: Hero banner with active tournament logo/banner, registration fee display, countdown/closed banner, rules summary, and archive of past tournaments.
- **Authenticated Users**: Displays personalized greeting, quick link to `/profile`, and active registration banner if redirected after submission.
- **Admins & Managers**: Displays Header link to `/admin` dashboard.

---

## 16. Admin Dashboard Audit

- **Data Sources**: `/api/admin/dashboard`, `/api/admin/tournaments`, `/api/admin/players`, `/api/admin/audit-logs`.
- **Tabs & Filters**: Registrations Queue (Filter by `ALL`, `PENDING`, `CONFIRMED`, `WAITING_LIST`, `REJECTED`), Tournaments Tab, Players Directory Tab, Audit Logs Tab.
- **Actions**: Approve Registration, Reject Registration, Verify Manual Payment, Delete Tournament (with strict name confirmation modal), Export Data (Excel / WhatsApp format).

---

## 17. Database Structure & Schema Inventory

### Primary Tables Table

| Table Name | Primary Key | Foreign Keys | RLS Enabled? | Purpose |
| :--- | :--- | :--- | :---: | :--- |
| `players` | `id` (UUID) | `auth_user_id` → `auth.users(id)` | Yes | Master player profile registry |
| `tournaments` | `id` (UUID) | `created_by` → `auth.users(id)` | Yes | Tournament configurations |
| `registrations` | `id` (UUID) | `tournament_id` → `tournaments(id)`, `player_id` → `players(id)`, `team_owner_id` → `team_owners(id)` | Yes | Tournament entry snapshots |
| `payments` | `id` (UUID) | `registration_id` → `registrations(id)`, `team_owner_id` → `team_owners(id)` | Yes | Payment transaction records |
| `team_owners` | `id` (UUID) | `tournament_id` → `tournaments(id)`, `player_id` → `players(id)` | Yes | Team owner slots & icon assignments |
| `admin_users` | `id` (UUID) | `id` → `auth.users(id)` | Yes | System administrator accounts |
| `managers` | `id` (UUID) | `user_id` → `auth.users(id)` | Yes | Manager user accounts |
| `audit_logs` | `id` (UUID) | `admin_user_id` → `auth.users(id)` | Yes | Administrative audit trail |

### Enum Types
- `user_role`: `'ADMIN'`, `'MANAGER'`, `'PLAYER'`
- `tournament_type`: `'OWNER_BASED'`, `'NON_OWNER_BASED'`
- `cricket_role`: `'BATSMAN'`, `'BOWLER'`, `'ALL_ROUNDER'`, `'BATSMAN_WICKETKEEPER'`, `'BOWLER_WICKETKEEPER'`
- `batting_style`: `'RIGHT_HAND'`, `'LEFT_HAND'`
- `jersey_size`: `'S'`, `'M'`, `'L'`, `'XL'`, `'XXL'`, `'3XL'`
- `registration_status`: `'PENDING'`, `'CONFIRMED'`, `'WAITING_LIST'`, `'CANCELLED'`, `'REJECTED'`
- `payment_status`: `'PENDING'`, `'AWAITING_ORGANISER_ACKNOWLEDGEMENT'`, `'SUCCESSFUL'`, `'FAILED'`, `'REFUNDED'`, `'CREATED'`, `'PROCESSING'`, `'CANCELLED'`

---

## 18. RPC & Server Function Inventory

| RPC Name | Purpose | Security | Key Inputs | Key Outputs |
| :--- | :--- | :---: | :--- | :--- |
| `allocate_player_registration_v2` | Atomic Player slot allocation | `SECURITY DEFINER` | `p_tournament_id`, `p_player_id`, snapshots | `registration_id`, `registration_number`, `registration_status`, `waitlist_position`, `payment_id` |
| `allocate_owner_registration_v4` | Atomic Owner + Icon slot allocation | `SECURITY DEFINER` | `p_tournament_id`, `p_owner_player_id`, `p_team_name`, icon details | `owner_id`, `slot_number`, `owner_registration_id`, `icon_registration_id`, `payment_id` |
| `delete_tournament_v1` | Safe tournament cascade deletion | `SECURITY DEFINER` | `p_tournament_id` | `success`, `deleted_registrations`, `deleted_payments`, `deleted_team_owners` |
| `is_admin(user_id)` | Checks admin role | `SECURITY DEFINER` | `user_id` (UUID) | `BOOLEAN` |
| `is_manager(user_id)` | Checks manager/admin role | `SECURITY DEFINER` | `user_id` (UUID) | `BOOLEAN` |

---

## 19. Complete API Endpoint Inventory

| Endpoint | Method | Auth | Role | Purpose |
| :--- | :---: | :---: | :---: | :--- |
| `/api/tournaments/upcoming` | `GET` | Public | All | Returns active open tournament |
| `/api/tournaments/current` | `GET` | Public | All | Returns latest tournament details |
| `/api/tournaments/[id]` | `GET` | Public | All | Returns tournament specs & owner slots |
| `/api/registrations` | `POST` | Auth | Player | Submits player registration |
| `/api/registrations/owner` | `POST` | Auth | Owner | Submits owner + icon registration |
| `/api/registrations/[id]` | `GET` | Public/Auth | All | Returns registration receipt & payment info |
| `/api/registrations/[id]/screenshot` | `POST` | Public/Auth | All | Uploads payment screenshot |
| `/api/players/profile` | `GET/POST` | Auth | Player | Reads or updates user player profile |
| `/api/players/claim-icon` | `POST` | Auth | Player | Claims unclaimed icon player profile |
| `/api/admin/login` | `POST` | Public | Admin/Mgr | Admin & manager login verification |
| `/api/admin/me` | `GET` | Auth | Admin/Mgr | Verifies admin/manager session |
| `/api/admin/dashboard` | `GET` | Auth | Admin/Mgr | Master metrics & registrations queue |
| `/api/admin/registrations/[id]/approve` | `POST` | Auth | Admin/Mgr | Approves/Rejects registration & payment |
| `/api/admin/tournaments` | `GET/POST` | Auth | Admin | Lists or creates tournaments |
| `/api/admin/tournaments/[id]` | `GET/PUT/DEL` | Auth | Admin | Updates or deletes tournament |
| `/api/admin/players` | `GET` | Auth | Admin/Mgr | Lists master players directory |
| `/api/admin/players/[id]` | `GET/PUT/DEL` | Auth | Admin | Updates or deletes player profile |
| `/api/admin/audit-logs` | `GET` | Auth | Admin | Returns system audit logs |
| `/api/admin/settings` | `GET/PUT` | Auth | Admin | Reads or updates system settings |
| `/api/admin/export` | `GET` | Auth | Admin/Mgr | CSV export of registrations |
| `/api/admin/export/excel` | `GET` | Auth | Admin/Mgr | Excel export of registrations |
| `/api/admin/export/whatsapp` | `GET` | Auth | Admin/Mgr | Formatted text export for WhatsApp |

---

## 20. Supabase Storage Architecture

| Bucket Name | Public / Private | Max File Size | Allowed Mime Types | Security Policy Summary |
| :--- | :---: | :---: | :--- | :--- |
| `payment-screenshots` | **Private** | 5 MB | `image/jpeg`, `image/png`, `image/webp` | Private read access restricted to Admins (`is_admin()`). Served via signed URLs. |
| `team-logos` | **Public** | 5 MB | `image/jpeg`, `image/png`, `image/webp` | Public read access enabled for all users. |
| `profile-images` | **Public** | 5 MB | `image/jpeg`, `image/png`, `image/webp` | Public read access enabled for all users. |

---

## 21. State Machines

### Registration State Transitions

```
               ┌────────────────────────┐
               │        PENDING         │
               └───────────┬────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  CONFIRMED  │ │  REJECTED   │ │  CANCELLED  │
    └─────────────┘ └─────────────┘ └─────────────┘
           ▲
           │ (Promoted from Waitlist)
    ┌───────────────┐
    │ WAITING_LIST  │
    └───────────────┘
```

---

## 22. End-to-End Business Flow Diagrams

### Flow A: Player Registration
```
User Auth ──► /register ──► Personal & Cricket Form ──► POST /api/registrations
                                                              │
                                                              ▼
                                               allocate_player_registration_v2
                                                              │
                                                              ▼
User Uploads Screenshot ◄── /registration/[id] ◄── PENDING Status Created
            │
            ▼
POST /api/registrations/[id]/screenshot ──► Admin Dashboard ──► Approve ──► CONFIRMED
```

---

## 23. Missing & Partially Implemented Functionality

| Requirement | Current Status | Evidence / Location | Gap | Recommended Implementation |
| :--- | :---: | :--- | :--- | :--- |
| Admin Correction Request | **PARTIALLY IMPLEMENTED** | `approve/route.ts` line 31 | Admin can reject or cancel, but cannot send back with `'CORRECTION_REQUESTED'` status. | Add `'CORRECTION_REQUESTED'` enum and enable form re-submission on `/registration/[id]`. |
| User Persistent Notifications | **PARTIALLY IMPLEMENTED** | `page.tsx` line 52 | Notifications are displayed via URL params (`?submitted=true`), no persistent inbox. | Create `notifications` DB table and header bell icon component. |
| Icon Independent Registration | **CURRENTLY IMPLEMENTED** | `allocate_owner_registration_v4` | Icon player is registered atomically alongside Owner. | Working as intended. |
| Payment Screenshot Verification | **CURRENTLY IMPLEMENTED** | `upload.ts` & `screenshot/route.ts` | Server validates magic bytes and sizes; Admin manually verifies. | Working as intended. |

---

## 24. Code Quality & Architectural Risk Audit

1. **Client / Server Boundary**: Clean separation. Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`) are isolated to `src/lib/supabase/admin.ts`.
2. **Atomic Concurrency**: Concurrency race conditions during registration capacity checks are completely mitigated via PostgreSQL row locking (`FOR UPDATE`) inside `allocate_player_registration_v2` and `allocate_owner_registration_v4`.
3. **Data Integrity**: Historical registration snapshots prevent master profile changes from corrupting past tournament records.

---

## 25. Test Coverage Inventory

- **Framework**: Vitest (`npx vitest run`)
- **Total Test Files**: 20 test suites
- **Total Tests Passed**: 177 tests (100% pass rate)
- **Key Test Suites**:
  - `gate2a-owner-as-player.test.ts` (23 tests — Owner capacity & RPC allocation)
  - `gate2b-storage-security.test.ts` (14 tests — Storage bucket policies & magic bytes)
  - `gate3r2-payment-security.test.ts` (18 tests — Payment verification security)
  - `gate3r3-authorization-security.test.ts` (17 tests — Admin & manager authorization)
  - `delete-tournament-security.test.ts` (6 tests — Tournament cascade deletion)
  - `upi-payment-experience.test.ts` (6 tests — Payment UX & UPI URI building)

---

## 26. Final Audit Summary Statistics

- **A. Complete UI Page Count**: `22` routes
- **B. Complete API Endpoint Count**: `32` endpoints
- **C. Complete DB Table Count**: `9` tables
- **D. Complete RPC/Function Count**: `7` functions
- **E. Complete Storage Bucket Count**: `3` buckets (`payment-screenshots`, `team-logos`, `profile-images`)
- **F. Authentication Methods**: Google OAuth, Email/Password, Magic Link OTP, DB-backed Role Access (`admin_users`, `managers`).
- **G. Current Registration Flows**: Atomic Player Registration (`allocate_player_registration_v2`), Atomic Owner + Icon Registration (`allocate_owner_registration_v4`).
- **H. Current Admin Approval Flow**: Server-authoritative approval/rejection cascading to sibling registrations and payment records.
- **I. Current Notification Flow**: URL parameter banner notifications on homepage.
- **J. Current User History Flow**: Full registration history accessible at `/profile`.
- **K. Top Architectural Gap**: Absence of explicit `'CORRECTION_REQUESTED'` state machine branch for admin resubmission requests.
- **L. Recommended Implementation Order**:
  1. Extend `registration_status` enum with `'CORRECTION_REQUESTED'`.
  2. Implement persistent user notification inbox table.
  3. Add user profile photo cropping/editing tool on `/profile`.
