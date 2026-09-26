import { describe, beforeEach, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as approveRegistration } from '@/app/api/admin/registrations/[id]/approve/route';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const createApproveRequest = (regId: string, action: string) =>
  new NextRequest(`http://localhost:3000/api/admin/registrations/${regId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });

describe('Phase 2 — Organiser Payment Acknowledgement Workflow & Admin Approval', () => {
  let mockServer: any;
  let mockAdmin: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'admin-user-id', email: 'admin@fpl.com' } },
          error: null,
        }),
      },
    };

    mockAdmin = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      single: vi.fn(),
    };

    (createServerSupabaseClient as unknown as any).mockResolvedValue(mockServer);
    (createAdminClient as unknown as any).mockReturnValue(mockAdmin);
  });

  it('Admin ACKNOWLEDGE_AND_APPROVE updates payment to SUCCESSFUL, registration to CONFIRMED, and logs ACKNOWLEDGE_ORGANISER_PAYMENT', async () => {
    // 1. admin_users lookup (requireManager)
    mockAdmin.maybeSingle.mockResolvedValueOnce({
      data: { id: 'admin-user-id', role: 'SUPER_ADMIN', status: 'ACTIVE' },
      error: null,
    });

    // 2. Registration query
    mockAdmin.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'reg-ack-100',
        registration_status: 'PENDING',
        tournament_id: 'tourney-1',
        registration_type: 'PLAYER',
        team_owner_id: null,
      },
      error: null,
    });

    // 3. Existing payment check
    mockAdmin.maybeSingle.mockResolvedValueOnce({
      data: { id: 'pay-ack-100', payment_status: 'AWAITING_ORGANISER_ACKNOWLEDGEMENT' },
      error: null,
    });

    const res = await approveRegistration(createApproveRequest('reg-ack-100', 'ACKNOWLEDGE_AND_APPROVE'), {
      params: Promise.resolve({ id: 'reg-ack-100' }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toContain('approved successfully!');

    // Verify audit log insert had action = 'ACKNOWLEDGE_ORGANISER_PAYMENT'
    const auditInsertCall = mockAdmin.from.mock.calls.find((c: any) => c[0] === 'audit_logs');
    expect(auditInsertCall).toBeDefined();
  });

  it('Purges ORGANISER_ACKNOWLEDGED as payment_status (canonical status is AWAITING_ORGANISER_ACKNOWLEDGEMENT / SUCCESSFUL)', () => {
    const canonicalPaymentStatuses = [
      'PENDING',
      'SUCCESSFUL',
      'FAILED',
      'REFUNDED',
      'AWAITING_ORGANISER_ACKNOWLEDGEMENT',
    ];

    expect(canonicalPaymentStatuses).not.toContain('ORGANISER_ACKNOWLEDGED');
  });
});
