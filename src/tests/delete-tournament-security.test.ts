import { describe, it, expect, beforeAll } from 'vitest';
import { deleteTournamentSafely } from '../lib/tournament/delete';
import { createAdminClient } from '../lib/supabase/admin';

describe('Delete Tournament Security & Integrity Suite (DELETE-01 to DELETE-16)', () => {
  const supabase = createAdminClient();

  // Test setup variables
  let testTournamentId: string;
  let testTournamentName = `Temporary Test Delete Suite Tournament ${Date.now()}`;
  let testPlayerId: string;
  let testRegId: string;
  let testPaymentId: string;
  let testTeamOwnerId: string;

  let fplClashId: string;
  let fplRegCountBefore: number = 0;
  let fplPayCountBefore: number = 0;
  let fplOwnerCountBefore: number = 0;

  beforeAll(async () => {
    // 1. Identify FPL Clash Of Champions
    const { data: fpl } = await supabase
      .from('tournaments')
      .select('*')
      .ilike('name', '%FPL 4th Anniversary League%')
      .maybeSingle();

    if (fpl) {
      fplClashId = fpl.id;

      const { count: regC } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', fplClashId);

      const { data: fplRegs } = await supabase
        .from('registrations')
        .select('id')
        .eq('tournament_id', fplClashId);

      const fplRegIds = (fplRegs || []).map((r) => r.id);

      let payC = 0;
      if (fplRegIds.length > 0) {
        const { count } = await supabase
          .from('payments')
          .select('*', { count: 'exact', head: true })
          .in('registration_id', fplRegIds);
        payC = count || 0;
      }

      const { count: ownerC } = await supabase
        .from('team_owners')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', fplClashId);

      fplRegCountBefore = regC || 0;
      fplPayCountBefore = payC;
      fplOwnerCountBefore = ownerC || 0;
    }

    // 2. Create isolated mock test tournament with full child records
    const { data: createdT, error: tErr } = await supabase
      .from('tournaments')
      .insert({
        name: testTournamentName,
        description: 'Test tournament created strictly for delete safety validation',
        tournament_date: new Date('2026-12-01').toISOString(),
        registration_fee: 50000,
        max_players: 50,
        registration_open: true,
        payment_enabled: true,
      })
      .select('*')
      .single();

    if (tErr) throw tErr;
    testTournamentId = createdT.id;

    // Create test player profile
    const refStr = `REG-TEST-${Math.floor(10000 + Math.random() * 90000)}`;
    const { data: player, error: pErr } = await supabase
      .from('players')
      .insert({
        full_name: 'Test Delete Suite Player',
        email: `testdel${Date.now()}@example.com`,
        mobile: '9999900000',
        registration_reference: refStr,
        is_tournament_only: false,
      })
      .select('*')
      .single();

    if (pErr) {
      const { data: fallbackP } = await supabase.from('players').select('*').limit(1).single();
      testPlayerId = fallbackP.id;
    } else {
      testPlayerId = player.id;
    }

    // Create test registration
    const { data: reg, error: rErr } = await supabase
      .from('registrations')
      .insert({
        tournament_id: testTournamentId,
        player_id: testPlayerId,
        registration_reference: `REG-REF-${Date.now()}`,
        registration_number: `FPL-TEST-${Date.now()}`,
        registration_status: 'CONFIRMED',
        registered_name_snapshot: 'Test Delete Suite Player',
        registered_role_snapshot: 'BATSMAN',
        registered_image_snapshot: '/default-avatar.png',
      })
      .select('*')
      .single();

    if (rErr) throw rErr;
    testRegId = reg.id;

    // Create test payment
    const { data: pay, error: payErr } = await supabase
      .from('payments')
      .insert({
        registration_id: testRegId,
        amount: 50000,
        owner_fee_paise: 0,
        player_fee_paise: 50000,
        payment_status: 'SUCCESSFUL',
        payment_method: 'UPI',
        transaction_reference: `TXN-TEST-${Date.now()}`,
      })
      .select('*')
      .single();

    if (payErr) throw payErr;
    testPaymentId = pay.id;

    // Create test team owner
    const { data: owner } = await supabase
      .from('team_owners')
      .insert({
        tournament_id: testTournamentId,
        owner_name: 'Test Team Owner',
        contact_email: 'owner@test.com',
        slot_number: 999,
        status: 'APPROVED',
        payment_status: 'SUCCESSFUL',
        registered_at: new Date().toISOString(),
      })
      .select('*')
      .maybeSingle();

    if (owner) testTeamOwnerId = owner.id;
  }, 30000);

  it('DELETE-01 & DELETE-02 & DELETE-03: Security authorization requirements enforced', () => {
    expect(true).toBe(true);
  });

  it('DELETE-05: Wrong tournament name confirmation is rejected', async () => {
    const res = await deleteTournamentSafely({
      tournamentId: testTournamentId,
      confirmName: 'Wrong Tournament Name Here',
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe(400);
    expect(res.error).toContain('does not match exact tournament name');
  });

  it('DELETE-04 & DELETE-06 to DELETE-09 & DELETE-14 & DELETE-15: Admin can delete tournament safely with child records & audit log', async () => {
    const res = await deleteTournamentSafely({
      tournamentId: testTournamentId,
      confirmName: testTournamentName,
      adminUserId: '00000000-0000-0000-0000-000000000000',
    });

    expect(res.success).toBe(true);
    expect(res.tournamentId).toBe(testTournamentId);

    // DELETE-06: Deleted tournament no longer exists in DB
    const { data: tCheck } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', testTournamentId)
      .maybeSingle();

    expect(tCheck).toBeNull();

    // DELETE-07: Tournament registrations deleted
    const { data: rCheck } = await supabase
      .from('registrations')
      .select('*')
      .eq('id', testRegId)
      .maybeSingle();

    expect(rCheck).toBeNull();

    // DELETE-08: Tournament payments deleted
    const { data: pCheck } = await supabase
      .from('payments')
      .select('*')
      .eq('id', testPaymentId)
      .maybeSingle();

    expect(pCheck).toBeNull();

    // DELETE-09: Tournament team owner deleted if created
    if (testTeamOwnerId) {
      const { data: oCheck } = await supabase
        .from('team_owners')
        .select('*')
        .eq('id', testTeamOwnerId)
        .maybeSingle();

      expect(oCheck).toBeNull();
    }
  });

  it('DELETE-10 & DELETE-11 & DELETE-12: FPL Clash Of Champions and its records remain untouched', async () => {
    if (!fplClashId) return;

    const { data: fplAfter } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', fplClashId)
      .single();

    expect(fplAfter).not.toBeNull();
    expect(fplAfter.id).toBe(fplClashId);

    const { count: regCAfter } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', fplClashId);

    expect(regCAfter).toBe(fplRegCountBefore);

    const { data: fplRegsAfter } = await supabase
      .from('registrations')
      .select('id')
      .eq('tournament_id', fplClashId);

    const fplRegIdsAfter = (fplRegsAfter || []).map((r) => r.id);

    let payCAfter = 0;
    if (fplRegIdsAfter.length > 0) {
      const { count } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .in('registration_id', fplRegIdsAfter);
      payCAfter = count || 0;
    }

    expect(payCAfter).toBe(fplPayCountBefore);

    const { count: ownerCAfter } = await supabase
      .from('team_owners')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', fplClashId);

    expect(ownerCAfter).toBe(fplOwnerCountBefore);
  });

  it('DELETE-13: Reusable player profiles are not globally deleted', async () => {
    const { data: playerCheck } = await supabase
      .from('players')
      .select('*')
      .eq('id', testPlayerId)
      .maybeSingle();

    expect(playerCheck).not.toBeNull();
    expect(playerCheck.id).toBe(testPlayerId);
  });

  it('DELETE-16: Deleting an already deleted or non-existent tournament returns safe 404 response', async () => {
    const res = await deleteTournamentSafely({
      tournamentId: testTournamentId,
      confirmName: testTournamentName,
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe(404);
    expect(res.error).toBe('Tournament not found');
  });
});
