import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ADMIN_EMAIL, ADMIN_EMAILS } from './constants';

export async function checkIsManagerOrAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    return { isManager: false, isAdmin: false, user: null, role: null };
  }

  const email = user.email.toLowerCase();
  const adminClient = createAdminClient();

  // 1. Check DB-backed admin_users
  const { data: adminEntry } = await adminClient
    .from('admin_users')
    .select('id, role, status')
    .eq('id', user.id)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (adminEntry) {
    return { isManager: true, isAdmin: true, user, role: (adminEntry.role || 'ADMIN') as any };
  }

  // 2. Check managers table
  const { data: managerEntry } = await adminClient
    .from('managers')
    .select('id, is_active')
    .ilike('user_email', email)
    .eq('is_active', true)
    .maybeSingle();

  const isManager = !!managerEntry;
  return {
    isManager,
    isAdmin: false,
    user,
    role: isManager ? ('MANAGER' as const) : null,
  };
}

export async function requireManager() {
  const { isManager, isAdmin, user, role } = await checkIsManagerOrAdmin();
  if (!isManager || !user) {
    throw new Error('Unauthorized: Manager or Admin access required');
  }
  return { user, isAdmin, role };
}
