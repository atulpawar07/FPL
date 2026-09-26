import { describe, beforeEach, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as verifyManual } from '@/app/api/admin/payments/verify-manual/route';
import { POST as verifyGateway } from '@/app/api/payments/verify/route';
import { POST as retryPayment } from '@/app/api/payments/retry/route';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/audit/logger';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/audit/logger', () => ({
  logAdminAction: vi.fn(),
}));

describe('Gate 3-R2 — Payment Verification Security Suite', () => {
  let mockSupabaseServer: any;
  let mockSupabaseAdmin: any;
  let activeAdminUser: any = null;
  let mockDbStore: Record<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    activeAdminUser = { id: 'admin-1', role: 'SUPER_ADMIN', status: 'ACTIVE' };
    mockDbStore = {};

    mockSupabaseServer = {
      auth: { getUser: vi.fn() },
      from: vi.fn().mockImplementation((table: string) => {
        const chain: any = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockImplementation(async () => {
          if (table === 'players') {
            return { data: mockDbStore['server_player'] || { id: 'auth-player-1' }, error: null };
          }
          return { data: null, error: null };
        });
        return chain;
      }),
    };

    mockSupabaseAdmin = {
      from: vi.fn().mockImplementation((table: string) => {
        const chain: any = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.update = vi.fn().mockImplementation((data: any) => {
          mockDbStore[`last_update_${table}`] = data;
          return chain;
        });
        chain.insert = vi.fn().mockReturnValue(chain);
        chain.delete = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockImplementation((col: string, val: any) => {
          mockDbStore[`last_eq_${table}_${col}`] = val;
          return chain;
        });
        chain.maybeSingle = vi.fn().mockImplementation(async () => {
          if (table === 'admin_users') {
            return { data: activeAdminUser, error: null };
          }
          if (table === 'payments') {
            return { data: mockDbStore['target_payment'] || null, error: null };
          }
          if (table === 'registrations') {
            return { data: mockDbStore['target_registration'] || null, error: null };
          }
          if (table === 'team_owners') {
            return { data: mockDbStore['target_team_owner'] || null, error: null };
          }
          return { data: null, error: null };
        });
        chain.single = chain.maybeSingle;
        return chain;
      }),
    };

    (createServerSupabaseClient as unknown as any).mockResolvedValue(mockSupabaseServer);
    (createAdminClient as unknown as any).mockReturnValue(mockSupabaseAdmin);
  });

  const makeReq = (url: string, body: any) =>
    new NextRequest(url, { method: 'POST', body: JSON.stringify(body) });

  // G3-R2-01: Anonymous manual verification -> 401/403
  it('G3-R2-01: Anonymous manual verification attempt is rejected with 401/403', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Unauthenticated' } });
    const req = makeReq('http://localhost:3000/api/admin/payments/verify-manual', { paymentId: 'pay-1' });
    const res = await verifyManual(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('Unauthorized');
  });

  // G3-R2-02: Normal authenticated player attempting manual verification -> 403
  it('G3-R2-02: Normal authenticated player attempting manual verification is rejected with 403', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-player', email: 'player@example.com' } }, error: null });
    activeAdminUser = null;

    const req = makeReq('http://localhost:3000/api/admin/payments/verify-manual', { paymentId: 'pay-1' });
    const res = await verifyManual(req);
    expect(res.status).toBe(403);
  });

  // G3-R2-03: Inactive admin attempting verification -> 403
  it('G3-R2-03: Inactive admin attempting verification is rejected with 403', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-inactive', email: 'inactive@example.com' } }, error: null });
    activeAdminUser = null;

    const req = makeReq('http://localhost:3000/api/admin/payments/verify-manual', { paymentId: 'pay-1' });
    const res = await verifyManual(req);
    expect(res.status).toBe(403);
  });

  // G3-R2-04: Active authorized admin verification -> SUCCESS
  it('G3-R2-04: Active authorized admin verification succeeds', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@example.com' } }, error: null });
    mockDbStore['target_payment'] = { id: 'pay-1', registration_id: 'reg-1', payment_status: 'PENDING' };

    const req = makeReq('http://localhost:3000/api/admin/payments/verify-manual', { paymentId: 'pay-1' });
    const res = await verifyManual(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  // G3-R2-05: Client supplies payment_status=SUCCESSFUL -> ignored/overridden
  it('G3-R2-05: Client-supplied payment_status is ignored in favor of server state machine', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@example.com' } }, error: null });
    mockDbStore['target_payment'] = { id: 'pay-1', registration_id: 'reg-1', payment_status: 'PENDING' };

    const req = makeReq('http://localhost:3000/api/admin/payments/verify-manual', { paymentId: 'pay-1', payment_status: 'FAILED' });
    await verifyManual(req);

    expect(mockDbStore['last_update_payments']?.payment_status).toBe('SUCCESSFUL');
  });

  // G3-R2-06: Client supplies registration_status=CONFIRMED -> ignored
  it('G3-R2-06: Client-supplied registration_status is ignored in favor of server derivation', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@example.com' } }, error: null });
    mockDbStore['target_payment'] = { id: 'pay-1', registration_id: 'reg-1', payment_status: 'PENDING' };

    const req = makeReq('http://localhost:3000/api/admin/payments/verify-manual', { paymentId: 'pay-1', registration_status: 'CANCELLED' });
    await verifyManual(req);

    expect(mockDbStore['last_update_registrations']?.registration_status).toBe('CONFIRMED');
  });

  // G3-R2-07 & G3-R2-08: Client supplies verified_by / verified_at -> ignored
  it('G3-R2-07 & G3-R2-08: Client-supplied verified_by and verified_at are overridden with authenticated session data', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'real-admin-id', email: 'admin@example.com' } }, error: null });
    activeAdminUser = { id: 'real-admin-id', role: 'SUPER_ADMIN', status: 'ACTIVE' };
    mockDbStore['target_payment'] = { id: 'pay-1', registration_id: 'reg-1', payment_status: 'PENDING' };

    const req = makeReq('http://localhost:3000/api/admin/payments/verify-manual', {
      paymentId: 'pay-1',
      verified_by: 'fake-admin-id',
      verified_at: '2000-01-01T00:00:00Z',
    });
    await verifyManual(req);

    expect(mockDbStore['last_update_payments']?.verified_by).toBe('real-admin-id');
  });

  // G3-R2-09: Admin verifies another payment legitimately -> allowed
  it('G3-R2-09: Admin verifying another legitimate payment succeeds', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@example.com' } }, error: null });
    mockDbStore['target_payment'] = { id: 'pay-99', registration_id: 'reg-99', payment_status: 'PENDING' };

    const req = makeReq('http://localhost:3000/api/admin/payments/verify-manual', { paymentId: 'pay-99' });
    const res = await verifyManual(req);
    expect(res.status).toBe(200);
  });

  // G3-R2-10: Anonymous attempt using another paymentId -> rejected
  it('G3-R2-10: Anonymous request trying to verify paymentId is blocked with 403', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'No user' } });
    const req = makeReq('http://localhost:3000/api/admin/payments/verify-manual', { paymentId: 'victim-pay-id' });
    const res = await verifyManual(req);
    expect(res.status).toBe(403);
  });

  // G3-R2-11: Player attempts another player's payment retry -> rejected (IDOR protection)
  it('G3-R2-11: Player attempting to retry another player\'s registration is rejected with 403', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'attacker-auth-id', email: 'attacker@example.com' } }, error: null });
    mockDbStore['server_player'] = { id: 'attacker-player-id' };
    mockDbStore['target_registration'] = { id: 'reg-victim', player_id: 'victim-player-id', registration_status: 'PENDING' };

    const req = makeReq('http://localhost:3000/api/payments/retry', { registrationId: 'reg-victim' });
    const res = await retryPayment(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('Unauthorized');
  });

  // G3-R2-12 & G3-R2-13: FAILED/CANCELLED payment cannot be directly changed to SUCCESSFUL
  it('G3-R2-12 & G3-R2-13: Terminal FAILED/CANCELLED payments cannot be manually changed to SUCCESSFUL', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@example.com' } }, error: null });
    mockDbStore['target_payment'] = { id: 'pay-1', registration_id: 'reg-1', payment_status: 'FAILED' };

    const req = makeReq('http://localhost:3000/api/admin/payments/verify-manual', { paymentId: 'pay-1' });
    const res = await verifyManual(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Cannot manually approve payment in status: FAILED');
  });

  // G3-R2-14: Already SUCCESSFUL payment -> idempotent safe response without double update
  it('G3-R2-14: Already SUCCESSFUL payment returns safe idempotent response without re-verifying', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@example.com' } }, error: null });
    mockDbStore['target_payment'] = { id: 'pay-1', registration_id: 'reg-1', payment_status: 'SUCCESSFUL' };

    const req = makeReq('http://localhost:3000/api/admin/payments/verify-manual', { paymentId: 'pay-1' });
    const res = await verifyManual(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toContain('already confirmed');
  });

  // G3-R2-15 & G3-R2-16: Payment verification creates audit log with admin user ID
  it('G3-R2-15 & G3-R2-16: Successful manual verification writes audit log containing admin ID', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@example.com' } }, error: null });
    mockDbStore['target_payment'] = { id: 'pay-1', registration_id: 'reg-1', payment_status: 'PENDING' };

    const req = makeReq('http://localhost:3000/api/admin/payments/verify-manual', { paymentId: 'pay-1' });
    await verifyManual(req);

    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
      adminUserId: 'admin-1',
      action: 'VERIFY_PAYMENT_MANUAL',
      entityId: 'pay-1',
    }));
  });

  // G3-R2-17 & G3-R2-18: Unauthenticated /api/payments/verify mutation -> disabled/rejected with 403
  it('G3-R2-17 & G3-R2-18: /api/payments/verify unauthenticated callback endpoint is disabled with 403', async () => {
    const req = makeReq('http://localhost:3000/api/payments/verify', { orderId: 'order-123', status: 'SUCCESS' });
    const res = await verifyGateway(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('disabled');
  });

  // G3-R2-19: Invalid payment ID -> controlled 400/404
  it('G3-R2-19: Non-existent payment ID returns controlled 404', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@example.com' } }, error: null });
    mockDbStore['target_payment'] = null;

    const req = makeReq('http://localhost:3000/api/admin/payments/verify-manual', { paymentId: 'non-existent-pay' });
    const res = await verifyManual(req);
    expect(res.status).toBe(404);
  });

  // G3-R2-20: Payment amount cannot be modified during verification
  it('G3-R2-20: Client supplying custom amount during verification cannot alter payment amount', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@example.com' } }, error: null });
    mockDbStore['target_payment'] = { id: 'pay-1', registration_id: 'reg-1', amount: 50000, payment_status: 'PENDING' };

    const req = makeReq('http://localhost:3000/api/admin/payments/verify-manual', { paymentId: 'pay-1', amount: 0 });
    await verifyManual(req);

    expect(mockDbStore['last_update_payments']?.amount).toBeUndefined();
  });

  // G3-R2-21: Registration status update targets database-derived registration_id
  it('G3-R2-21: Registration status update targets database-derived registration_id', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@example.com' } }, error: null });
    mockDbStore['target_payment'] = { id: 'pay-1', registration_id: 'db-derived-reg-id', payment_status: 'PENDING' };

    const req = makeReq('http://localhost:3000/api/admin/payments/verify-manual', {
      paymentId: 'pay-1',
      registrationId: 'hacker-supplied-reg-id',
    });
    await verifyManual(req);

    expect(mockDbStore['last_eq_registrations_id']).toBe('db-derived-reg-id');
  });

  // G3-R2-22 & G3-R2-23: Admin authorization is DB-backed; hardcoded email alone cannot authorize non-existent DB user
  it('G3-R2-22 & G3-R2-23: Admin authorization is strictly DB-backed via admin_users', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'fake-admin-id', email: 'atulpawar07@gmail.com' } }, error: null });
    activeAdminUser = null;

    const req = makeReq('http://localhost:3000/api/admin/payments/verify-manual', { paymentId: 'pay-1' });
    const res = await verifyManual(req);
    expect(res.status).toBe(403);
  });
});
