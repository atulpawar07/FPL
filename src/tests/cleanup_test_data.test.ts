import { describe, it, expect } from 'vitest';
import { deleteTournamentSafely } from '../lib/tournament/delete';
import { createAdminClient } from '../lib/supabase/admin';

describe('Test Tournament Data Cleanup Execution', () => {
  const supabase = createAdminClient();
  const fplClashId = 'edfb6464-c326-4ad8-af8f-b0113f9bdcf3';

  it('Deletes all temporary test tournaments and verifies only FPL Clash Of Champions remains', async () => {
    // 1. Fetch all tournaments except FPL Clash Of Champions
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('*')
      .neq('id', fplClashId);

    for (const t of tournaments || []) {
      console.log(`Deleting remaining test tournament: ${t.name} (${t.id})`);
      await deleteTournamentSafely({ tournamentId: t.id });
    }

    // 2. Verify final counts
    const { count: tCount } = await supabase.from('tournaments').select('*', { count: 'exact', head: true });
    const { count: rCount } = await supabase.from('registrations').select('*', { count: 'exact', head: true });
    const { count: pCount } = await supabase.from('payments').select('*', { count: 'exact', head: true });
    const { count: oCount } = await supabase.from('team_owners').select('*', { count: 'exact', head: true });
    const { count: plCount } = await supabase.from('players').select('*', { count: 'exact', head: true });

    console.log('=== FINAL CLEANUP DATABASE TOTALS ===');
    console.log({
      tournaments: tCount,
      registrations: rCount,
      payments: pCount,
      teamOwners: oCount,
      players: plCount,
    });

    // FPL Clash Of Champions must be 100% intact
    const { data: fpl } = await supabase.from('tournaments').select('*').eq('id', fplClashId).single();
    expect(fpl).not.toBeNull();
    expect(fpl.name).toContain('FPL 4th Anniversary League');

    const { count: fplRegs } = await supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('tournament_id', fplClashId);
    expect(fplRegs).toBe(10);

    const { count: fplOwners } = await supabase.from('team_owners').select('*', { count: 'exact', head: true }).eq('tournament_id', fplClashId);
    expect(fplOwners).toBe(1);

    expect(tCount).toBe(1);
    expect(rCount).toBe(10);
    expect(pCount).toBe(9);
    expect(oCount).toBe(1);
  }, 60000);
});
