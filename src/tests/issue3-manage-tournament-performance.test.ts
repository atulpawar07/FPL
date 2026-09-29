import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getScreenshotUrl } from '@/app/api/admin/payments/screenshot-url/route';
import { requireManager } from '@/lib/auth/is-manager';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSignedScreenshotUrl } from '@/lib/storage/upload';
import fs from 'fs';
import path from 'path';

const mockMaybeSinglePayments = vi.fn().mockResolvedValue({ data: null, error: null });
const mockMaybeSingleOwners = vi.fn().mockResolvedValue({ data: null, error: null });

const mockPaymentsEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSinglePayments });
const mockOwnersEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingleOwners });

const mockSelect = vi.fn().mockImplementation((fields: string) => {
  if (fields.includes('screenshot_bucket')) {
    return { eq: mockPaymentsEq };
  }
  return { eq: mockOwnersEq };
});

const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock('@/lib/auth/is-manager', () => ({
  requireManager: vi.fn(),
}));

vi.mock('@/lib/storage/upload', () => ({
  getSignedScreenshotUrl: vi.fn(),
}));

describe('ISSUE #3 — Manage Tournament Performance & Hardened Security', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Summary Route Critical Path Optimization', () => {
    it('1.1. Summary route executes independent queries in Promise.all', () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/admin/tournament/[id]/summary/route.ts'),
        'utf-8'
      );

      expect(source).toContain('Promise.all([');
      expect(source).toContain(".from('tournaments')");
      expect(source).toContain(".from('registrations')");
      expect(source).toContain(".from('team_owners')");
    });

    it('1.2. Summary route does NOT call getSignedScreenshotUrl in critical path', () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/admin/tournament/[id]/summary/route.ts'),
        'utf-8'
      );

      expect(source).not.toContain('getSignedScreenshotUrl');
    });
  });

  describe('2. Hardened On-Demand Screenshot Endpoint Security', () => {
    it('2.1. Non-manager receives 403', async () => {
      vi.mocked(requireManager).mockRejectedValueOnce(new Error('Unauthorized: Manager or Admin access required'));

      const req = new NextRequest('http://localhost:3000/api/admin/payments/screenshot-url?path=tourney1/reg1/proof.png');
      const res = await getScreenshotUrl(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toContain('Unauthorized');
    });

    it('2.2. Missing path receives 400', async () => {
      vi.mocked(requireManager).mockResolvedValueOnce({ user: { id: 'admin-1' } as any, isAdmin: true, role: 'ADMIN' });

      const req = new NextRequest('http://localhost:3000/api/admin/payments/screenshot-url?path=');
      const res = await getScreenshotUrl(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain('Missing screenshot path');
    });

    it('2.3. Valid manager + verified database path succeeds with 900s expiry', async () => {
      vi.mocked(requireManager).mockResolvedValueOnce({ user: { id: 'admin-1' } as any, isAdmin: true, role: 'ADMIN' });
      mockMaybeSinglePayments.mockResolvedValueOnce({
        data: {
          id: 'pay-1',
          screenshot_object_path: 'tourney1/reg1/proof.png',
          screenshot_bucket: 'payment-screenshots',
        },
        error: null,
      });
      vi.mocked(getSignedScreenshotUrl).mockResolvedValueOnce('https://supabase.co/storage/v1/object/sign/payment-screenshots/tourney1/reg1/proof.png?token=valid');

      const req = new NextRequest('http://localhost:3000/api/admin/payments/screenshot-url?path=tourney1%2Freg1%2Fproof.png');
      const res = await getScreenshotUrl(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.signedUrl).toContain('token=valid');
      expect(json.serviceRoleKey).toBeUndefined();
      expect(json.secretKey).toBeUndefined();
      expect(getSignedScreenshotUrl).toHaveBeenCalledWith('payment-screenshots', 'tourney1/reg1/proof.png', 900);
    });

    it('2.4. Arbitrary bucket parameter is IGNORED and forced to payment-screenshots', async () => {
      vi.mocked(requireManager).mockResolvedValueOnce({ user: { id: 'admin-1' } as any, isAdmin: true, role: 'ADMIN' });
      mockMaybeSinglePayments.mockResolvedValueOnce({
        data: {
          id: 'pay-1',
          screenshot_object_path: 'tourney1/reg1/proof.png',
          screenshot_bucket: 'payment-screenshots',
        },
        error: null,
      });
      vi.mocked(getSignedScreenshotUrl).mockResolvedValueOnce('https://supabase.co/storage/v1/object/sign/payment-screenshots/tourney1/reg1/proof.png?token=valid');

      const req = new NextRequest('http://localhost:3000/api/admin/payments/screenshot-url?path=tourney1%2Freg1%2Fproof.png&bucket=secret-system-bucket');
      const res = await getScreenshotUrl(req);
      expect(res.status).toBe(200);

      // Must call getSignedScreenshotUrl with payment-screenshots, NOT secret-system-bucket
      expect(getSignedScreenshotUrl).toHaveBeenCalledWith('payment-screenshots', 'tourney1/reg1/proof.png', 900);
    });

    it('2.5. Nonexistent path in database is REJECTED with 404', async () => {
      vi.mocked(requireManager).mockResolvedValueOnce({ user: { id: 'admin-1' } as any, isAdmin: true, role: 'ADMIN' });
      mockMaybeSinglePayments.mockResolvedValueOnce({ data: null, error: null });
      mockMaybeSingleOwners.mockResolvedValueOnce({ data: null, error: null });

      const req = new NextRequest('http://localhost:3000/api/admin/payments/screenshot-url?path=unrelated%2Fsecret%2Ffile.pdf');
      const res = await getScreenshotUrl(req);
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toContain('unauthorized');
      expect(getSignedScreenshotUrl).not.toHaveBeenCalled();
    });

    it('2.6. Path belonging to wrong screenshot bucket in DB is REJECTED', async () => {
      vi.mocked(requireManager).mockResolvedValueOnce({ user: { id: 'admin-1' } as any, isAdmin: true, role: 'ADMIN' });
      mockMaybeSinglePayments.mockResolvedValueOnce({
        data: {
          id: 'pay-2',
          screenshot_object_path: 'other/file.png',
          screenshot_bucket: 'public-avatars',
        },
        error: null,
      });
      mockMaybeSingleOwners.mockResolvedValueOnce({ data: null, error: null });

      const req = new NextRequest('http://localhost:3000/api/admin/payments/screenshot-url?path=other%2Ffile.png');
      const res = await getScreenshotUrl(req);
      expect(res.status).toBe(404);
      expect(getSignedScreenshotUrl).not.toHaveBeenCalled();
    });
  });

  describe('3. UI Integration', () => {
    it('3.1. Admin page connects receipt viewing to screenshot-url API', () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), 'src/app/admin/tournament/[id]/page.tsx'),
        'utf-8'
      );

      expect(source).toContain('/api/admin/payments/screenshot-url');
      expect(source).toContain('handleViewReceipt');
    });

    it('3.2. Manager page connects receipt viewing to screenshot-url API', () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), 'src/app/manager/tournament/[id]/page.tsx'),
        'utf-8'
      );

      expect(source).toContain('/api/admin/payments/screenshot-url');
      expect(source).toContain('handleViewProof');
    });
  });

});
