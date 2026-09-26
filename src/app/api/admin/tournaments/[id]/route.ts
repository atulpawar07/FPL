import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/is-admin';
import { logAdminAction } from '@/lib/audit/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: tournament, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    return NextResponse.json({ tournament });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAdmin();
    const { id } = await params;
    const body = await req.json();

    const supabase = createAdminClient();

    const { data: oldTournament } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.name) updatePayload.name = body.name.trim();
    if (body.description !== undefined) updatePayload.description = body.description;
    if (body.tournamentDate) updatePayload.tournament_date = new Date(body.tournamentDate).toISOString();
    if (body.registrationFee !== undefined) updatePayload.registration_fee = Number(body.registrationFee);
    if (body.maxPlayers !== undefined) updatePayload.max_players = Number(body.maxPlayers);
    if (body.registrationOpen !== undefined) updatePayload.registration_open = Boolean(body.registrationOpen);
    if (body.paymentEnabled !== undefined) updatePayload.payment_enabled = Boolean(body.paymentEnabled);
    if (body.upiId !== undefined) updatePayload.upi_id = body.upiId;
    if (body.paymentQrUrl !== undefined) updatePayload.payment_qr_url = body.paymentQrUrl;

    const { data: updatedTournament, error } = await supabase
      .from('tournaments')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !updatedTournament) {
      return NextResponse.json({ error: error?.message || 'Failed to update tournament details' }, { status: 500 });
    }

    await logAdminAction({
      adminUserId: user.id,
      action: 'UPDATE_TOURNAMENT',
      entityType: 'TOURNAMENT',
      entityId: id,
      oldValue: oldTournament,
      newValue: updatedTournament,
    });

    return NextResponse.json({
      success: true,
      message: 'Tournament details updated successfully!',
      tournament: updatedTournament,
    });
  } catch (err: any) {
    const status = err.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status });
  }
}
