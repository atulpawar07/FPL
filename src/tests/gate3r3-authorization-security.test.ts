import { describe, beforeEach, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PUT as updateTournamentApi } from '@/app/api/admin/tournaments/[id]/route';
import { POST as createTournamentApi } from '@/app/api/admin/tournaments/route';
import { POST as manageManagersApi, DELETE as revokeManagerApi } from '@/app/api/admin/managers/route';
import { POST as approveRegistrationApi } from '@/app/api/admin/registrations/[id]/approve/route';
import { DELETE as deleteRegistrationApi } from '@/app/api/admin/registrations/[id]/route';
import { DELETE as deletePlayerApi } from '@/app/api/admin/players/[id]/route';
import { DELETE as deleteTeamOwnerApi } from '@/app/api/admin/team-owners/[id]/route';
import { POST as uploadScreenshotApi } from '@/app/api/registrations/[id]/screenshot/route';
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

describe('Gate 3-R3 — Authorization & Audit Security Suite', () => {
  let mockSupabaseServer: any;
  let mockSupabaseAdmin: any;
  let activeAdminUser: any = null;
  let activeManagerUser: any = null;
  let mockDbStore: Record<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    activeAdminUser = { id: 'admin-1', role: 'SUPER_ADMIN', status: 'ACTIVE' };
    activeManagerUser = null;
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
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage.local/img.png' } }),
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        const chain: any = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.update = vi.fn().mockImplementation((data: any) => {
          mockDbStore[`last_update_${table}`] = data;
          return chain;
        });
        chain.insert = vi.fn().mockImplementation((data: any) => {
          mockDbStore[`last_insert_${table}`] = data;
          return chain;
        });
        chain.delete = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockImplementation((col: string, val: any) => {
          mockDbStore[`last_eq_${table}_${col}`] = val;
          return chain;
        });
        chain.ilike = vi.fn().mockReturnValue(chain);
        chain.in = vi.fn().mockReturnValue(chain);
        chain.neq = vi.fn().mockReturnValue(chain);
        chain.is = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockImplementation(async () => {
          if (table === 'admin_users') {
            return { data: activeAdminUser, error: null };
          }
          if (table === 'managers') {
            return { data: activeManagerUser, error: null };
          }
          if (table === 'tournaments') {
            return { data: mockDbStore['target_tournament'] || { id: 'tourney-1', name: 'Original T' }, error: null };
          }
          if (table === 'registrations') {
            return { data: mockDbStore['target_registration'] || { id: 'reg-1', player_id: 'owner-player-1', tournament_id: 't-1' }, error: null };
          }
          if (table === 'players') {
            return { data: mockDbStore['target_player'] || { id: 'auth-player-1' }, error: null };
          }
          if (table === 'team_owners') {
            return { data: mockDbStore['target_team_owner'] || { id: 'owner-1' }, error: null };
          }
          return { data: null, error: null };
        });
        chain.single = vi.fn().mockImplementation(async () => {
          if (table === 'managers') {
            return { data: { id: 'mgr-new-1', user_email: 'newmgr@example.com' }, error: null };
          }
          return chain.maybeSingle();
        });
        return chain;
      }),
    };

    (createServerSupabaseClient as unknown as any).mockResolvedValue(mockSupabaseServer);
    (createAdminClient as unknown as any).mockReturnValue(mockSupabaseAdmin);
  });

  const makeReq = (url: string, method: string, body?: any) =>
    new NextRequest(url, { method, body: body ? JSON.stringify(body) : undefined });

  // G3-R3-01: Tournament PUT Authorization Matrix
  describe('G3-R3-01: Tournament PUT Authorization', () => {
    it('Anonymous user calling PUT /api/admin/tournaments/[id] is rejected with 403', async () => {
      mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Unauthenticated' } });
      const req = makeReq('http://localhost:3000/api/admin/tournaments/t-1', 'PUT', { name: 'Hacked Tournament' });
      const params = Promise.resolve({ id: 't-1' });
      const res = await updateTournamentApi(req, { params });
      expect(res.status).toBe(403);
    });

    it('Normal authenticated player calling PUT /api/admin/tournaments/[id] is rejected with 403', async () => {
      mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'player-user-id', email: 'player@example.com' } }, error: null });
      activeAdminUser = null;
      activeManagerUser = null;

      const req = makeReq('http://localhost:3000/api/admin/tournaments/t-1', 'PUT', { name: 'Hacked Tournament' });
      const params = Promise.resolve({ id: 't-1' });
      const res = await updateTournamentApi(req, { params });
      expect(res.status).toBe(403);
    });

    it('Manager without admin privilege calling PUT /api/admin/tournaments/[id] is rejected with 403', async () => {
      mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'manager-user-id', email: 'manager@example.com' } }, error: null });
      activeAdminUser = null;
      activeManagerUser = { id: 'mgr-1', is_active: true };

      const req = makeReq('http://localhost:3000/api/admin/tournaments/t-1', 'PUT', { name: 'Hacked Tournament' });
      const params = Promise.resolve({ id: 't-1' });
      const res = await updateTournamentApi(req, { params });
      expect(res.status).toBe(403);
    });

    it('Inactive admin calling PUT /api/admin/tournaments/[id] is rejected with 403', async () => {
      mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'inactive-admin-id', email: 'inactive@example.com' } }, error: null });
      activeAdminUser = null;

      const req = makeReq('http://localhost:3000/api/admin/tournaments/t-1', 'PUT', { name: 'Hacked Tournament' });
      const params = Promise.resolve({ id: 't-1' });
      const res = await updateTournamentApi(req, { params });
      expect(res.status).toBe(403);
    });

    it('Active authorized admin calling PUT /api/admin/tournaments/[id] succeeds', async () => {
      mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@example.com' } }, error: null });
      activeAdminUser = { id: 'admin-1', role: 'SUPER_ADMIN', status: 'ACTIVE' };

      const req = makeReq('http://localhost:3000/api/admin/tournaments/t-1', 'PUT', { name: 'Updated Tournament' });
      const params = Promise.resolve({ id: 't-1' });
      const res = await updateTournamentApi(req, { params });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  // G3-R3-02: Hardened Screenshot Admin Authorization
  describe('G3-R3-02: Hardened Screenshot Admin Authorization', () => {
    const validBase64Jpeg = 'data:image/jpeg;base64,' + Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]).toString('base64');

    it('User with hardcoded email atulpawar07@gmail.com without DB admin record cannot bypass player ownership', async () => {
      mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'fake-admin-auth-id', email: 'atulpawar07@gmail.com' } }, error: null });
      activeAdminUser = null; // NOT in admin_users DB
      mockDbStore['server_player'] = { id: 'attacker-player-id' };
      mockDbStore['target_registration'] = { id: 'reg-victim', player_id: 'victim-player-id', tournament_id: 't-1' };

      const req = makeReq('http://localhost:3000/api/registrations/reg-victim/screenshot', 'POST', {
        screenshotBase64: validBase64Jpeg,
        transactionReference: '12345678',
      });
      const params = Promise.resolve({ id: 'reg-victim' });
      const res = await uploadScreenshotApi(req, { params });
      expect(res.status).toBe(403);
    });

    it('Registration owner can upload screenshot for their own registration', async () => {
      mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'legit-owner-user-id', email: 'owner@example.com' } }, error: null });
      mockDbStore['server_player'] = { id: 'legit-player-id' };
      mockDbStore['target_registration'] = { id: 'reg-own', player_id: 'legit-player-id', tournament_id: 't-1' };

      const req = makeReq('http://localhost:3000/api/registrations/reg-own/screenshot', 'POST', {
        screenshotBase64: validBase64Jpeg,
        transactionReference: '12345678',
      });
      const params = Promise.resolve({ id: 'reg-own' });
      const res = await uploadScreenshotApi(req, { params });
      expect(res.status).toBe(200);
    });

    it('DB-backed active admin can upload screenshot for any registration', async () => {
      mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'db-admin-user-id', email: 'admin@example.com' } }, error: null });
      activeAdminUser = { id: 'db-admin-user-id', role: 'SUPER_ADMIN', status: 'ACTIVE' };
      mockDbStore['server_player'] = { id: 'admin-player-id' };
      mockDbStore['target_registration'] = { id: 'reg-other', player_id: 'other-player-id', tournament_id: 't-1' };

      const req = makeReq('http://localhost:3000/api/registrations/reg-other/screenshot', 'POST', {
        screenshotBase64: validBase64Jpeg,
        transactionReference: '12345678',
      });
      const params = Promise.resolve({ id: 'reg-other' });
      const res = await uploadScreenshotApi(req, { params });
      expect(res.status).toBe(200);
    });
  });

  // G3-R3-03: Sensitive Admin Operations Audit Logging
  describe('G3-R3-03: Sensitive Admin Audit Logging', () => {
    beforeEach(() => {
      mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@example.com' } }, error: null });
      activeAdminUser = { id: 'admin-1', role: 'SUPER_ADMIN', status: 'ACTIVE' };
      activeManagerUser = null;
    });

    it('Tournament creation logs CREATE_TOURNAMENT audit event with admin user ID', async () => {
      const req = makeReq('http://localhost:3000/api/admin/tournaments', 'POST', {
        name: 'New Championship',
        maxPlayers: '100',
        registrationFeeRupees: '500',
      });
      await createTournamentApi(req);

      expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
        adminUserId: 'admin-1',
        action: 'CREATE_TOURNAMENT',
        entityType: 'TOURNAMENT',
      }));
    });

    it('Tournament update via PUT logs UPDATE_TOURNAMENT audit event', async () => {
      const req = makeReq('http://localhost:3000/api/admin/tournaments/t-1', 'PUT', { name: 'Renamed Tournament' });
      const params = Promise.resolve({ id: 't-1' });
      await updateTournamentApi(req, { params });

      expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
        adminUserId: 'admin-1',
        action: 'UPDATE_TOURNAMENT',
        entityType: 'TOURNAMENT',
        entityId: 't-1',
      }));
    });

    it('Grant manager logs GRANT_MANAGER audit event', async () => {
      const req = makeReq('http://localhost:3000/api/admin/managers', 'POST', { email: 'newmgr@example.com' });
      await manageManagersApi(req);

      expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
        adminUserId: 'admin-1',
        action: 'GRANT_MANAGER',
        entityType: 'MANAGER',
      }));
    });

    it('Revoke manager logs REVOKE_MANAGER audit event', async () => {
      const req = makeReq('http://localhost:3000/api/admin/managers?id=mgr-99', 'DELETE');
      await revokeManagerApi(req);

      expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
        adminUserId: 'admin-1',
        action: 'REVOKE_MANAGER',
        entityType: 'MANAGER',
        entityId: 'mgr-99',
      }));
    });

    it('Registration approval logs UPDATE_REGISTRATION_STATUS audit event', async () => {
      const req = makeReq('http://localhost:3000/api/admin/registrations/reg-1/approve', 'POST', { action: 'APPROVE' });
      const params = Promise.resolve({ id: 'reg-1' });
      await approveRegistrationApi(req, { params });

      expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
        adminUserId: 'admin-1',
        action: 'UPDATE_REGISTRATION_STATUS',
        entityType: 'REGISTRATION',
        entityId: 'reg-1',
      }));
    });

    it('Registration deletion logs DELETE_REGISTRATION audit event', async () => {
      const req = makeReq('http://localhost:3000/api/admin/registrations/reg-1', 'DELETE');
      const params = Promise.resolve({ id: 'reg-1' });
      await deleteRegistrationApi(req, { params });

      expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
        adminUserId: 'admin-1',
        action: 'DELETE_REGISTRATION',
        entityType: 'REGISTRATION',
        entityId: 'reg-1',
      }));
    });

    it('Player deletion logs DELETE_PLAYER audit event', async () => {
      const req = makeReq('http://localhost:3000/api/admin/players/p-1', 'DELETE');
      const params = Promise.resolve({ id: 'p-1' });
      await deletePlayerApi(req, { params });

      expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
        adminUserId: 'admin-1',
        action: 'DELETE_PLAYER',
        entityType: 'PLAYER',
        entityId: 'p-1',
      }));
    });

    it('Team owner deletion logs DELETE_TEAM_OWNER audit event', async () => {
      const req = makeReq('http://localhost:3000/api/admin/team-owners/o-1', 'DELETE');
      const params = Promise.resolve({ id: 'o-1' });
      await deleteTeamOwnerApi(req, { params });

      expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
        adminUserId: 'admin-1',
        action: 'DELETE_TEAM_OWNER',
        entityType: 'TEAM_OWNER',
        entityId: 'o-1',
      }));
    });

    it('Audit log actor comes strictly from authenticated session and cannot be spoofed by request body', async () => {
      const req = makeReq('http://localhost:3000/api/admin/registrations/reg-1', 'DELETE', { admin_user_id: 'spoofed-hacker-id' });
      const params = Promise.resolve({ id: 'reg-1' });
      await deleteRegistrationApi(req, { params });

      expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
        adminUserId: 'admin-1', // Derived from session auth user
      }));
    });
  });
});
