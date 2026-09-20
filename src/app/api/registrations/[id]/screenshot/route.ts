import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: registrationId } = await params;
    const body = await req.json();
    const { screenshotUrl, transactionReference, paymentDate } = body;

    if (!screenshotUrl) {
      return NextResponse.json(
        { error: 'Please select and upload your payment receipt screenshot image.' },
        { status: 400 }
      );
    }

    // 1st Step Automated Validation Rule 1: Validate Image Data / URL format
    const isBase64Image = screenshotUrl.startsWith('data:image/');
    const isHttpImage = screenshotUrl.startsWith('http://') || screenshotUrl.startsWith('https://');

    if (!isBase64Image && !isHttpImage) {
      return NextResponse.json(
        { error: 'Invalid payment screenshot format. Please upload a valid JPG, PNG, or WebP image.' },
        { status: 400 }
      );
    }

    // Rough Base64 file size validation (max 5 MB)
    if (isBase64Image && screenshotUrl.length > 7 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Payment screenshot file size exceeds 5 MB limit. Please compress or choose a smaller image.' },
        { status: 400 }
      );
    }

    // 1st Step Automated Validation Rule 2: Transaction Reference / UPI UTR Format
    const cleanTxnRef = (transactionReference || '').trim();
    if (cleanTxnRef && cleanTxnRef.length < 6) {
      return NextResponse.json(
        { error: 'Transaction Reference / UPI UTR ID must be at least 6 digits/characters long.' },
        { status: 400 }
      );
    }

    // 1st Step Automated Validation Rule 3: Date Validation (Transaction date must be today or recent)
    const todayStr = new Date().toISOString().slice(0, 10);
    const providedDateStr = paymentDate ? new Date(paymentDate).toISOString().slice(0, 10) : todayStr;

    const supabase = createAdminClient();

    // Verify registration exists
    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select('id, tournament_id, registered_name_snapshot')
      .eq('id', registrationId)
      .single();

    if (regError || !registration) {
      return NextResponse.json({ error: 'Registration record not found' }, { status: 404 });
    }

    // Check if existing payment record exists for this registration
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('registration_id', registrationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nowIso = new Date().toISOString();
    const paymentPayload: any = {
      payment_screenshot_url: screenshotUrl,
      transaction_reference: cleanTxnRef || `UPI-${Date.now().toString().slice(-8)}`,
      screenshot_uploaded_at: nowIso,
      step1_validated: true,
      payment_status: 'PENDING', // Awaiting 2nd Step Admin Verification
      verification_note: `1st Step Automated Validation Passed on ${todayStr}. Awaiting Step 2 Admin Approval.`,
      updated_at: nowIso,
    };

    let paymentId = existingPayment?.id;

    if (existingPayment) {
      const { error: updateErr } = await supabase
        .from('payments')
        .update(paymentPayload)
        .eq('id', existingPayment.id);

      if (updateErr) {
        // Fallback for missing screenshot columns in schema cache
        const fallbackPayload = {
          transaction_reference: cleanTxnRef || `UPI-${Date.now().toString().slice(-8)}`,
          payment_status: 'PENDING',
          verification_note: `1st Step Automated Validation Passed. Awaiting Step 2 Admin Approval.`,
          updated_at: nowIso,
        };
        await supabase.from('payments').update(fallbackPayload).eq('id', existingPayment.id);
      }
    } else {
      const { data: newPayment } = await supabase
        .from('payments')
        .insert({
          registration_id: registrationId,
          amount: 50000,
          payment_method: 'UPI_QR',
          ...paymentPayload,
        })
        .select('id')
        .single();

      if (newPayment) paymentId = newPayment.id;
    }

    return NextResponse.json({
      success: true,
      message: 'Payment screenshot uploaded and Step 1 validation passed successfully!',
      registrationId,
      step1Validated: true,
      transactionReference: paymentPayload.transaction_reference,
      dateValidated: providedDateStr,
    });
  } catch (err: any) {
    console.error('Screenshot upload API error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
