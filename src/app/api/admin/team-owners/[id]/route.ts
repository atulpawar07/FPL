import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/is-admin';
import { logAdminAction } from '@/lib/audit/logger';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAdmin();
    const { id: ownerId } = await params;

    if (!ownerId) {
      return NextResponse.json({ error: 'Team Owner ID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Fetch team owner record to get linked registration IDs
    const { data: owner } = await supabase
      .from('team_owners')
      .select('*')
      .eq('id', ownerId)
      .maybeSingle();

    const linkedRegIds: string[] = [];
    if (owner?.owner_registration_id) linkedRegIds.push(owner.owner_registration_id);
    if (owner?.icon_registration_id) linkedRegIds.push(owner.icon_registration_id);

    // Fetch any other registrations with team_owner_id = ownerId
    const { data: extraRegs } = await supabase
      .from('registrations')
      .select('id')
      .eq('team_owner_id', ownerId);

    if (extraRegs) {
      extraRegs.forEach((r) => linkedRegIds.push(r.id));
    }

    // 2. Delete payments for linked registrations
    if (linkedRegIds.length > 0) {
      await supabase.from('payments').delete().in('registration_id', linkedRegIds);
      await supabase.from('registrations').delete().in('id', linkedRegIds);
    }

    // 3. Delete team owner record
    const { error: delOwnerErr } = await supabase
      .from('team_owners')
      .delete()
      .eq('id', ownerId);

    if (delOwnerErr) {
      throw delOwnerErr;
    }

    await logAdminAction({
      adminUserId: user.id,
      action: 'DELETE_TEAM_OWNER',
      entityType: 'TEAM_OWNER',
      entityId: ownerId,
      oldValue: owner,
    });

    return NextResponse.json({
      success: true,
      message: 'Team Owner entry and linked squad records deleted successfully',
    });
  } catch (err: any) {
    const status = err.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Failed to delete team owner entry' }, { status });
  }
}
