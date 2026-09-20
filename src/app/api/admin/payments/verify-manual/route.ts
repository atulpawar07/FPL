import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    let userId: string | null = null;
    try {
      const supabaseServer = await createServerSupabaseClient();
      const { data: { user } } = await supabaseServer.auth.getUser();
      if (user) userId = user.id;
    } catch {}

    const body = await req.json();
    const { paymentId, registrationId, transactionReference, verificationNote } = body;

    if (!paymentId && !registrationId) {
      return NextResponse.json({ error: 'Payment ID or Registration ID is required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    let query = supabaseAdmin.from('payments').select('*');
    if (paymentId) {
      query = query.eq('id', paymentId);
    } else {
      query = query.eq('registration_id', registrationId);
    }

    const { data: dbPayment, error: fetchErr } = await query.single();

    if (fetchErr || !dbPayment) {
      return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
    }

    const verifiedAt = new Date().toISOString();

    // Update payment record to SUCCESSFUL with audit details
    const { data: updatedPayment, error: updateErr } = await supabaseAdmin
      .from('payments')
      .update({
        payment_status: 'SUCCESSFUL',
        transaction_reference: transactionReference || dbPayment.transaction_reference || 'MANUAL-UPI-VERIFIED',
        verification_note: verificationNote || 'Payment confirmed manually by administrator.',
        verified_by: userId,
        verified_at: verifiedAt,
        updated_at: verifiedAt,
      })
      .eq('id', dbPayment.id)
      .select('*')
      .single();

    if (updateErr || !updatedPayment) {
      return NextResponse.json({ error: updateErr?.message || 'Failed to update payment status' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      payment: updatedPayment,
      message: 'Payment status updated to Successful. Status refreshed on player details page.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
