import { createAdminClient } from '@/lib/supabase/admin';

export interface AuditLogEntry {
  adminUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: any;
  newValue?: any;
}

export async function logAdminAction(entry: AuditLogEntry) {
  try {
    const supabase = createAdminClient();
    await supabase.from('audit_logs').insert({
      admin_user_id: entry.adminUserId || null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      old_value: entry.oldValue ? JSON.stringify(entry.oldValue) : null,
      new_value: entry.newValue ? JSON.stringify(entry.newValue) : null,
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
