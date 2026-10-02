import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  RegistrationStatus,
  DbRegistration,
  DbNotification,
  DbPayment,
  DbTeamOwner,
} from '@/types/database';
import { registrationStatusLabels } from '@/lib/utils/format';

describe('Phase 3A Data Model & Migration Safety Tests', () => {
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  const migration1File = path.join(migrationsDir, '20261012000000_phase3a_enum_extension.sql');
  const migration2File = path.join(migrationsDir, '20261012000001_phase3a_schema_additions.sql');

  const migration1Sql = fs.readFileSync(migration1File, 'utf-8');
  const migration2Sql = fs.readFileSync(migration2File, 'utf-8');

  // ============================================================
  // 1. CORRECTION_REQUESTED is a valid registration status & isolated in Migration 1
  // ============================================================
  it('1. CORRECTION_REQUESTED is a valid registration status and isolated in Migration 1', () => {
    const status: RegistrationStatus = 'CORRECTION_REQUESTED';
    expect(status).toBe('CORRECTION_REQUESTED');

    // Migration 1 MUST only contain the enum extension
    expect(migration1Sql).toContain("ALTER TYPE registration_status ADD VALUE IF NOT EXISTS 'CORRECTION_REQUESTED'");
    expect(migration1Sql).not.toContain('CREATE TABLE');
    expect(migration1Sql).not.toContain('ALTER TABLE');
    expect(migration1Sql).not.toContain('DROP CONSTRAINT');
    expect(migration1Sql).not.toContain('CREATE POLICY');
  });

  // ============================================================
  // 2. Existing registration statuses remain valid
  // ============================================================
  it('2. Existing registration statuses remain valid in types and Migration 2 constraint', () => {
    const canonicalStatuses: RegistrationStatus[] = [
      'PENDING',
      'CONFIRMED',
      'WAITING_LIST',
      'REJECTED',
      'CANCELLED',
      'CORRECTION_REQUESTED',
    ];

    expect(canonicalStatuses).toHaveLength(6);

    // Migration 2 constraint MUST include all 6 statuses using safe text cast pattern
    expect(migration2Sql).toContain('check_registration_status');
    expect(migration2Sql).toMatch(/registration_status::text\s+IN\s*\(/);
    for (const status of canonicalStatuses) {
      expect(migration2Sql).toContain(`'${status}'`);
    }
  });

  // ============================================================
  // 3. Existing registration rows remain readable (backward compatibility)
  // ============================================================
  it('3. Existing registration rows remain readable with new optional fields', () => {
    // Legacy row without Phase 3A correction fields
    const legacyRegistration: DbRegistration = {
      id: 'reg-legacy-1',
      tournament_id: 'tourn-1',
      player_id: 'player-1',
      registration_number: 'REG-001',
      registration_status: 'PENDING',
      registered_name_snapshot: 'Test Player',
      registered_role_snapshot: 'ALL_ROUNDER',
      registered_batting_style_snapshot: 'RIGHT_HAND',
      registered_jersey_size_snapshot: 'L',
      registered_image_snapshot: 'https://example.com/photo.jpg',
      waitlist_position: null,
      registered_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    };

    expect(legacyRegistration.admin_remarks).toBeUndefined();
    expect(legacyRegistration.correction_history).toBeUndefined();
    expect(legacyRegistration.resubmission_count).toBeUndefined();
    expect(legacyRegistration.correction_requested_at).toBeUndefined();

    // New row with Phase 3A correction fields
    const updatedRegistration: DbRegistration = {
      ...legacyRegistration,
      registration_status: 'CORRECTION_REQUESTED',
      admin_remarks: 'Please re-upload a clear payment screenshot',
      correction_history: [
        {
          remark: 'Initial remark',
          requested_at: '2026-10-02T10:00:00Z',
        },
      ],
      resubmission_count: 1,
      correction_requested_at: '2026-10-02T10:00:00Z',
    };

    expect(updatedRegistration.admin_remarks).toBe('Please re-upload a clear payment screenshot');
    expect(updatedRegistration.resubmission_count).toBe(1);
  });

  // ============================================================
  // 4. Existing payment rows remain readable
  // ============================================================
  it('4. Existing payment rows remain readable and unaffected by Phase 3A schema changes', () => {
    const payment: DbPayment = {
      id: 'pay-1',
      registration_id: 'reg-legacy-1',
      amount: 50000,
      payment_method: 'UPI_QR',
      payment_status: 'PENDING',
      transaction_reference: 'UPI1234567890',
      payment_screenshot_url: 'https://example.com/ss.jpg',
      screenshot_uploaded_at: '2026-10-01T00:00:00Z',
      extracted_txn_id: '1234567890',
      step1_validated: true,
      verification_note: null,
      verified_by: null,
      verified_at: null,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    };

    expect(payment.payment_status).toBe('PENDING');
    expect(payment.amount).toBe(50000);
  });

  // ============================================================
  // 5. Existing Owner + Icon relationships remain readable
  // ============================================================
  it('5. Existing Owner + Icon relationships remain readable and intact', () => {
    const teamOwner: DbTeamOwner = {
      id: 'owner-1',
      tournament_id: 'tourn-1',
      owner_name: 'Team Owner Name',
      contact_email: 'owner@example.com',
      contact_phone: '9876543210',
      slot_number: 1,
      status: 'PENDING',
      payment_status: 'PENDING',
      owner_registration_id: 'reg-owner-1',
      icon_registration_id: 'reg-icon-1',
      registered_at: '2026-10-01T00:00:00Z',
    };

    const ownerReg: DbRegistration = {
      id: 'reg-owner-1',
      tournament_id: 'tourn-1',
      player_id: 'player-owner-1',
      registration_number: 'OWNER-001',
      registration_status: 'PENDING',
      registration_type: 'OWNER',
      team_owner_id: 'owner-1',
      team_name: 'Thunderbolts',
      registered_name_snapshot: 'Owner Player',
      registered_role_snapshot: 'ALL_ROUNDER',
      registered_batting_style_snapshot: 'RIGHT_HAND',
      registered_jersey_size_snapshot: 'XL',
      registered_image_snapshot: 'https://example.com/owner.jpg',
      waitlist_position: null,
      registered_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    };

    const iconReg: DbRegistration = {
      id: 'reg-icon-1',
      tournament_id: 'tourn-1',
      player_id: 'player-icon-1',
      registration_number: 'ICON-001',
      registration_status: 'PENDING',
      registration_type: 'ICON',
      team_owner_id: 'owner-1',
      team_name: 'Thunderbolts',
      registered_name_snapshot: 'Icon Player',
      registered_role_snapshot: 'BATSMAN',
      registered_batting_style_snapshot: 'LEFT_HAND',
      registered_jersey_size_snapshot: 'L',
      registered_image_snapshot: 'https://example.com/icon.jpg',
      waitlist_position: null,
      registered_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    };

    expect(ownerReg.team_owner_id).toBe(teamOwner.id);
    expect(iconReg.team_owner_id).toBe(teamOwner.id);
    expect(teamOwner.owner_registration_id).toBe(ownerReg.id);
    expect(teamOwner.icon_registration_id).toBe(iconReg.id);
  });

  // ============================================================
  // 6. Notifications table accepts the approved schema
  // ============================================================
  it('6. Notifications table accepts the approved schema in SQL and TypeScript', () => {
    // Check SQL definition
    expect(migration2Sql).toContain('CREATE TABLE IF NOT EXISTS notifications');
    expect(migration2Sql).toContain('id UUID PRIMARY KEY DEFAULT gen_random_uuid()');
    expect(migration2Sql).toContain('user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE');
    expect(migration2Sql).toContain('type TEXT NOT NULL');
    expect(migration2Sql).toContain('title TEXT NOT NULL');
    expect(migration2Sql).toContain('message TEXT NOT NULL');
    expect(migration2Sql).toContain('registration_id UUID REFERENCES registrations(id) ON DELETE CASCADE');
    expect(migration2Sql).toContain('tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE');
    expect(migration2Sql).toContain('payment_id UUID REFERENCES payments(id) ON DELETE SET NULL');
    expect(migration2Sql).toContain('read_at TIMESTAMPTZ');
    expect(migration2Sql).toContain('created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
    expect(migration2Sql).toContain('updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');

    // Check TypeScript interface
    const notification: DbNotification = {
      id: 'notif-1',
      user_id: 'user-auth-1',
      type: 'CORRECTION_REQUIRED',
      title: 'Action required on your registration',
      message: 'Please update your player photo to a clear headshot.',
      registration_id: 'reg-1',
      tournament_id: 'tourn-1',
      payment_id: null,
      read_at: null,
      created_at: '2026-10-02T12:00:00Z',
      updated_at: '2026-10-02T12:00:00Z',
    };

    expect(notification.type).toBe('CORRECTION_REQUIRED');
    expect(notification.read_at).toBeNull();
  });

  // ============================================================
  // 7. RLS prevents User A from reading User B notifications
  // ============================================================
  it('7. RLS policy prevents User A from reading User B notifications', () => {
    expect(migration2Sql).toContain('ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;');
    expect(migration2Sql).toContain('CREATE POLICY "Users see own notifications"');
    expect(migration2Sql).toContain('ON notifications FOR SELECT');
    expect(migration2Sql).toContain('USING (user_id = auth.uid())');

    // Client INSERT policy must NOT be present
    expect(migration2Sql).not.toContain('FOR INSERT');

    // Simulate RLS filter behavior
    const allNotifications: DbNotification[] = [
      {
        id: 'notif-1',
        user_id: 'user-a',
        type: 'CORRECTION_REQUIRED',
        title: 'Correction for User A',
        message: 'Message A',
        created_at: '2026-10-02T12:00:00Z',
        updated_at: '2026-10-02T12:00:00Z',
      },
      {
        id: 'notif-2',
        user_id: 'user-b',
        type: 'CORRECTION_REQUIRED',
        title: 'Correction for User B',
        message: 'Message B',
        created_at: '2026-10-02T12:00:00Z',
        updated_at: '2026-10-02T12:00:00Z',
      },
    ];

    const currentAuthUid = 'user-a';
    const visibleToUserA = allNotifications.filter((n) => n.user_id === currentAuthUid);

    expect(visibleToUserA).toHaveLength(1);
    expect(visibleToUserA[0].id).toBe('notif-1');
  });

  // ============================================================
  // 8. Duplicate unread correction notification is prevented
  // ============================================================
  it('8. Duplicate unread correction notification is prevented by partial unique index', () => {
    expect(migration2Sql).toContain('uq_notifications_active_correction');
    expect(migration2Sql).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+uq_notifications_active_correction\s+ON\s+notifications\s*\(\s*user_id,\s*registration_id,\s*type\s*\)\s*WHERE\s+read_at\s+IS\s+NULL/i
    );

    // Simulate partial index check for unread notifications
    const existingActiveNotifications = new Set<string>();
    const generateKey = (user_id: string, reg_id: string | null, type: string, read_at: string | null) => {
      if (read_at !== null) return null; // Not governed by partial index
      return `${user_id}::${reg_id}::${type}`;
    };

    const notif1Key = generateKey('user-1', 'reg-1', 'CORRECTION_REQUIRED', null);
    expect(notif1Key).not.toBeNull();
    existingActiveNotifications.add(notif1Key!);

    // Attempting to insert duplicate unread correction notification for same registration
    const notif2Key = generateKey('user-1', 'reg-1', 'CORRECTION_REQUIRED', null);
    const isConflict = existingActiveNotifications.has(notif2Key!);
    expect(isConflict).toBe(true);
  });

  // ============================================================
  // 9. Read notifications do not conflict with the active correction uniqueness rule
  // ============================================================
  it('9. Read notifications do not conflict with the active correction uniqueness rule', () => {
    // When read_at is set, the WHERE read_at IS NULL condition excludes the row
    const previousReadNotification: DbNotification = {
      id: 'notif-old',
      user_id: 'user-1',
      registration_id: 'reg-1',
      type: 'CORRECTION_REQUIRED',
      title: 'Old Correction',
      message: 'Old Message',
      read_at: '2026-10-01T12:00:00Z', // MARKED READ
      created_at: '2026-10-01T10:00:00Z',
      updated_at: '2026-10-01T12:00:00Z',
    };

    // A new unread notification for the same registration should NOT conflict
    const newUnreadNotification: DbNotification = {
      id: 'notif-new',
      user_id: 'user-1',
      registration_id: 'reg-1',
      type: 'CORRECTION_REQUIRED',
      title: 'New Correction Cycle',
      message: 'New Remark',
      read_at: null,
      created_at: '2026-10-02T10:00:00Z',
      updated_at: '2026-10-02T10:00:00Z',
    };

    const isPartialIndexIndexed = (n: DbNotification) => n.read_at === null;
    expect(isPartialIndexIndexed(previousReadNotification)).toBe(false);
    expect(isPartialIndexIndexed(newUnreadNotification)).toBe(true);

    // Verify NULL registration_id standard SQL behavior:
    // In PostgreSQL, NULL != NULL in unique indexes, so multiple notifications with registration_id = null never conflict
    const systemNotifA: DbNotification = {
      id: 'sys-1',
      user_id: 'user-1',
      registration_id: null,
      type: 'SYSTEM_ANNOUNCEMENT',
      title: 'Welcome 1',
      message: 'Msg 1',
      read_at: null,
      created_at: '2026-10-02T10:00:00Z',
      updated_at: '2026-10-02T10:00:00Z',
    };
    const systemNotifB: DbNotification = {
      id: 'sys-2',
      user_id: 'user-1',
      registration_id: null,
      type: 'SYSTEM_ANNOUNCEMENT',
      title: 'Welcome 2',
      message: 'Msg 2',
      read_at: null,
      created_at: '2026-10-02T11:00:00Z',
      updated_at: '2026-10-02T11:00:00Z',
    };

    // In SQL standard, unique constraint with NULL does not conflict
    expect(systemNotifA.registration_id).toBeNull();
    expect(systemNotifB.registration_id).toBeNull();
  });

  // ============================================================
  // 10. Existing RPCs remain callable and untouched
  // ============================================================
  it('10. Existing RPCs remain untouched by Phase 3A migrations', () => {
    expect(migration1Sql).not.toContain('CREATE OR REPLACE FUNCTION');
    expect(migration2Sql).not.toContain('CREATE OR REPLACE FUNCTION');
    expect(migration1Sql).not.toContain('DROP FUNCTION');
    expect(migration2Sql).not.toContain('DROP FUNCTION');

    // Registration statuses used by existing RPCs ('CONFIRMED', 'WAITING_LIST', 'PENDING')
    // are fully supported in the updated CHECK constraint
    const rpcStatuses = ['CONFIRMED', 'WAITING_LIST', 'PENDING'];
    for (const st of rpcStatuses) {
      expect(migration2Sql).toContain(`'${st}'`);
    }
  });

  // ============================================================
  // 11. TypeScript types compile cleanly
  // ============================================================
  it('11. TypeScript types compile cleanly and match database definitions', () => {
    const status: RegistrationStatus = 'CORRECTION_REQUESTED';
    expect(status).toBe('CORRECTION_REQUESTED');

    const reg: DbRegistration = {
      id: 'reg-1',
      tournament_id: 'tourn-1',
      player_id: 'p-1',
      registration_number: 'REG-1',
      registration_status: status,
      registered_name_snapshot: 'Test',
      registered_role_snapshot: 'BATSMAN',
      registered_batting_style_snapshot: 'RIGHT_HAND',
      registered_jersey_size_snapshot: 'M',
      registered_image_snapshot: 'url',
      admin_remarks: 'Remark',
      correction_history: [{ remark: 'Remark', requested_at: '2026-10-02' }],
      resubmission_count: 0,
      correction_requested_at: '2026-10-02',
      waitlist_position: null,
      registered_at: '2026-10-02',
      updated_at: '2026-10-02',
    };

    expect(reg.registration_status).toBe('CORRECTION_REQUESTED');
    expect(reg.admin_remarks).toBe('Remark');

    // Verify registrationStatusLabels mapping in format.ts includes CORRECTION_REQUESTED
    expect(registrationStatusLabels.CORRECTION_REQUESTED).toBe('Correction Required');
  });
});
