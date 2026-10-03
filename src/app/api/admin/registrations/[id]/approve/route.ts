import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireManager } from '@/lib/auth/is-manager';
import { logAdminAction } from '@/lib/audit/logger';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, role } = await requireManager();
    const { id: registrationId } = await params;
    const body = await req.json().catch(() => ({}));
    const { transactionReference, verificationNote, action = 'APPROVE' } = body;

    const supabase = createAdminClient();

    // Fetch full registration record
    const { data: registration, error: regErr } = await supabase
      .from('registrations')
      .select('id, player_id, tournament_id, registration_type, team_owner_id, registration_status')
      .eq('id', registrationId)
      .maybeSingle();

    if (regErr || !registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    let newStatus = 'CONFIRMED';
    let newPaymentStatus = 'SUCCESSFUL';
    if (action === 'REJECT') {
      newStatus = 'REJECTED';
      newPaymentStatus = 'FAILED';
    } else if (action === 'CANCEL') {
      newStatus = 'CANCELLED';
      newPaymentStatus = 'REFUNDED';
    } else if (action === 'ACKNOWLEDGE_AND_APPROVE') {
      newStatus = 'CONFIRMED';
      newPaymentStatus = 'SUCCESSFUL';
    } else if (action === 'PAYMENT_PENDING') {
      // Admin requesting player to re-upload screenshot
      newStatus = 'PENDING';
      newPaymentStatus = 'PENDING';
    }

    // Update the target registration status
    let { error: updateRegErr } = await supabase
      .from('registrations')
      .update({
        registration_status: newStatus,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId);

    // Fallback: if 'status' column doesn't exist
    if (updateRegErr && updateRegErr.message?.includes('column')) {
      const fallback = await supabase
        .from('registrations')
        .update({
          registration_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', registrationId);
      updateRegErr = fallback.error;
    }

    if (updateRegErr) {
      return NextResponse.json({
        error: updateRegErr.message || 'Failed to update registration status',
      }, { status: 500 });
    }

    // ─── CASCADE: If this is an OWNER registration, also update the linked ICON registration ───
    if (registration.team_owner_id) {
      // Update team_owners table status
      const ownerStatus = newStatus === 'CONFIRMED' ? 'APPROVED' : 'REJECTED';
      await supabase
        .from('team_owners')
        .update({
          status: ownerStatus,
          payment_status: newPaymentStatus,
        })
        .eq('id', registration.team_owner_id);

      // Find and update ALL sibling registrations linked to the same team_owner_id
      // This covers both OWNER→ICON and ICON→OWNER cascading
      const { data: siblingRegs } = await supabase
        .from('registrations')
        .select('id, registration_type')
        .eq('team_owner_id', registration.team_owner_id)
        .neq('id', registrationId);

      if (siblingRegs && siblingRegs.length > 0) {
        const siblingIds = siblingRegs.map((r) => r.id);
        await supabase
          .from('registrations')
          .update({
            status: newStatus,
            registration_status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .in('id', siblingIds);

        // Update payments for sibling registrations too
        for (const sibId of siblingIds) {
          const { data: sibPayment } = await supabase
            .from('payments')
            .select('id')
            .eq('registration_id', sibId)
            .maybeSingle();

          if (sibPayment) {
            await supabase
              .from('payments')
              .update({
                payment_status: newPaymentStatus,
                verified_by: user.email,
                verified_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', sibPayment.id);
          }
        }
      }
    }

    // Upsert payment record for the primary registration
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('registration_id', registrationId)
      .maybeSingle();

    const noteText = verificationNote || `${action === 'REJECT' ? 'Rejected' : action === 'ACKNOWLEDGE_AND_APPROVE' ? 'Organiser Payment Acknowledged & Approved' : 'Approved'} by ${role} (${user.email})`;

    if (existingPayment) {
      await supabase
        .from('payments')
        .update({
          payment_status: newPaymentStatus,
          transaction_reference: transactionReference || `${role}-${action}-${Date.now()}`,
          verification_note: noteText,
          verified_by: user.id,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPayment.id);
    } else {
      await supabase.from('payments').insert({
        registration_id: registrationId,
        amount: 50000,
        owner_fee_paise: 0,
        player_fee_paise: 50000,
        payment_method: 'UPI_QR',
        payment_status: newPaymentStatus,
        transaction_reference: transactionReference || `${role}-${action}-${Date.now()}`,
        verification_note: noteText,
        verified_by: user.id,
        verified_at: new Date().toISOString(),
      });
    }

    const registrationType = registration.registration_type || 'PLAYER';
    const cascadeMsg = registration.team_owner_id
      ? ` (cascaded to linked Owner/Icon registrations)`
      : '';

    // Send notification to player if auth_user_id is available
    try {
      const { data: playerInfo } = await supabase
        .from('players')
        .select('auth_user_id')
        .eq('id', registration.player_id)
        .maybeSingle();

      if (playerInfo?.auth_user_id) {
        const { sendNotification } = await import('@/lib/notifications/create-notification');
        if (action === 'PAYMENT_PENDING') {
          const reason = verificationNote || 'Payment screenshot is not clear or missing transaction details.';
          await sendNotification({
            userId: playerInfo.auth_user_id,
            type: 'CORRECTION_REQUIRED',
            title: 'Payment Screenshot Requires Attention',
            message: `Your payment screenshot could not be verified because ${reason}. Please upload a clear payment screenshot showing the transaction details.`,
            registrationId,
            tournamentId: registration.tournament_id,
          });
        } else if (newStatus === 'CONFIRMED') {
          await sendNotification({
            userId: playerInfo.auth_user_id,
            type: 'REGISTRATION_CONFIRMED',
            title: 'Registration Confirmed',
            message: 'Your registration and payment have been verified and confirmed! Welcome to the tournament.',
            registrationId,
            tournamentId: registration.tournament_id,
          });
        } else if (newStatus === 'REJECTED') {
          await sendNotification({
            userId: playerInfo.auth_user_id,
            type: 'REGISTRATION_REJECTED',
            title: 'Registration Rejected',
            message: `Your registration payment was rejected. Reason: ${verificationNote || 'Invalid transaction'}`,
            registrationId,
            tournamentId: registration.tournament_id,
          });
        }
      }
    } catch (notifErr: any) {
      console.warn('Player notification warning:', notifErr.message);
    }

    const auditActionName = action === 'ACKNOWLEDGE_AND_APPROVE' ? 'ACKNOWLEDGE_ORGANISER_PAYMENT' : 'UPDATE_REGISTRATION_STATUS';

    await logAdminAction({
      adminUserId: user.id,
      action: auditActionName,
      entityType: 'REGISTRATION',
      entityId: registrationId,
      oldValue: { registration_status: registration.registration_status },
      newValue: { registration_status: newStatus, action, payment_status: newPaymentStatus },
    });

    return NextResponse.json({
      success: true,
      message: `${registrationType} registration ${action.toLowerCase()}d successfully!${cascadeMsg}`,
      registrationId,
      status: newStatus,
    });
  } catch (err: any) {
    const status = err.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status });
  }
}
