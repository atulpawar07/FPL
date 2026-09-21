import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/is-admin';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id: playerId } = await params;

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Fetch player registrations
    const { data: playerRegs } = await supabase
      .from('registrations')
      .select('id')
      .eq('player_id', playerId);

    const regIds = (playerRegs || []).map((r) => r.id);

    // 2. Delete payments linked to these registrations
    if (regIds.length > 0) {
      await supabase.from('payments').delete().in('registration_id', regIds);
      await supabase.from('registrations').delete().in('id', regIds);
    }

    // 3. Delete team owners associated with this player_id
    await supabase.from('team_owners').delete().eq('player_id', playerId);

    // 4. Delete player profile record
    const { error: delErr } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId);

    if (delErr) {
      throw delErr;
    }

    return NextResponse.json({
      success: true,
      message: 'Player profile and all associated data deleted successfully',
    });
  } catch (err: any) {
    const status = err.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Failed to delete player entry' }, { status });
  }
}
