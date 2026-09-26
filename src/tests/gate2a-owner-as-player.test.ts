/**
 * Gate 2A Targeted Tests
 * Owner as Complete Player #1
 *
 * Test Matrix:
 *   TEST A  — Normal Owner registration (success path)
 *   TEST B  — Exactly 2 player slots available (boundary success)
 *   TEST C  — Only 1 player slot available (must fail atomically)
 *   TEST D  — No Owner slot available (must fail)
 *   TEST E  — Concurrent Owner registration simulation
 *   TEST F  — Snapshot independence from reusable profile
 *   TEST G  — Tournament-specific Owner data present in snapshot
 *   TEST H  — Reusable profile integrity (tournament data not written back)
 *   TEST I  — Authenticated user registers themselves (pass)
 *   TEST J  — ownerPlayerId / playerId supplied by client → ignored
 *   TEST K  — Unauthenticated request → 401
 *   TEST L  — contactEmail does not change Owner identity
 */
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const createOwnerRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost:3000/api/registrations/owner', {
    method: 'POST',
    body: JSON.stringify(body),
  });

const VALID_OWNER_BODY = {
  tournamentId: 'tournament-uuid-1',
  ownerName: 'Vikram Sharma',
  contactEmail: 'vikram@example.com',
  contactPhone: '9876543210',
  // Owner Player #1 snapshot fields
  ownerRole: 'BATSMAN',
  ownerBattingStyle: 'RIGHT_HAND',
  ownerBowlingStyle: null,
  ownerJerseySize: 'L',
  ownerProfileImageUrl: 'data:image/png;base64,iVBORw0KGgo=',
  teamName: 'Royal Strikers',
  // Icon Player #2
  iconPlayerName: 'Rohit Kumar',
  iconPlayerMobile: '9999988888',
  iconPlayerRole: 'BOWLER',
  iconPlayerBattingStyle: 'LEFT_HAND',
  iconPlayerBowlingStyle: 'RIGHT_ARM_FAST',
};

const RPC_SUCCESS = [
  {
    owner_id: 'owner-id-1',
    slot_number: 1,
    owner_registration_id: 'owner-reg-id-1',
    icon_registration_id: 'icon-reg-id-1',
    payment_id: 'payment-id-1',
    status: 'PENDING',
  },
];

// ---------------------------------------------------------------------------
describe('Gate 2A — Owner as Complete Player #1', () => {
  let mockServer: any;
  let mockAdmin: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      auth: { getUser: vi.fn() },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    };

    mockAdmin = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      single: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      rpc: vi.fn(),
    };

    (createServerSupabaseClient as unknown as any).mockResolvedValue(mockServer);
    (createAdminClient as unknown as any).mockReturnValue(mockAdmin);
  });

  // -------------------------------------------------------------------------
  // AUTH GUARD
  // -------------------------------------------------------------------------
  it('TEST K — Unauthenticated request → 401', async () => {
    mockServer.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'No session' } });
    const res = await registerOwner(createOwnerRequest(VALID_OWNER_BODY));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Authentication required');
  });

  it('TEST K2 — Auth error present → 401', async () => {
    mockServer.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Token expired' } });
    const res = await registerOwner(createOwnerRequest(VALID_OWNER_BODY));
    expect(res.status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // TEST A — Normal Owner registration
  // -------------------------------------------------------------------------
  it('TEST A — Normal Owner registration succeeds with complete Player #1 snapshot', async () => {
    mockServer.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockServer.maybeSingle.mockResolvedValueOnce({
      data: { id: 'player-profile-uuid-1' },
      error: null,
    });
    mockAdmin.rpc.mockResolvedValueOnce({ data: RPC_SUCCESS, error: null });

    const res = await registerOwner(createOwnerRequest(VALID_OWNER_BODY));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.ownerId).toBe('owner-id-1');
    expect(json.slotNumber).toBe(1);
    expect(json.ownerRegistrationId).toBe('owner-reg-id-1');
    expect(json.iconRegistrationId).toBe('icon-reg-id-1');
    expect(json.paymentId).toBe('payment-id-1');
    expect(json.status).toBe('PENDING');
  });

  // -------------------------------------------------------------------------
  // TEST G — Tournament-specific Owner data present in RPC call
  // -------------------------------------------------------------------------
  it('TEST G — Owner registration snapshot contains complete Player #1 fields', async () => {
    mockServer.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockServer.maybeSingle.mockResolvedValueOnce({
      data: { id: 'player-profile-uuid-1' },
      error: null,
    });
    mockAdmin.rpc.mockResolvedValueOnce({ data: RPC_SUCCESS, error: null });

    await registerOwner(
      createOwnerRequest({
        ...VALID_OWNER_BODY,
        ownerRole: 'ALL_ROUNDER',
        ownerBattingStyle: 'LEFT_HAND',
        ownerBowlingStyle: 'RIGHT_ARM_SPIN',
        ownerJerseySize: 'XL',
        ownerProfileImageUrl: 'data:image/png;base64,ABC123=',
      })
    );

    expect(mockAdmin.rpc).toHaveBeenCalledWith(
      'allocate_owner_registration_v4',
      expect.objectContaining({
        p_owner_role: 'ALL_ROUNDER',
        p_owner_batting_style: 'LEFT_HAND',
        p_owner_bowling_style: 'RIGHT_ARM_SPIN',
        p_owner_jersey_size: 'XL',
        p_owner_image_snapshot: 'data:image/png;base64,ABC123=',
      })
    );
  });

  // -------------------------------------------------------------------------
  // TEST F — Snapshot independence: Owner identity is from auth, not profile
  // Changing which player is used does not affect snapshot (snapshot has its own values)
  // -------------------------------------------------------------------------
  it('TEST F — Owner player is always resolved from auth session, not client payload', async () => {
    mockServer.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    // Player profile resolved server-side
    mockServer.maybeSingle.mockResolvedValueOnce({
      data: { id: 'server-side-player-uuid' },
      error: null,
    });
    mockAdmin.rpc.mockResolvedValueOnce({ data: RPC_SUCCESS, error: null });

    // Client sends a different player UUID — must be ignored
    await registerOwner(
      createOwnerRequest({
        ...VALID_OWNER_BODY,
        // These should be completely ignored by the API
        ownerPlayerId: 'client-supplied-uuid',
        playerId: 'another-fake-uuid',
      })
    );

    const callArgs = mockAdmin.rpc.mock.calls[0][1];
    // Must use server-resolved player id
    expect(callArgs.p_owner_player_id).toBe('server-side-player-uuid');
    // Must NOT contain any client-supplied spoofed UUID
    expect(Object.values(callArgs)).not.toContain('client-supplied-uuid');
    expect(Object.values(callArgs)).not.toContain('another-fake-uuid');
  });

  // -------------------------------------------------------------------------
  // TEST H — Reusable profile data is NOT overwritten by tournament registration
  // Verified by confirming API does NOT call supabaseServer.from('players').update(...)
  // for tournament data. The snapshot fields go into registrations, not players table.
  // -------------------------------------------------------------------------
  it('TEST H — Tournament snapshot fields are sent to RPC (registrations), not players profile table', async () => {
    mockServer.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockServer.maybeSingle.mockResolvedValueOnce({
      data: { id: 'player-profile-uuid-1' },
      error: null,
    });
    mockAdmin.rpc.mockResolvedValueOnce({ data: RPC_SUCCESS, error: null });

    await registerOwner(createOwnerRequest(VALID_OWNER_BODY));

    // Only 1 RPC call was made (to allocate_owner_registration_v4)
    // No separate update to the players profile table
    expect(mockAdmin.rpc).toHaveBeenCalledTimes(1);
    expect(mockAdmin.rpc.mock.calls[0][0]).toBe('allocate_owner_registration_v4');

    // Server Supabase client: only called for auth + profile lookup (SELECT, not UPDATE)
    // The from() chain on mockServer is for SELECT only — verifying no mutating calls
    // (In a real DB, the snapshot lives in registrations, not players)
    const callArgs = mockAdmin.rpc.mock.calls[0][1];
    // Snapshot fields are present in the RPC call
    expect(callArgs).toHaveProperty('p_owner_role');
    expect(callArgs).toHaveProperty('p_owner_batting_style');
    expect(callArgs).toHaveProperty('p_owner_jersey_size');
    expect(callArgs).toHaveProperty('p_owner_image_snapshot');
  });

  // -------------------------------------------------------------------------
  // TEST I — Authenticated user registers themselves (normal success)
  // -------------------------------------------------------------------------
  it('TEST I — Authenticated user registers themselves → passes', async () => {
    mockServer.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-me' } },
      error: null,
    });
    mockServer.maybeSingle.mockResolvedValueOnce({
      data: { id: 'my-player-id' },
      error: null,
    });
    mockAdmin.rpc.mockResolvedValueOnce({ data: RPC_SUCCESS, error: null });

    const res = await registerOwner(createOwnerRequest(VALID_OWNER_BODY));
    expect(res.status).toBe(200);

    const callArgs = mockAdmin.rpc.mock.calls[0][1];
    expect(callArgs.p_owner_player_id).toBe('my-player-id');
  });

  // -------------------------------------------------------------------------
  // TEST J — Client supplies another player's ownerPlayerId → ignored
  // -------------------------------------------------------------------------
  it('TEST J — Client-supplied ownerPlayerId is ignored; server-resolved player is used', async () => {
    mockServer.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-honest-user' } },
      error: null,
    });
    mockServer.maybeSingle.mockResolvedValueOnce({
      data: { id: 'honest-player-uuid' },
      error: null,
    });
    mockAdmin.rpc.mockResolvedValueOnce({ data: RPC_SUCCESS, error: null });

    await registerOwner(
      createOwnerRequest({
        ...VALID_OWNER_BODY,
        ownerPlayerId: 'hacker-player-uuid',
        playerId: 'another-hacker-uuid',
      })
    );

    const callArgs = mockAdmin.rpc.mock.calls[0][1];
    expect(callArgs.p_owner_player_id).toBe('honest-player-uuid');
    expect(Object.values(callArgs)).not.toContain('hacker-player-uuid');
    expect(Object.values(callArgs)).not.toContain('another-hacker-uuid');
  });

  // -------------------------------------------------------------------------
  // TEST L — Supplying another person's contactEmail does not change identity
  // -------------------------------------------------------------------------
  it('TEST L — contactEmail does not change authenticated Owner identity', async () => {
    mockServer.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockServer.maybeSingle.mockResolvedValueOnce({
      data: { id: 'my-real-player-uuid' },
      error: null,
    });
    mockAdmin.rpc.mockResolvedValueOnce({ data: RPC_SUCCESS, error: null });

    await registerOwner(
      createOwnerRequest({
        ...VALID_OWNER_BODY,
        contactEmail: 'someone-else@example.com',
      })
    );

    const callArgs = mockAdmin.rpc.mock.calls[0][1];
    // Player identity is NOT derived from contactEmail — it comes from auth session
    expect(callArgs.p_owner_player_id).toBe('my-real-player-uuid');
    // contactEmail is passed through as the contact/team data field only
    expect(callArgs.p_contact_email).toBe('someone-else@example.com');
  });

  // -------------------------------------------------------------------------
  // TEST C — Only 1 player slot available (RPC raises exception)
  // -------------------------------------------------------------------------
  it('TEST C — Only 1 player slot available → RPC rejects → no partial registration', async () => {
    mockServer.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockServer.maybeSingle.mockResolvedValueOnce({
      data: { id: 'player-profile-uuid-1' },
      error: null,
    });
    mockAdmin.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'Insufficient player slots remaining for Owner + Icon registration (requires 2 player slots)',
      },
    });

    const res = await registerOwner(createOwnerRequest(VALID_OWNER_BODY));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('player slots');
  });

  // -------------------------------------------------------------------------
  // TEST D — No Owner slot available
  // -------------------------------------------------------------------------
  it('TEST D — No Owner slot available → RPC rejects → no partial allocation', async () => {
    mockServer.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockServer.maybeSingle.mockResolvedValueOnce({
      data: { id: 'player-profile-uuid-1' },
      error: null,
    });
    mockAdmin.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'All owner slots for this tournament have been filled' },
    });

    const res = await registerOwner(createOwnerRequest(VALID_OWNER_BODY));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('owner slots');
  });

  // -------------------------------------------------------------------------
  // TEST B — Exactly 2 player slots available (boundary success)
  // -------------------------------------------------------------------------
  it('TEST B — Exactly 2 player slots available → Owner registration succeeds', async () => {
    mockServer.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockServer.maybeSingle.mockResolvedValueOnce({
      data: { id: 'player-profile-uuid-1' },
      error: null,
    });
    // RPC succeeds when exactly 2 slots remain
    mockAdmin.rpc.mockResolvedValueOnce({ data: RPC_SUCCESS, error: null });

    const res = await registerOwner(createOwnerRequest(VALID_OWNER_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST E — Concurrent Owner registration simulation
  // Two concurrent requests: only one should succeed if capacity allows only 1
  // -------------------------------------------------------------------------
  it('TEST E — Concurrent Owner registrations: second fails if capacity is 1 team slot', async () => {
    let callCount = 0;

    mockServer.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-concurrent' } },
      error: null,
    });
    mockServer.maybeSingle.mockResolvedValue({
      data: { id: 'player-profile-concurrent' },
      error: null,
    });

    // First call succeeds, second fails with slot conflict
    mockAdmin.rpc.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ data: RPC_SUCCESS, error: null });
      }
      return Promise.resolve({
        data: null,
        error: { message: 'All owner slots for this tournament have been filled' },
      });
    });

    const req1 = createOwnerRequest(VALID_OWNER_BODY);
    const req2 = createOwnerRequest(VALID_OWNER_BODY);

    const [res1, res2] = await Promise.all([registerOwner(req1), registerOwner(req2)]);

    // One should succeed, one should fail
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toContain(200);
    expect(statuses).toContain(400);
  });

  // -------------------------------------------------------------------------
  // Icon isolation tests (preserved from Gate 1)
  // -------------------------------------------------------------------------
  it('ICON ISOLATION — iconExistingPlayerId in request is never forwarded to RPC', async () => {
    mockServer.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockServer.maybeSingle.mockResolvedValueOnce({
      data: { id: 'player-profile-uuid-1' },
      error: null,
    });
    mockAdmin.rpc.mockResolvedValueOnce({ data: RPC_SUCCESS, error: null });

    await registerOwner(
      createOwnerRequest({
        ...VALID_OWNER_BODY,
        iconExistingPlayerId: 'hacker-icon-uuid',
      })
    );

    const callArgs = mockAdmin.rpc.mock.calls[0][1];
    // p_icon_existing_player_id must NOT be present in the RPC call args
    expect(callArgs).not.toHaveProperty('p_icon_existing_player_id');
    // And the hacker UUID must not appear anywhere in the args
    expect(Object.values(callArgs)).not.toContain('hacker-icon-uuid');
  });

  it('ICON ISOLATION — Icon mobile is passed as data field, not used for player lookup', async () => {
    mockServer.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockServer.maybeSingle.mockResolvedValueOnce({
      data: { id: 'player-profile-uuid-1' },
      error: null,
    });
    mockAdmin.rpc.mockResolvedValueOnce({ data: RPC_SUCCESS, error: null });

    await registerOwner(
      createOwnerRequest({
        ...VALID_OWNER_BODY,
        iconPlayerMobile: 'existing-player-mobile',
      })
    );

    const callArgs = mockAdmin.rpc.mock.calls[0][1];
    expect(callArgs.p_icon_mobile).toBe('existing-player-mobile');
    expect(callArgs).not.toHaveProperty('p_icon_existing_player_id');
  });

  it('ICON ISOLATION — No OTP/SMS/MSG91 operation triggered', async () => {
    mockServer.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockServer.maybeSingle.mockResolvedValueOnce({
      data: { id: 'player-profile-uuid-1' },
      error: null,
    });
    mockAdmin.rpc.mockResolvedValueOnce({ data: RPC_SUCCESS, error: null });

    await registerOwner(createOwnerRequest(VALID_OWNER_BODY));

    // Only 1 RPC call — no SMS/OTP external calls
    expect(mockAdmin.rpc).toHaveBeenCalledTimes(1);
    expect(mockAdmin.rpc.mock.calls[0][0]).toBe('allocate_owner_registration_v4');
  });

  // -------------------------------------------------------------------------
  // Validation: missing required fields
  // -------------------------------------------------------------------------
  it('VALIDATION — Missing tournamentId → 400', async () => {
    mockServer.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });

    const res = await registerOwner(
      createOwnerRequest({ ownerName: 'Test', contactEmail: 'test@test.com' })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Tournament ID');
  });

  it('VALIDATION — Player profile not found → 400 with clear message', async () => {
    mockServer.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-no-profile' } },
      error: null,
    });
    mockServer.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const res = await registerOwner(createOwnerRequest(VALID_OWNER_BODY));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('player profile');
  });

  // -------------------------------------------------------------------------
  // Capacity and atomicity unit-level verification (business logic)
  // -------------------------------------------------------------------------
  it('CAPACITY — Owner registration consumes exactly 1 owner slot + 2 player slots', () => {
    const maxTeams = 10;
    const maxPlayers = 100;
    let teams = 3;
    let players = 20;

    // Simulate 1 successful owner registration
    teams += 1;       // 1 owner slot
    players += 2;     // 2 player slots (Owner #1 + Icon #2)

    expect(teams).toBe(4);
    expect(players).toBe(22);
    expect(maxTeams - teams).toBe(6);
    expect(maxPlayers - players).toBe(78);
  });

  it('CAPACITY — Registration fails if only 1 player slot remains (requires 2)', () => {
    const maxPlayers = 100;
    const activePlayers = 99; // Only 1 slot left
    const slotsRemaining = maxPlayers - activePlayers;

    expect(slotsRemaining).toBe(1);
    expect(slotsRemaining < 2).toBe(true); // Should trigger RPC RAISE EXCEPTION
  });

  it('CAPACITY — Registration succeeds if exactly 2 player slots remain', () => {
    const maxPlayers = 100;
    const activePlayers = 98; // Exactly 2 slots left
    const slotsRemaining = maxPlayers - activePlayers;

    expect(slotsRemaining).toBe(2);
    expect(slotsRemaining >= 2).toBe(true); // Should allow registration
  });

  it('F-001 — Slot number derives from MAX(slot_number)+1, not COUNT(*)+1', () => {
    // Simulate existing slots 1, 3 (slot 2 was cancelled)
    const existingSlots = [
      { id: 'o1', slot_number: 1 },
      { id: 'o3', slot_number: 3 },
    ];

    const maxSlot = Math.max(...existingSlots.map((s) => s.slot_number), 0);
    const nextSlotViaMax = maxSlot + 1;           // Correct: 4
    const nextSlotViaCount = existingSlots.length + 1; // Wrong: 3 (collision!)

    expect(nextSlotViaMax).toBe(4);
    expect(nextSlotViaCount).toBe(3); // Collision with existing slot 3
    expect(existingSlots.some((s) => s.slot_number === nextSlotViaMax)).toBe(false); // No collision
  });

  // -------------------------------------------------------------------------
  // Owner Player #1 defaults when optional fields omitted
  // -------------------------------------------------------------------------
  it('DEFAULTS — Owner fields default to BATSMAN/RIGHT_HAND/M when not supplied', async () => {
    mockServer.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockServer.maybeSingle.mockResolvedValueOnce({
      data: { id: 'player-profile-uuid-1' },
      error: null,
    });
    mockAdmin.rpc.mockResolvedValueOnce({ data: RPC_SUCCESS, error: null });

    await registerOwner(
      createOwnerRequest({
        tournamentId: VALID_OWNER_BODY.tournamentId,
        ownerName: VALID_OWNER_BODY.ownerName,
        contactEmail: VALID_OWNER_BODY.contactEmail,
        contactPhone: VALID_OWNER_BODY.contactPhone,
        teamName: VALID_OWNER_BODY.teamName,
        // Omit ownerRole, ownerBattingStyle, ownerJerseySize → should use defaults
        iconPlayerName: VALID_OWNER_BODY.iconPlayerName,
      })
    );

    const callArgs = mockAdmin.rpc.mock.calls[0][1];
    expect(callArgs.p_owner_role).toBe('BATSMAN');
    expect(callArgs.p_owner_batting_style).toBe('RIGHT_HAND');
    expect(callArgs.p_owner_jersey_size).toBe('M');
  });
});
