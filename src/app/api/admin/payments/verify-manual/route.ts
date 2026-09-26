import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/is-admin';
import { logAdminAction } from '@/lib/audit/logger';

export async function POST(req: NextRequest) {
  try {
    // 1. Mandatory Admin Authentication & RBAC Check
    const { user, role } = await requireAdmin();

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

    const { data: dbPayment, error: fetchErr } = await query.maybeSingle();

    if (fetchErr || !dbPayment) {
      return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
    }

    // State Transition Guard: Only allow transition if currently PENDING
    if (dbPayment.payment_status === 'SUCCESSFUL') {
      return NextResponse.json({
        success: true,
        payment: dbPayment,
        message: 'Payment is already confirmed.',
      });
    }

    if (dbPayment.payment_status !== 'PENDING') {
      return NextResponse.json(
        { error: `Cannot manually approve payment in status: ${dbPayment.payment_status}` },
        { status: 400 }
      );
    }

    const verifiedAt = new Date().toISOString();

    // 2. Conditional Atomic Update: set payment_status = SUCCESSFUL
    //    verified_by comes strictly from authenticated user.id session
    const { data: updatedPayment, error: updateErr } = await supabaseAdmin
      .from('payments')
      .update({
        payment_status: 'SUCCESSFUL',
        transaction_reference: transactionReference?.trim() || dbPayment.transaction_reference || 'MANUAL-UPI-VERIFIED',
        verification_note: verificationNote?.trim() || 'Payment confirmed manually by administrator.',
        verified_by: user.id,
        verified_at: verifiedAt,
        updated_at: verifiedAt,
      })
      .eq('id', dbPayment.id)
      .eq('payment_status', 'PENDING')
      .select('*')
      .maybeSingle();

    if (updateErr || !updatedPayment) {
      return NextResponse.json({ error: updateErr?.message || 'Failed to update payment status (conflict or state changed)' }, { status: 500 });
    }

    // 3. Server-derived registration status update to CONFIRMED
    if (dbPayment.registration_id) {
      let { error: regUpdateErr } = await supabaseAdmin
        .from('registrations')
        .update({
          registration_status: 'CONFIRMED',
          status: 'CONFIRMED',
          updated_at: verifiedAt,
        })
        .eq('id', dbPayment.registration_id);

      if (regUpdateErr && regUpdateErr.message?.includes('column')) {
        await supabaseAdmin
          .from('registrations')
          .update({
            registration_status: 'CONFIRMED',
            updated_at: verifiedAt,
          })
          .eq('id', dbPayment.registration_id);
      }
    }

    // 4. Audit Logging
    await logAdminAction({
      adminUserId: user.id,
      action: 'VERIFY_PAYMENT_MANUAL',
      entityType: 'PAYMENT',
      entityId: dbPayment.id,
      oldValue: { payment_status: dbPayment.payment_status },
      newValue: { payment_status: 'SUCCESSFUL', verified_by: user.id, registration_status: 'CONFIRMED' },
    });

    return NextResponse.json({
      success: true,
      payment: updatedPayment,
      message: 'Payment status updated to Successful. Status refreshed on player details page.',
    });
  } catch (err: any) {
    const status = err.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status });
  }
}
