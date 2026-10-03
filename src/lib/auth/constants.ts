export const ADMIN_EMAILS = [
  'atulpawar07@gmail.com',
  'titusalex786@gmail.com',
  'fairplaypremierleague@gmail.com',
];
export const ADMIN_EMAIL = 'atulpawar07@gmail.com';

export function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return ADMIN_EMAILS.some((admin) => admin.toLowerCase() === clean);
}

