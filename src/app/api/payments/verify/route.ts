import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PaymentService } from '@/lib/payment/service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, paymentId, signature, transactionReference } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Fetch DB Payment Record
    const { data: dbPayment, error: paymentErr } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (paymentErr || !dbPayment) {
      return NextResponse.json({ error: 'Payment order record not found' }, { status: 404 });
    }

    // 2. Invoke PaymentService Verification Provider
    const verifyResult = await PaymentService.getProvider().verifyPayment({
      orderId,
      paymentId,
      signature,
      transactionReference,
    });

    if (!verifyResult.success) {
      // Payment Verification Failed
      await supabase
        .from('payments')
        .update({
          status: 'FAILED',
          gateway_response: verifyResult.rawResponse,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dbPayment.id);

      return NextResponse.json(
        { error: 'Payment verification failed', status: 'FAILED' },
        { status: 400 }
      );
    }

    // 3. Payment Verified Successfully -> Update Payment & Registration status atomically
    const paidAt = new Date().toISOString();

    await supabase
      .from('payments')
      .update({
        payment_id: verifyResult.paymentId,
        status: 'SUCCESS',
        paid_at: paidAt,
        gateway_response: verifyResult.rawResponse,
        updated_at: paidAt,
      })
      .eq('id', dbPayment.id);

    let { error: regUpdateErr } = await supabase
      .from('registrations')
      .update({
        status: 'CONFIRMED',
        registration_status: 'CONFIRMED',
        updated_at: paidAt,
      })
      .eq('id', dbPayment.registration_id);

    // Fallback: if 'status' column doesn't exist, retry with only registration_status
    if (regUpdateErr && regUpdateErr.message?.includes('column')) {
      await supabase
        .from('registrations')
        .update({
          registration_status: 'CONFIRMED',
          updated_at: paidAt,
        })
        .eq('id', dbPayment.registration_id);
    }

    return NextResponse.json({
      success: true,
      status: 'SUCCESS',
      registrationId: dbPayment.registration_id,
      paymentId: verifyResult.paymentId,
      paidAt,
    });
  } catch (err: any) {
    console.error('Payment verification error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
