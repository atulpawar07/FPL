import { describe, it, expect } from 'vitest';
import {
  isUpcomingTournament,
  isTournamentCompleted,
  getTournamentTimestamp,
  getOrderedTournaments,
  getSortedUpcomingTournaments,
  parseTournamentDate,
} from '../lib/utils/tournament';
import { DbTournament } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTournament(overrides: Partial<DbTournament> & { id: string }): DbTournament {
  return {
    name: `Tournament ${overrides.id}`,
    description: null,
    logo_url: null,
    tournament_date: '2026-10-24T00:00:00.000Z',
    registration_fee: 50000,
    max_players: 50,
    registration_open: true,
    payment_enabled: true,
    upi_id: null,
    payment_qr_url: null,
    created_by: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

const TODAY = new Date('2026-10-25T12:00:00+05:30'); // Simulated "today" — after FPL tournament_date

// Tournaments ordered as the API would return them (created_at DESC)
const tNewest = makeTournament({
  id: 'new-1',
  name: 'Tournament B — Newest',
  tournament_date: '2026-11-15T00:00:00.000Z',
  created_at: '2026-10-20T00:00:00.000Z',
  registration_open: true,
});

const tOlder = makeTournament({
  id: 'old-1',
  name: 'Tournament A — Older',
  tournament_date: '2026-10-24T00:00:00.000Z', // past relative to TODAY
  created_at: '2026-09-01T00:00:00.000Z',
  registration_open: false,
});

const tPastRegistrationClosed = makeTournament({
  id: 'past-closed',
  name: 'Past Closed Tournament',
  tournament_date: '2026-09-10T00:00:00.000Z',
  created_at: '2026-08-01T00:00:00.000Z',
  registration_open: false,
});

const tFutureRegistrationClosed = makeTournament({
  id: 'future-closed',
  name: 'Future but Registration Closed',
  tournament_date: '2026-12-01T00:00:00.000Z',
  created_at: '2026-10-15T00:00:00.000Z',
  registration_open: false,
});

// The real FPL tournament (must remain unchanged)
const tFPL = makeTournament({
  id: 'edfb6464-c326-4ad8-af8f-b0113f9bdcf3',
  name: 'FPL 4th Anniversary League- Clash Of Champions',
  tournament_date: '2026-10-24T00:00:00.000Z',
  created_at: '2026-09-15T00:00:00.000Z',
  registration_open: false,
  banner_url: 'https://example.com/fpl-banner.jpg',
});

// ---------------------------------------------------------------------------
// getOrderedTournaments — core ordering rule
// ---------------------------------------------------------------------------
describe('getOrderedTournaments — created_at DESC ordering', () => {

  it('CASE 1: Single tournament → appears at index 0 (hero)', () => {
    const result = getOrderedTournaments([tFPL]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('edfb6464-c326-4ad8-af8f-b0113f9bdcf3');
  });

  it('CASE 2: Two tournaments — newest created is first', () => {
    // API returns newest first (created_at DESC) — function preserves that order
    const apiOrder = [tNewest, tOlder]; // newest has created_at 2026-10-20, older has 2026-09-01
    const result = getOrderedTournaments(apiOrder);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('new-1');
    expect(result[1].id).toBe('old-1');
  });

  it('CASE 3: Newest tournament has a future date → still first', () => {
    const apiOrder = [tNewest, tOlder]; // tNewest has future date Nov 15
    const result = getOrderedTournaments(apiOrder);
    expect(result[0].id).toBe('new-1');
    expect(result[0].tournament_date).toBe('2026-11-15T00:00:00.000Z');
  });

  it('CASE 4: Newest tournament date has already passed → STILL appears first', () => {
    // tOlder has date 2026-10-24 which is before TODAY (2026-10-25)
    // If tOlder is the newest, it must still be hero
    const newestButPast = makeTournament({
      id: 'newest-past',
      name: 'Newest But Past',
      tournament_date: '2026-10-24T00:00:00.000Z', // past
      created_at: '2026-10-22T00:00:00.000Z',       // most recent creation
    });
    const apiOrder = [newestButPast, tOlder]; // API would return newest-past first
    const result = getOrderedTournaments(apiOrder);
    expect(result[0].id).toBe('newest-past');
    expect(isTournamentCompleted(result[0].tournament_date, TODAY)).toBe(true);
  });

  it('CASE 5: Newest tournament has registration_open=false → STILL appears first', () => {
    const apiOrder = [tFutureRegistrationClosed, tOlder];
    const result = getOrderedTournaments(apiOrder);
    expect(result[0].id).toBe('future-closed');
    expect(result[0].registration_open).toBe(false);
  });

  it('CASE 6: New tournament created → becomes first, old moves below', () => {
    // Before: [tOlder] → hero=tOlder
    const before = getOrderedTournaments([tOlder]);
    expect(before[0].id).toBe('old-1');

    // After: admin creates tNewest → API now returns [tNewest, tOlder]
    const after = getOrderedTournaments([tNewest, tOlder]);
    expect(after[0].id).toBe('new-1');  // new tournament is hero
    expect(after[1].id).toBe('old-1'); // old moves below
  });

  it('CASE 7: Previous tournament moves below the new one', () => {
    const apiOrder = [tNewest, tFPL, tOlder];
    const result = getOrderedTournaments(apiOrder);
    expect(result[0].id).toBe('new-1');
    expect(result.slice(1).map(t => t.id)).not.toContain('new-1'); // hero not duplicated below
    expect(result[1].id).toBe('edfb6464-c326-4ad8-af8f-b0113f9bdcf3');
    expect(result[2].id).toBe('old-1');
  });

  it('CASE 8: Multiple tournaments strictly ordered by created_at DESC', () => {
    // API guarantees this order; function must NOT re-sort
    const apiOrder = [tNewest, tFutureRegistrationClosed, tFPL, tOlder, tPastRegistrationClosed];
    const result = getOrderedTournaments(apiOrder);
    expect(result.map(t => t.id)).toEqual([
      'new-1',
      'future-closed',
      'edfb6464-c326-4ad8-af8f-b0113f9bdcf3',
      'old-1',
      'past-closed',
    ]);
  });

  it('CASE 9: Same created_at — order is preserved (API handles tie-break by id DESC)', () => {
    const tA = makeTournament({ id: 'zzz-later-id', created_at: '2026-10-01T00:00:00.000Z' });
    const tB = makeTournament({ id: 'aaa-earlier-id', created_at: '2026-10-01T00:00:00.000Z' });
    // API would return id DESC → zzz-later-id first
    const apiOrder = [tA, tB];
    const result = getOrderedTournaments(apiOrder);
    expect(result[0].id).toBe('zzz-later-id');
    expect(result[1].id).toBe('aaa-earlier-id');
  });

  it('CASE 10: No tournaments → returns empty array (homepage handles gracefully)', () => {
    const result = getOrderedTournaments([]);
    expect(result).toHaveLength(0);
    const hero = result[0] || null;
    expect(hero).toBeNull();
  });

  it('CASE 11: FPL tournament data remains unchanged after ordering', () => {
    const result = getOrderedTournaments([tFPL]);
    const fpl = result[0];
    expect(fpl.id).toBe('edfb6464-c326-4ad8-af8f-b0113f9bdcf3');
    expect(fpl.name).toBe('FPL 4th Anniversary League- Clash Of Champions');
    expect(fpl.banner_url).toBe('https://example.com/fpl-banner.jpg');
    expect(fpl.registration_open).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isTournamentCompleted — display-only badge helper
// ---------------------------------------------------------------------------
describe('isTournamentCompleted — display-only badge', () => {
  it('Returns true for a date in the past', () => {
    expect(isTournamentCompleted('2026-10-24T00:00:00.000Z', TODAY)).toBe(true);
  });

  it('Returns false for today (same calendar day)', () => {
    const sameDay = new Date('2026-10-25T00:00:00.000Z');
    expect(isTournamentCompleted('2026-10-25', sameDay)).toBe(false);
  });

  it('Returns false for a future date', () => {
    expect(isTournamentCompleted('2026-11-15T00:00:00.000Z', TODAY)).toBe(false);
  });

  it('Returns true for null/missing date', () => {
    expect(isTournamentCompleted(null, TODAY)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Legacy helpers — backward compatibility
// ---------------------------------------------------------------------------
describe('parseTournamentDate — YYYY-MM-DD without timezone shift', () => {
  it('Safely parses YYYY-MM-DD date strings without timezone shifts', () => {
    const parsed = parseTournamentDate('2026-09-26');
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(8); // September is 0-indexed 8
    expect(parsed?.getDate()).toBe(26);
  });
});

describe('getSortedUpcomingTournaments — deprecated legacy behaviour', () => {
  const refDate = new Date('2026-09-26T12:00:00+05:30');

  it('Still filters by date and sorts ASC (legacy — not used by homepage)', () => {
    const past = makeTournament({ id: 'p1', tournament_date: '2026-09-10T00:00:00.000Z' });
    const future = makeTournament({ id: 'f1', tournament_date: '2026-10-20T00:00:00.000Z' });
    const result = getSortedUpcomingTournaments([past, future], refDate);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('f1');
  });

  it('Returns empty when all tournaments are past (legacy)', () => {
    const past = makeTournament({ id: 'p2', tournament_date: '2026-09-10T00:00:00.000Z' });
    const result = getSortedUpcomingTournaments([past], refDate);
    expect(result).toHaveLength(0);
  });
});
