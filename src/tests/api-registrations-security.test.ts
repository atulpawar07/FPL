import { describe, beforeEach, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as registerPlayer } from '@/app/api/registrations/route';
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

describe('API Route Security - /api/registrations', () => {
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

  const createMockRequest = (body: any) => {
    return new NextRequest('http://localhost:3000/api/registrations', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  };

  it('A. Anonymous POST → 401', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'No user' } });
    const req = createMockRequest({ fullName: 'Test', profileImageUrl: 'url' });

    const res = await registerPlayer(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toBe('Authentication required');
  });

  it('B. Authenticated user registering themselves → existing flow succeeds', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-123' } }, error: null });

    mockSupabaseServer.maybeSingle.mockResolvedValueOnce({ data: { id: 'player-123' }, error: null });
    mockSupabaseAdmin.maybeSingle.mockResolvedValueOnce({ data: { id: 'tourn-123', registration_fee: 100 }, error: null });
    mockSupabaseAdmin.rpc.mockResolvedValueOnce({
      data: [{ registration_id: 'r-1', registration_number: '123', registration_status: 'PENDING', waitlist_position: null, payment_id: 'p-1' }],
      error: null
    });

    const req = createMockRequest({ fullName: 'Test', profileImageUrl: 'url', tournamentId: 'tourn-123' });
    const res = await registerPlayer(req);

    expect(res.status).toBe(200);
    expect(mockSupabaseAdmin.rpc).toHaveBeenCalledWith('allocate_player_registration_v2', expect.objectContaining({
      p_player_id: 'player-123'
    }));
  });

  it('C. Authenticated user attempting to supply another player\'s playerId → rejected/ignored', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-123' } }, error: null });

    mockSupabaseServer.maybeSingle.mockResolvedValueOnce({ data: { id: 'my-player-123' }, error: null });
    mockSupabaseAdmin.maybeSingle.mockResolvedValueOnce({ data: { id: 'tourn-123' }, error: null });
    mockSupabaseAdmin.rpc.mockResolvedValueOnce({ data: [{}], error: null });

    const req = createMockRequest({ fullName: 'Test', profileImageUrl: 'url', playerId: 'hacker-supplied-id' });
    await registerPlayer(req);

    expect(mockSupabaseAdmin.rpc).toHaveBeenCalledWith('allocate_player_registration_v2', expect.objectContaining({
      p_player_id: 'my-player-123'
    }));
  });

  it('D. Authenticated user attempting to use another person\'s email for identity → cannot change target player', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-123' } }, error: null });

    mockSupabaseServer.maybeSingle.mockResolvedValueOnce({ data: { id: 'my-player-123' }, error: null });
    mockSupabaseAdmin.maybeSingle.mockResolvedValueOnce({ data: { id: 'tourn-123' }, error: null });
    mockSupabaseAdmin.rpc.mockResolvedValueOnce({ data: [{}], error: null });

    const req = createMockRequest({ fullName: 'Test', profileImageUrl: 'url', email: 'otherperson@example.com' });
    await registerPlayer(req);

    expect(mockSupabaseAdmin.rpc).toHaveBeenCalledWith('allocate_player_registration_v2', expect.objectContaining({
      p_player_id: 'my-player-123'
    }));
  });

  it('E. Client-supplied paymentScreenshotUrl → ignored/rejected', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-123' } }, error: null });
    mockSupabaseServer.maybeSingle.mockResolvedValueOnce({ data: { id: 'player-123' }, error: null });
    mockSupabaseAdmin.maybeSingle.mockResolvedValueOnce({ data: { id: 'tourn-123' }, error: null });
    mockSupabaseAdmin.rpc.mockResolvedValueOnce({ data: [{}], error: null });

    const req = createMockRequest({
      fullName: 'Test',
      profileImageUrl: 'url',
      paymentScreenshotUrl: 'https://hacker.com/fake.png'
    });
    await registerPlayer(req);

    expect(mockSupabaseAdmin.rpc).toHaveBeenCalledWith('allocate_player_registration_v2', expect.objectContaining({
      p_screenshot_object_path: null
    }));
  });

  it('F. Owner registration cannot specify another player\'s ownerPlayerId', async () => {
    mockSupabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-123' } }, error: null });
    mockSupabaseServer.maybeSingle.mockResolvedValueOnce({ data: { id: 'my-player-123' }, error: null });
    mockSupabaseAdmin.rpc.mockResolvedValueOnce({ data: [{}], error: null });

    const req = new NextRequest('http://localhost:3000/api/registrations/owner', {
      method: 'POST',
      body: JSON.stringify({
        tournamentId: 'tourn-123',
        ownerName: 'Owner',
        contactEmail: 'owner@example.com',
        playerId: 'hacker-supplied-id'
      }),
    });

    await registerOwner(req);

    expect(mockSupabaseAdmin.rpc).toHaveBeenCalledWith('allocate_owner_registration_v4', expect.objectContaining({
      p_owner_player_id: 'my-player-123'
    }));
  });
});
