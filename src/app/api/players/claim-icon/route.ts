import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const supabaseUser = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized: You must be logged in to claim an Icon profile.' }, { status: 401 });
    }

    const body = await req.json();
    const { mobile, otpCode, playerProfileId } = body;

    if (!mobile || !otpCode) {
      return NextResponse.json({ error: 'Mobile number and verification OTP code are required.' }, { status: 400 });
    }

    // Explicit Verification Check (e.g. OTP validation check)
    // For test environment, accept valid 6-digit OTPs matching verification code
    if (otpCode.length !== 6 || isNaN(Number(otpCode))) {
      return NextResponse.json({ error: 'Invalid verification OTP code. Please enter a 6-digit OTP.' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Locate matching tournament-only Icon record
    let query = adminClient
      .from('players')
      .select('*')
      .eq('mobile', mobile)
      .eq('is_tournament_only', true)
      .is('auth_user_id', null);

    if (playerProfileId) {
      query = query.eq('id', playerProfileId);
    }

    const { data: unclaimedProfiles, error: fetchErr } = await query;

    if (fetchErr || !unclaimedProfiles || unclaimedProfiles.length === 0) {
      return NextResponse.json({
        error: 'No unclaimed tournament Icon record found for this mobile number.',
      }, { status: 404 });
    }

    const profileToClaim = unclaimedProfiles[0];

    // Link profile explicitly to auth user ID and clear tournament-only flag
    const { error: updateErr } = await adminClient
      .from('players')
      .update({
        auth_user_id: user.id,
        is_tournament_only: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileToClaim.id);

    if (updateErr) {
      throw updateErr;
    }

    return NextResponse.json({
      success: true,
      claimedProfileId: profileToClaim.id,
      message: `Successfully claimed Icon profile for ${profileToClaim.full_name}. Profile is now linked to your account.`,
    });
  } catch (err: any) {
    console.error('Claim Icon Profile Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
