import { RegistrationStatus, PaymentStatus, CricketRole } from '@/types';

/**
 * Generates a unique, non-sequential registration reference.
 * Example format: REG-2026-84920
 */
export function generateRegistrationReference(year: number = new Date().getFullYear()): string {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `REG-${year}-${randomNum}`;
}

/**
 * Formats an integer amount in paise into an INR currency string.
 * Example: 50000 -> "₹500" or "₹500.00"
 */
export function formatPaiseToINR(paise: number, includeDecimals = false): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: includeDecimals ? 2 : 0,
    minimumFractionDigits: includeDecimals ? 2 : 0,
  }).format(rupees);
}

/**
 * Formats ISO date string into a user-friendly format (e.g. 15 Mar 2026).
 */
export function formatDate(dateString?: string | null): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Human-readable label mapping for Cricket Roles
 */
export const cricketRoleLabels: Record<CricketRole, string> = {
  BATSMAN: 'Batsman',
  BOWLER: 'Bowler',
  ALL_ROUNDER: 'All-rounder',
  BATSMAN_WICKETKEEPER: 'Batsman + Wicketkeeper',
  BOWLER_WICKETKEEPER: 'Bowler + Wicketkeeper',
};

/**
 * Human-readable label mapping for Registration Statuses
 */
export const registrationStatusLabels: Record<RegistrationStatus, string> = {
  CONFIRMED: 'Confirmed Slot',
  WAITING_LIST: 'Waitlist',
  CANCELLED: 'Cancelled',
  PENDING: 'Pending Review',
  REJECTED: 'Rejected',
};

/**
 * Human-readable label mapping for Payment Statuses
 */
export const paymentStatusLabels: Record<PaymentStatus, string> = {
  PENDING: 'Pending Verification',
  SUCCESSFUL: 'Successful (Paid)',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
  AWAITING_ORGANISER_ACKNOWLEDGEMENT: 'Awaiting Organiser Ack',
  CANCELLED: 'Cancelled',
  CREATED: 'Created',
  PROCESSING: 'Processing',
};
