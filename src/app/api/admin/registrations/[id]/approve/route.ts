import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireManager } from '@/lib/auth/is-manager';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, role } = await requireManager();
    const { id: registrationId } = await params;
    const body = await req.json().catch(() => ({}));
    const { transactionReference, verificationNote, action = 'APPROVE' } = body;

    const supabase = createAdminClient();

    // Fetch registration record
    const { data: registration, error: regErr } = await supabase
      .from('registrations')
      .select('id, player_id, tournament_id')
      .eq('id', registrationId)
      .maybeSingle();

    if (regErr || !registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    const newStatus = action === 'REJECT' ? 'CANCELLED' : 'CONFIRMED';
    const newPaymentStatus = action === 'REJECT' ? 'FAILED' : 'SUCCESSFUL';

    // Fetch full registration detail to check team_owner_id
    const { data: fullReg } = await supabase
      .from('registrations')
      .select('id, team_owner_id, registration_type')
      .eq('id', registrationId)
      .maybeSingle();

    // Update registration status (both status and registration_status for full compatibility)
    const { error: updateRegErr } = await supabase
      .from('registrations')
      .update({
        status: newStatus,
        registration_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId);

    if (updateRegErr) {
      return NextResponse.json({ error: updateRegErr.message || 'Failed to update registration status' }, { status: 500 });
    }

    // Mapped update to associated team_owners table if linked
    if (fullReg?.team_owner_id) {
      const ownerStatus = newStatus === 'CONFIRMED' ? 'APPROVED' : 'REJECTED';
      await supabase
        .from('team_owners')
        .update({
          status: ownerStatus,
          payment_status: newPaymentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', fullReg.team_owner_id);
    }

    // Upsert payment record
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('registration_id', registrationId)
      .maybeSingle();

    const noteText = verificationNote || `${action === 'REJECT' ? 'Rejected' : 'Approved'} by ${role} (${user.email})`;

    if (existingPayment) {
      await supabase
        .from('payments')
        .update({
          payment_status: newPaymentStatus,
          transaction_reference: transactionReference || `${role}-ACTION-${Date.now()}`,
          verification_note: noteText,
          verified_by: user.email,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPayment.id);
    } else {
      await supabase.from('payments').insert({
        registration_id: registrationId,
        amount: 50000,
        payment_method: 'UPI_QR',
        payment_status: newPaymentStatus,
        transaction_reference: transactionReference || `${role}-ACTION-${Date.now()}`,
        verification_note: noteText,
        verified_by: user.email,
        verified_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: `Player registration ${action.toLowerCase()}d successfully!`,
      registrationId,
      status: newStatus,
    });
  } catch (err: any) {
    const status = err.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status });
  }
}
