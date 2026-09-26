import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const supabaseUser = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized: You must be logged in to link a participant profile.' }, { status: 401 });
    }

    const body = await req.json();
    const { registrationNumber, mobile, confirmClaim = true, playerProfileId } = body;

    if (!registrationNumber || !mobile) {
      return NextResponse.json({
        error: 'Registration Reference Number and Contact Mobile Number are required for account linking.',
      }, { status: 400 });
    }

    if (!confirmClaim) {
      return NextResponse.json({
        error: 'Explicit user confirmation is required to proceed with account linking.',
      }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 1. Verify Registration Reference Number matches the tournament registration
    const { data: registration, error: regErr } = await adminClient
      .from('registrations')
      .select('id, player_id, registration_number, players!inner(id, full_name, mobile, is_tournament_only, auth_user_id)')
      .eq('registration_number', registrationNumber.trim())
      .maybeSingle();

    if (regErr || !registration || !registration.players) {
      return NextResponse.json({
        error: 'Invalid Registration Reference Number or participant record not found.',
      }, { status: 404 });
    }

    const targetPlayer = registration.players as any;

    // 2. Security Check: Contact Mobile Number Verification
    const cleanMobile = mobile.replace(/\D/g, '');
    const playerMobile = (targetPlayer.mobile || '').replace(/\D/g, '');

    if (cleanMobile !== playerMobile) {
      return NextResponse.json({
        error: 'Provided mobile number does not match the participant record on file.',
      }, { status: 400 });
    }

    // 3. Prevent Hijacking / Re-linking already linked accounts
    if (targetPlayer.auth_user_id && targetPlayer.auth_user_id !== user.id) {
      return NextResponse.json({
        error: 'This participant record is already linked to another user account.',
      }, { status: 403 });
    }

    if (targetPlayer.auth_user_id === user.id) {
      return NextResponse.json({
        success: true,
        claimedProfileId: targetPlayer.id,
        message: `Participant profile for ${targetPlayer.full_name} is already linked to your account.`,
      });
    }

    // 4. Update ONLY the target player's auth_user_id (no profile overwrites or snapshot mutation)
    const { error: updateErr } = await adminClient
      .from('players')
      .update({
        auth_user_id: user.id,
        is_tournament_only: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetPlayer.id);

    if (updateErr) {
      throw updateErr;
    }

    return NextResponse.json({
      success: true,
      claimedProfileId: targetPlayer.id,
      message: `Successfully linked participant profile for ${targetPlayer.full_name} to your logged-in account (Ref: ${registration.registration_number}).`,
    });
  } catch (err: any) {
    console.error('Participant Account Linking Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
