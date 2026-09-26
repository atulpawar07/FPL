import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/is-admin';
import { logAdminAction } from '@/lib/audit/logger';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAdmin();
    const { id: registrationId } = await params;

    if (!registrationId) {
      return NextResponse.json({ error: 'Registration ID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Delete associated payments
    await supabase.from('payments').delete().eq('registration_id', registrationId);

    // 2. Delete registration record
    const { error: delErr } = await supabase
      .from('registrations')
      .delete()
      .eq('id', registrationId);

    if (delErr) {
      throw delErr;
    }

    await logAdminAction({
      adminUserId: user.id,
      action: 'DELETE_REGISTRATION',
      entityType: 'REGISTRATION',
      entityId: registrationId,
    });

    return NextResponse.json({
      success: true,
      message: 'Player registration entry deleted successfully',
    });
  } catch (err: any) {
    const status = err.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Failed to delete registration' }, { status });
  }
}
