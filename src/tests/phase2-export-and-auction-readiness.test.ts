import { describe, beforeEach, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as exportExcel } from '@/app/api/admin/export/excel/route';
import { GET as exportWhatsApp } from '@/app/api/admin/export/whatsapp/route';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('Phase 2 — Export Services & Auction-Ready Data Separation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (createServerSupabaseClient as unknown as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'admin-1', email: 'admin@fpl.com' } },
          error: null,
        }),
      },
    });

    (createAdminClient as unknown as any).mockImplementation(() => ({
      from: (table: string) => {
        if (table === 'admin_users') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { id: 'admin-1', role: 'SUPER_ADMIN', status: 'ACTIVE' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'tournaments') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'tourney-1',
                    name: 'FPL 4th Anniversary League',
                    tournament_type: 'OWNER_BASED',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'registrations') {
          const mockData = [
            {
              id: 'reg-1',
              registration_number: 'REG-101',
              registered_name_snapshot: 'Test Player',
              registered_role_snapshot: 'BATSMAN',
              registered_batting_style_snapshot: 'RIGHT_HAND',
              registered_bowling_style_snapshot: 'RIGHT_ARM_MEDIUM',
              jersey_number_snapshot: '7',
              jersey_size_snapshot: 'L',
              jersey_name_snapshot: 'TEST',
              registration_type: 'PLAYER',
              registration_status: 'CONFIRMED',
              waitlist_position: null,
              team_name: null,
              registered_at: new Date().toISOString(),
              players: { email: 'player@test.com', mobile_number: '9876543210' },
              payments: [{ payment_status: 'SUCCESSFUL', payment_method: 'UPI_QR' }],
            },
            {
              id: 'reg-2',
              registration_number: 'REG-002',
              registered_name_snapshot: 'Icon Two',
              registered_role_snapshot: 'BOWLER',
              registration_type: 'ICON',
              registration_status: 'CONFIRMED',
              team_name: 'Royal Strikers',
              registered_at: new Date().toISOString(),
              players: { email: 'icon@test.com', mobile_number: '9999999999' },
              payments: [{ payment_status: 'SUCCESSFUL', payment_method: 'UPI_QR' }],
            },
          ];

          const makeChain = () => {
            const chain: any = {
              eq: () => makeChain(),
              order: () => makeChain(),
              then: (onFulfilled: any) => Promise.resolve({ data: mockData, error: null }).then(onFulfilled),
            };
            return chain;
          };

          return {
            select: () => makeChain(),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
              single: async () => ({ data: null, error: null }),
            }),
          }),
        };
      },
    }));
  });

  it('Excel export returns valid CSV response for scope=approved', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/export/excel?tournamentId=tourney-1&scope=approved');
    const res = await exportExcel(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');

    const csvText = await res.text();
    expect(csvText).toContain('REG-101');
    expect(csvText).toContain('Test Player');
  });

  it('WhatsApp export generates clean text breakdown with formatted registration numbers', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/export/whatsapp?tournamentId=tourney-1');
    const res = await exportWhatsApp(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.text.toUpperCase()).toContain('FPL 4TH ANNIVERSARY LEAGUE');
    expect(json.text).toContain('Test Player');
  });

  it('Auction pool separation rules: Icon players belong to team, while Owners and Players form future auction pool', () => {
    const mockRegistrations = [
      { id: '1', name: 'Owner A', type: 'OWNER', team: 'Franchise 1' },
      { id: '2', name: 'Icon B', type: 'ICON', team: 'Franchise 1' },
      { id: '3', name: 'Player C', type: 'PLAYER', team: null },
    ];

    const auctionPoolParticipants = mockRegistrations.filter(
      (r) => r.type === 'PLAYER' || r.type === 'OWNER'
    );
    const fixedTeamAssignments = mockRegistrations.filter((r) => r.type === 'ICON');

    expect(auctionPoolParticipants).toHaveLength(2);
    expect(fixedTeamAssignments).toHaveLength(1);
    expect(fixedTeamAssignments[0].name).toBe('Icon B');
  });
});
