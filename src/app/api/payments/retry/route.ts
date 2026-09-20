import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PaymentService } from '@/lib/payment/service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { registrationReference, registrationId } = body;

    if (!registrationReference && !registrationId) {
      return NextResponse.json(
        { error: 'Registration ID or Reference is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    let query = supabase.from('registrations').select('*');
    if (registrationId) {
      query = query.eq('id', registrationId);
    } else {
      query = query.eq('registration_number', registrationReference);
    }

    const { data: registration, error: regErr } = await query.single();

    if (regErr || !registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    if (registration.registration_status === 'CONFIRMED') {
      return NextResponse.json(
        { error: 'This registration is already confirmed.' },
        { status: 400 }
      );
    }

    // Fetch tournament details
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('registration_fee, currency')
      .eq('id', registration.tournament_id)
      .single();

    const amountPaise = tournament?.registration_fee || 50000;
    const currency = 'INR';

    // Create a new Payment order for retry
    const paymentOrder = await PaymentService.getProvider().createOrder({
      registrationId: registration.id,
      registrationReference: registration.registration_number,
      amountPaise,
      currency,
    });

    await supabase.from('payments').insert({
      registration_id: registration.id,
      amount: amountPaise,
      payment_method: 'UPI_QR',
      payment_status: 'PENDING',
    });

    return NextResponse.json({
      success: true,
      registrationId: registration.id,
      registrationNumber: registration.registration_number,
      paymentOrder,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
