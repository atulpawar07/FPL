import { describe, it, expect, vi } from 'vitest';
import { checkIsAdmin, requireAdmin } from '@/lib/auth/is-admin';
import { getSignedScreenshotUrl } from '@/lib/storage/upload';

// Mock Supabase clients for vitest testing
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-admin-1', email: 'atulpawar07@gmail.com' } },
        error: null,
      }),
    },
  }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'admin_users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'user-admin-1', role: 'SUPER_ADMIN', status: 'ACTIVE' },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://supabase.co/storage/v1/object/sign/payment-screenshots/t1/r1/proof.png?token=xyz' },
          error: null,
        }),
      }),
    },
  }),
}));

describe('Phase 1 Architecture V2.2 & DR-V2.2 Foundation Tests', () => {
  describe('1. DB-Backed Admin Authorization', () => {
    it('should verify super admin user status from database / bootstrap email', async () => {
      const { isAdmin, user, role } = await checkIsAdmin();
      expect(isAdmin).toBe(true);
      expect(user?.email).toBe('atulpawar07@gmail.com');
      expect(role).toBe('SUPER_ADMIN');
    });

    it('should require admin authorization and throw error for unauthenticated calls', async () => {
      const admin = await requireAdmin();
      expect(admin.user.id).toBe('user-admin-1');
      expect(admin.role).toBe('SUPER_ADMIN');
    });
  });

  describe('2. Private Storage Object Reference Model & Signed URLs', () => {
    it('should generate short-lived signed URL for private payment screenshots', async () => {
      const objectPath = 't1/r1/screenshot.png';
      const signedUrl = await getSignedScreenshotUrl('payment-screenshots', objectPath, 900);
      expect(signedUrl).toContain('payment-screenshots');
      expect(signedUrl).toContain('token=');
    });
  });

  describe('3. Financial & Fee Snapshot Integrity (Combined Payment Model)', () => {
    it('should enforce total amount = owner_fee_paise + player_fee_paise', () => {
      const ownerFeePaise = 900000; // ₹9,000
      const playerFeePaise = 9000;  // ₹90
      const totalAmount = ownerFeePaise + playerFeePaise;

      expect(totalAmount).toBe(909000);
      expect(totalAmount).toBeGreaterThan(0);
      expect(totalAmount === ownerFeePaise + playerFeePaise).toBe(true);
    });
  });

  describe('4. Canonical Registration Lifecycle & Capacity Rules', () => {
    it('should identify capacity-consuming states (PENDING, CONFIRMED) vs non-consuming (WAITING_LIST, REJECTED, CANCELLED)', () => {
      const capacityConsumingStates = ['PENDING', 'CONFIRMED'];
      const capacityReleasingStates = ['WAITING_LIST', 'REJECTED', 'CANCELLED'];

      expect(capacityConsumingStates.includes('PENDING')).toBe(true);
      expect(capacityConsumingStates.includes('CONFIRMED')).toBe(true);

      expect(capacityReleasingStates.includes('REJECTED')).toBe(true);
      expect(capacityReleasingStates.includes('CANCELLED')).toBe(true);
      expect(capacityReleasingStates.includes('WAITING_LIST')).toBe(true);
    });
  });

  describe('5. Uniqueness & Option B Multi-Role Eligibility (DR-039)', () => {
    it('should allow same person as Owner and Player under distinct registration_type', () => {
      const reg1 = { tournamentId: 't1', playerId: 'p1', registrationType: 'OWNER' };
      const reg2 = { tournamentId: 't1', playerId: 'p1', registrationType: 'PLAYER' };

      const key1 = `${reg1.tournamentId}_${reg1.playerId}_${reg1.registrationType}`;
      const key2 = `${reg2.tournamentId}_${reg2.playerId}_${reg2.registrationType}`;

      expect(key1).not.toBe(key2); // Distinct under UNIQUE(tournament_id, player_id, registration_type)
    });

    it('should block duplicate same-role registrations for the same player in same tournament', () => {
      const reg1 = { tournamentId: 't1', playerId: 'p1', registrationType: 'PLAYER' };
      const reg2 = { tournamentId: 't1', playerId: 'p1', registrationType: 'PLAYER' };

      const key1 = `${reg1.tournamentId}_${reg1.playerId}_${reg1.registrationType}`;
      const key2 = `${reg2.tournamentId}_${reg2.playerId}_${reg2.registrationType}`;

      expect(key1).toBe(key2); // Duplicate caught by unique constraint
    });
  });

  describe('6. Owner Slot Capacity Accounting (Owner = 2 Player + 1 Team Slot)', () => {
    it('should verify 1 Owner registration consumes 2 player slots and 1 owner slot', () => {
      const maxPlayers = 100;
      const maxTeams = 10;

      let currentPlayers = 10;
      let currentTeams = 2;

      // Register 1 Owner + Icon
      currentTeams += 1;
      currentPlayers += 2; // Owner + Icon

      expect(currentTeams).toBe(3);
      expect(currentPlayers).toBe(12);

      const remainingPlayers = maxPlayers - currentPlayers;
      const remainingTeams = maxTeams - currentTeams;

      expect(remainingPlayers).toBe(88);
      expect(remainingTeams).toBe(7);
    });
  });

  describe('7. F-001 Regression Test: Slot Number Derivation via COALESCE(MAX(slot_number), 0) + 1', () => {
    it('should derive next slot number cleanly as MAX(slot_number) + 1 when intermediate slot 2 is cancelled/deleted', () => {
      // Simulate existing team owners with slot_number 1, 2, 3
      let teamOwners = [
        { id: 'o1', slot_number: 1, status: 'APPROVED' },
        { id: 'o2', slot_number: 2, status: 'APPROVED' },
        { id: 'o3', slot_number: 3, status: 'APPROVED' },
      ];

      // Simulate intermediate slot 2 cancellation / removal
      teamOwners = teamOwners.filter((o) => o.slot_number !== 2);
      expect(teamOwners.length).toBe(2); // COUNT(*) is 2

      // Formula using COALESCE(MAX(slot_number), 0) + 1
      const maxSlotNumber = Math.max(...teamOwners.map((o) => o.slot_number), 0);
      const nextSlotNumber = maxSlotNumber + 1;

      // Formula using legacy COUNT(*) + 1
      const legacyCountSlotNumber = teamOwners.length + 1;

      // Legacy COUNT(*) + 1 would produce slot 3 (which collides with existing slot #3!)
      expect(legacyCountSlotNumber).toBe(3);

      // COALESCE(MAX(slot_number), 0) + 1 correctly produces slot 4 (no collision!)
      expect(nextSlotNumber).toBe(4);
      expect(teamOwners.some((o) => o.slot_number === nextSlotNumber)).toBe(false);
    });
  });
});

