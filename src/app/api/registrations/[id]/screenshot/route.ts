import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkIsAdmin } from '@/lib/auth/is-admin';
import { uploadToStorageBucket, validateImageFileBuffer } from '@/lib/storage/upload';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: registrationId } = await params;

    // Check authentication & session ownership
    const supabaseServer = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { screenshotUrl, screenshotBase64, transactionReference, paymentDate } = body;
    const rawImageInput = screenshotBase64 || (screenshotUrl && screenshotUrl.startsWith('data:image/') ? screenshotUrl : null);

    if (screenshotUrl && (screenshotUrl.startsWith('http://') || screenshotUrl.startsWith('https://')) && !screenshotBase64) {
      return NextResponse.json(
        { error: 'Arbitrary external screenshot URLs are not allowed. Please upload a valid image file (JPEG, PNG, WebP).' },
        { status: 400 }
      );
    }

    if (!rawImageInput) {
      return NextResponse.json(
        { error: 'Please select and upload your payment receipt screenshot image.' },
        { status: 400 }
      );
    }

    const cleanBase64 = rawImageInput.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const validation = validateImageFileBuffer(buffer);
    if (!validation.isValid || !validation.mimeType) {
      return NextResponse.json(
        { error: validation.error || 'Invalid payment screenshot format. Please upload a valid JPG, PNG, or WebP image.' },
        { status: 400 }
      );
    }

    const cleanTxnRef = (transactionReference || '').trim();
    if (cleanTxnRef && cleanTxnRef.length < 6) {
      return NextResponse.json(
        { error: 'Transaction Reference / UPI UTR ID must be at least 6 digits/characters long.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify registration exists and belongs to authorized user
    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select('id, tournament_id, player_id, registered_name_snapshot')
      .eq('id', registrationId)
      .single();

    if (regError || !registration) {
      return NextResponse.json({ error: 'Registration record not found' }, { status: 404 });
    }

    // Ensure player owns registration (or is DB-backed admin)
    const { data: playerProfile } = await supabase
      .from('players')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    const { isAdmin } = await checkIsAdmin();
    if (!isAdmin && registration.player_id !== playerProfile?.id) {
      return NextResponse.json({ error: 'You are not authorized to upload a screenshot for this registration' }, { status: 403 });
    }

    // Upload file to private payment-screenshots storage bucket
    const ext = validation.mimeType === 'image/jpeg' ? 'jpg' : validation.mimeType === 'image/webp' ? 'webp' : 'png';
    const screenshotBucket = 'payment-screenshots';
    const screenshotObjectPath = `${registration.tournament_id}/${registration.id}/${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${ext}`;

    await uploadToStorageBucket(screenshotBucket, screenshotObjectPath, buffer, validation.mimeType);

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
      screenshot_bucket: screenshotBucket,
      screenshot_object_path: screenshotObjectPath,
      transaction_reference: cleanTxnRef || `UPI-${Date.now().toString().slice(-8)}`,
      screenshot_uploaded_at: nowIso,
      step1_validated: true,
      payment_status: 'PENDING',
      verification_note: `1st Step Automated Validation Passed. Awaiting Step 2 Admin Approval.`,
      updated_at: nowIso,
    };

    if (existingPayment) {
      await supabase.from('payments').update(paymentPayload).eq('id', existingPayment.id);
    } else {
      await supabase.from('payments').insert({
        registration_id: registrationId,
        amount: 50000,
        payment_method: 'UPI_QR',
        ...paymentPayload,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment screenshot uploaded to secure Storage and validated successfully!',
      registrationId,
      step1Validated: true,
      screenshotBucket,
      screenshotObjectPath,
    });
  } catch (err: any) {
    console.error('Screenshot upload API error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
