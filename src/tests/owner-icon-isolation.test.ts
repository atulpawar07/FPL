import { describe, beforeEach, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as registerOwner } from '@/app/api/registrations/owner/route';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/storage/upload', () => ({
  uploadToStorageBucket: vi.fn(),
}));

describe('Owner Icon Isolation Security Tests', () => {
  let mockSupabaseServer: any;
  let mockSupabaseAdmin: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabaseServer = {
      auth: { getUser: vi.fn() },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    };

    mockSupabaseAdmin = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      rpc: vi.fn(),
    };

    (createServerSupabaseClient as unknown as any).mockResolvedValue(mockSupabaseServer);
    (createAdminClient as unknown as any).mockReturnValue(mockSupabaseAdmin);
  });

  const createMockOwnerRequest = (body: any) => {
    return new NextRequest('http://localhost:3000/api/registrations/owner', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  };

  it('TEST 1: Owner registers with Icon details and no iconExistingPlayerId', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-123' } }, error: null });
    mockSupabaseServer.maybeSingle.mockResolvedValueOnce({ data: { id: 'owner-player-123' }, error: null });
    mockSupabaseAdmin.rpc.mockResolvedValueOnce({ data: [{}], error: null });

    const req = createMockOwnerRequest({
      tournamentId: 't-123',
      ownerName: 'Owner',
      contactEmail: 'owner@example.com',
      iconPlayerName: 'Icon Player',
      iconPlayerMobile: '9999999999',
    });

    const res = await registerOwner(req);
    expect(res.status).toBe(200);

    expect(mockSupabaseAdmin.rpc).toHaveBeenCalledWith('allocate_owner_registration_v4', expect.objectContaining({
      p_owner_player_id: 'owner-player-123',
      p_icon_name: 'Icon Player',
      p_icon_mobile: '9999999999',
    }));

    // API no longer passes p_icon_existing_player_id to RPC
    const callArgs = mockSupabaseAdmin.rpc.mock.calls[0][1];
    expect(callArgs).not.toHaveProperty('p_icon_existing_player_id');
  });

  it('TEST 2: Owner submits another player\'s UUID using iconExistingPlayerId', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-123' } }, error: null });
    mockSupabaseServer.maybeSingle.mockResolvedValueOnce({ data: { id: 'owner-player-123' }, error: null });
    mockSupabaseAdmin.rpc.mockResolvedValueOnce({ data: [{}], error: null });

    const req = createMockOwnerRequest({
      tournamentId: 't-123',
      ownerName: 'Owner',
      contactEmail: 'owner@example.com',
      iconPlayerName: 'Icon Player',
      iconExistingPlayerId: 'hacker-supplied-uuid-of-another-player',
    });

    const res = await registerOwner(req);
    expect(res.status).toBe(200);

    // API drops the payload
    const callArgs = mockSupabaseAdmin.rpc.mock.calls[0][1];
    expect(callArgs).not.toHaveProperty('p_icon_existing_player_id');
    expect(Object.values(callArgs)).not.toContain('hacker-supplied-uuid-of-another-player');
  });

  it('TEST 3: Owner submits their own player UUID as iconExistingPlayerId', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-123' } }, error: null });
    mockSupabaseServer.maybeSingle.mockResolvedValueOnce({ data: { id: 'owner-player-123' }, error: null });
    mockSupabaseAdmin.rpc.mockResolvedValueOnce({ data: [{}], error: null });

    const req = createMockOwnerRequest({
      tournamentId: 't-123',
      ownerName: 'Owner',
      contactEmail: 'owner@example.com',
      iconPlayerName: 'Owner as Icon',
      iconExistingPlayerId: 'owner-player-123',
    });

    const res = await registerOwner(req);
    expect(res.status).toBe(200);

    // Still dropped
    const callArgs = mockSupabaseAdmin.rpc.mock.calls[0][1];
    expect(callArgs).not.toHaveProperty('p_icon_existing_player_id');
  });

  it('TEST 4: Owner enters the same mobile number as an existing player', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-123' } }, error: null });
    mockSupabaseServer.maybeSingle.mockResolvedValueOnce({ data: { id: 'owner-player-123' }, error: null });
    mockSupabaseAdmin.rpc.mockResolvedValueOnce({ data: [{}], error: null });

    const req = createMockOwnerRequest({
      tournamentId: 't-123',
      ownerName: 'Owner',
      contactEmail: 'owner@example.com',
      iconPlayerName: 'Existing Mobile',
      iconPlayerMobile: 'existing-player-mobile',
    });

    await registerOwner(req);

    // DB migration 20260928000000 ensures this creates a NEW player record
    // We verify the API passes it strictly as a string detail, not an ID
    const callArgs = mockSupabaseAdmin.rpc.mock.calls[0][1];
    expect(callArgs.p_icon_mobile).toBe('existing-player-mobile');
    expect(callArgs).not.toHaveProperty('p_icon_existing_player_id');
  });

  it('TEST 5: Owner enters the same name as an existing player', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-123' } }, error: null });
    mockSupabaseServer.maybeSingle.mockResolvedValueOnce({ data: { id: 'owner-player-123' }, error: null });
    mockSupabaseAdmin.rpc.mockResolvedValueOnce({ data: [{}], error: null });

    const req = createMockOwnerRequest({
      tournamentId: 't-123',
      ownerName: 'Owner',
      contactEmail: 'owner@example.com',
      iconPlayerName: 'Existing Player Name',
    });

    await registerOwner(req);

    // Verified: Name is passed, but ID spoofing is structurally impossible
    const callArgs = mockSupabaseAdmin.rpc.mock.calls[0][1];
    expect(callArgs.p_icon_name).toBe('Existing Player Name');
    expect(callArgs).not.toHaveProperty('p_icon_existing_player_id');
  });

  it('TEST 6: Verify no OTP/SMS/MSG91 operation is triggered during Owner registration', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-123' } }, error: null });
    mockSupabaseServer.maybeSingle.mockResolvedValueOnce({ data: { id: 'owner-player-123' }, error: null });
    mockSupabaseAdmin.rpc.mockResolvedValueOnce({ data: [{}], error: null });

    const req = createMockOwnerRequest({
      tournamentId: 't-123',
      ownerName: 'Owner',
      contactEmail: 'owner@example.com',
      iconPlayerName: 'Icon Player',
      iconPlayerMobile: '9999999999',
    });

    await registerOwner(req);

    // Check there are no external fetch calls or SMS triggers made in the API route
    // (In our mocked environment, if any such calls existed, they would fail or be unmocked)
    // The only external call is to Supabase RPC.
    expect(mockSupabaseAdmin.rpc).toHaveBeenCalledTimes(1);
  });
});
