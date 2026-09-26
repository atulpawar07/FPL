import { describe, it, expect } from 'vitest';
import {
  isUpcomingTournament,
  getTournamentTimestamp,
  getSortedUpcomingTournaments,
  parseTournamentDate,
} from '../lib/utils/tournament';
import { DbTournament } from '../types';

describe('Homepage Tournament Ordering and Featured Tournament Selection', () => {
  const refDate = new Date('2026-09-26T12:00:00+05:30'); // Simulated Today: 26-Sep-2026

  const mockPastTournament: DbTournament = {
    id: 'past-1',
    name: 'Old Test Tournament',
    description: 'Past tournament',
    logo_url: null,
    tournament_date: '2026-09-10T00:00:00.000Z',
    registration_fee: 50000,
    max_players: 50,
    registration_open: true,
    payment_enabled: true,
    upi_id: null,
    payment_qr_url: null,
    created_by: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  };

  const mockPastTournament2: DbTournament = {
    id: 'past-2',
    name: 'Capacity Test',
    description: 'Past tournament 2',
    logo_url: null,
    tournament_date: '2026-09-15T00:00:00.000Z',
    registration_fee: 50000,
    max_players: 50,
    registration_open: false,
    payment_enabled: true,
    upi_id: null,
    payment_qr_url: null,
    created_by: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  };

  const mockTodayTournament: DbTournament = {
    id: 'today-1',
    name: 'Tournament Happening Today',
    description: 'Same day tournament',
    logo_url: null,
    tournament_date: '2026-09-26T00:00:00.000Z',
    registration_fee: 50000,
    max_players: 50,
    registration_open: true,
    payment_enabled: true,
    upi_id: null,
    payment_qr_url: null,
    created_by: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  };

  const mockNearestUpcoming: DbTournament = {
    id: 'fpl-4th-anniversary',
    name: 'FPL 4th Anniversary League- Clash Of...',
    description: 'Nearest upcoming tournament',
    logo_url: null,
    tournament_date: '2026-10-20T00:00:00.000Z',
    registration_fee: 60000,
    max_players: 100,
    registration_open: false, // Closed registration, but future date
    payment_enabled: true,
    upi_id: null,
    payment_qr_url: null,
    created_by: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    banner_url: 'https://example.com/banner.jpg',
  };

  const mockLaterUpcoming: DbTournament = {
    id: 'future-2',
    name: 'Another Tournament',
    description: 'Later upcoming tournament',
    logo_url: null,
    tournament_date: '2026-11-15T00:00:00.000Z',
    registration_fee: 50000,
    max_players: 50,
    registration_open: true,
    payment_enabled: true,
    upi_id: null,
    payment_qr_url: null,
    created_by: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  };

  it('CASE 1: Past tournament + future tournament -> Future = hero, Past = hidden', () => {
    const list = [mockPastTournament, mockPastTournament2, mockNearestUpcoming];
    const upcoming = getSortedUpcomingTournaments(list, refDate);

    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].id).toBe('fpl-4th-anniversary');

    const hero = upcoming[0] || null;
    const cardsBelow = upcoming.slice(1);

    expect(hero?.name).toBe('FPL 4th Anniversary League- Clash Of...');
    expect(cardsBelow).toHaveLength(0);
  });

  it('CASE 2: Multiple future tournaments -> Nearest = hero, Remaining = cards below, no duplicate in cards', () => {
    const list = [mockPastTournament, mockLaterUpcoming, mockNearestUpcoming, mockPastTournament2];
    const upcoming = getSortedUpcomingTournaments(list, refDate);

    expect(upcoming).toHaveLength(2);
    expect(upcoming[0].id).toBe('fpl-4th-anniversary');
    expect(upcoming[1].id).toBe('future-2');

    const hero = upcoming[0];
    const cardsBelow = upcoming.slice(1);

    expect(hero.id).toBe('fpl-4th-anniversary');
    expect(cardsBelow).toHaveLength(1);
    expect(cardsBelow[0].id).toBe('future-2');
    expect(cardsBelow.find((t) => t.id === hero.id)).toBeUndefined();
  });

  it('CASE 3: Future tournament with registration_open=false becomes hero if nearest upcoming', () => {
    const list = [mockNearestUpcoming]; // registration_open: false, date: Oct 20
    const upcoming = getSortedUpcomingTournaments(list, refDate);

    expect(upcoming).toHaveLength(1);
    const hero = upcoming[0];
    expect(hero.id).toBe('fpl-4th-anniversary');
    expect(hero.registration_open).toBe(false);
  });

  it('CASE 4: Future tournament with registration_open=true becomes hero if nearest upcoming', () => {
    const list = [mockLaterUpcoming]; // registration_open: true, date: Nov 15
    const upcoming = getSortedUpcomingTournaments(list, refDate);

    expect(upcoming).toHaveLength(1);
    const hero = upcoming[0];
    expect(hero.id).toBe('future-2');
    expect(hero.registration_open).toBe(true);
  });

  it('CASE 5: Tournament today is treated as upcoming', () => {
    const list = [mockPastTournament, mockTodayTournament];
    const upcoming = getSortedUpcomingTournaments(list, refDate);

    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].id).toBe('today-1');
  });

  it('CASE 6: No future/today tournaments -> Empty list returned for hero fallback and empty state', () => {
    const list = [mockPastTournament, mockPastTournament2];
    const upcoming = getSortedUpcomingTournaments(list, refDate);

    expect(upcoming).toHaveLength(0);
    const hero = upcoming[0] || null;
    expect(hero).toBeNull();
  });

  it('CASE 7: Featured tournament banner_url is retained', () => {
    const list = [mockNearestUpcoming];
    const upcoming = getSortedUpcomingTournaments(list, refDate);
    expect(upcoming[0].banner_url).toBe('https://example.com/banner.jpg');
  });

  it('CASE 8: Featured tournament has no banner_url fallback', () => {
    const list = [mockLaterUpcoming];
    const upcoming = getSortedUpcomingTournaments(list, refDate);
    expect(upcoming[0].banner_url).toBeUndefined();
  });

  it('Safely parses YYYY-MM-DD date strings without timezone shifts', () => {
    const parsed = parseTournamentDate('2026-09-26');
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(8); // September is 0-indexed 8
    expect(parsed?.getDate()).toBe(26);
  });
});
