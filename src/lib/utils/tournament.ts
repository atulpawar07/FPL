import { DbTournament } from '@/types';

/**
 * Safely parses a tournament date string into a Date object.
 * Handles both date-only strings ("YYYY-MM-DD") and ISO strings ("YYYY-MM-DDTHH:mm:ss.sssZ").
 */
export function parseTournamentDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Handle YYYY-MM-DD format explicitly to avoid UTC off-by-one shifts
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch.map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Returns timestamp for sorting tournament dates chronologically.
 */
export function getTournamentTimestamp(dateStr?: string | null): number {
  const date = parseTournamentDate(dateStr);
  return date ? date.getTime() : 0;
}

/**
 * Checks if a tournament date is today or in the future.
 * Compares start-of-day calendar dates so same-day tournaments are included,
 * avoiding timezone off-by-one shifts (e.g. in India/IST).
 */
export function isUpcomingTournament(dateStr?: string | null, referenceDate: Date = new Date()): boolean {
  const tournamentDate = parseTournamentDate(dateStr);
  if (!tournamentDate) return false;

  const refStartOfDay = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  ).getTime();

  const tourneyStartOfDay = new Date(
    tournamentDate.getFullYear(),
    tournamentDate.getMonth(),
    tournamentDate.getDate()
  ).getTime();

  return tourneyStartOfDay >= refStartOfDay;
}

/**
 * Filters and sorts tournaments to get upcoming tournaments ordered by date ascending.
 * Nearest upcoming tournament will be at index 0.
 */
export function getSortedUpcomingTournaments(
  tournaments: DbTournament[],
  referenceDate: Date = new Date()
): DbTournament[] {
  if (!Array.isArray(tournaments)) return [];

  return tournaments
    .filter((t) => isUpcomingTournament(t.tournament_date, referenceDate))
    .sort(
      (a, b) =>
        getTournamentTimestamp(a.tournament_date) - getTournamentTimestamp(b.tournament_date)
    );
}
