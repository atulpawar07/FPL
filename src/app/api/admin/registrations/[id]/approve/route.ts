import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: registrationId } = await params;
    const body = await req.json().catch(() => ({}));
    const { transactionReference, verificationNote } = body;

    const supabase = createAdminClient();

    // 1. Fetch registration record
    const { data: registration, error: regErr } = await supabase
      .from('registrations')
      .select('id, player_id, tournament_id')
      .eq('id', registrationId)
      .maybeSingle();

    if (regErr || !registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // 2. Update registration status to CONFIRMED
    const { error: updateRegErr } = await supabase
      .from('registrations')
      .update({
        registration_status: 'CONFIRMED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId);

    if (updateRegErr) {
      return NextResponse.json({ error: updateRegErr.message || 'Failed to confirm registration' }, { status: 500 });
    }

    // 3. Upsert payment record to SUCCESSFUL (Paid)
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('registration_id', registrationId)
      .maybeSingle();

    if (existingPayment) {
      await supabase
        .from('payments')
        .update({
          payment_status: 'SUCCESSFUL',
          transaction_reference: transactionReference || `ADMIN-APPROVE-${Date.now()}`,
          verification_note: verificationNote || 'Approved & verified by Admin',
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPayment.id);
    } else {
      await supabase.from('payments').insert({
        registration_id: registrationId,
        amount: 50000,
        payment_method: 'UPI_QR',
        payment_status: 'SUCCESSFUL',
        transaction_reference: transactionReference || `ADMIN-APPROVE-${Date.now()}`,
        verification_note: verificationNote || 'Approved & verified by Admin',
        verified_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Player registration and payment approved successfully!',
      registrationId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
