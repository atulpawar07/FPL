import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ADMIN_EMAIL } from './constants';

export { ADMIN_EMAIL };

export async function checkIsAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    return { isAdmin: false, user: null, role: null };
  }

  // Database-backed admin check via admin_users table
  const adminClient = createAdminClient();
  const { data: adminEntry } = await adminClient
    .from('admin_users')
    .select('id, role, status')
    .eq('id', user.id)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  const isBootstrapAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const isAdmin = !!adminEntry || isBootstrapAdmin;
  const role = adminEntry?.role || (isBootstrapAdmin ? 'SUPER_ADMIN' : null);

  return { isAdmin, user, role };
}

export async function requireAdmin() {
  const { isAdmin, user, role } = await checkIsAdmin();
  if (!isAdmin || !user) {
    throw new Error('Unauthorized: Admin access required');
  }
  return { user, role };
}

