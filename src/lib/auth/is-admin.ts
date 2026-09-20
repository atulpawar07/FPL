import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from './constants';

export { ADMIN_EMAIL };

export async function checkIsAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    return { isAdmin: false, user: null };
  }

  const isAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  return { isAdmin, user };
}

export async function requireAdmin() {
  const { isAdmin, user } = await checkIsAdmin();
  if (!isAdmin || !user) {
    throw new Error('Unauthorized: Admin access required');
  }
  return user;
}
