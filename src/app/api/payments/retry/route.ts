import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PaymentService } from '@/lib/payment/service';

export async function POST(req: NextRequest) {
  try {
    // 1. Mandatory Session Authentication
    const supabaseServer = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { registrationReference, registrationId } = body;

    if (!registrationReference && !registrationId) {
      return NextResponse.json(
        { error: 'Registration ID or Reference is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 2. Resolve caller's player profile
    const { data: playerProfile, error: profileErr } = await supabaseServer
      .from('players')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (profileErr || !playerProfile) {
      return NextResponse.json({ error: 'Player profile not found' }, { status: 400 });
    }

    // 3. Fetch target registration
    let query = supabase.from('registrations').select('*');
    if (registrationId) {
      query = query.eq('id', registrationId);
    } else {
      query = query.eq('registration_number', registrationReference);
    }

    const { data: registration, error: regErr } = await query.maybeSingle();

    if (regErr || !registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // 4. IDOR Protection: Verify caller owns this registration (or is the linked team owner)
    let isAuthorizedOwner = false;
    if (registration.team_owner_id) {
      const { data: ownerRec } = await supabase
        .from('team_owners')
        .select('player_id')
        .eq('id', registration.team_owner_id)
        .maybeSingle();
      if (ownerRec && ownerRec.player_id === playerProfile.id) {
        isAuthorizedOwner = true;
      }
    }

    if (registration.player_id !== playerProfile.id && !isAuthorizedOwner) {
      return NextResponse.json(
        { error: 'Unauthorized: You can only retry payments for your own registrations' },
        { status: 403 }
      );
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
      .select('registration_fee, owner_registration_fee, currency')
      .eq('id', registration.tournament_id)
      .single();

    let amountPaise = tournament?.registration_fee || 50000;
    if (registration.registration_type === 'OWNER') {
      amountPaise = (tournament?.owner_registration_fee || 0) + (tournament?.registration_fee || 0);
    }
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
    const status = err.message?.includes('Authentication') ? 401 : err.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status });
  }
}
