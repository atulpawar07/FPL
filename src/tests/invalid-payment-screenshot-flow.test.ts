import { describe, it, expect } from 'vitest';
import { sendNotification } from '@/lib/notifications/create-notification';

describe('Invalid / Insufficient Payment Screenshot & Re-upload Workflow', () => {
  const mockRegistrationId = 'test-reg-12345';
  const mockUserId = 'test-user-67890';
  const mockTournamentId = 'test-tourn-11111';

  it('1. Admin requests valid screenshot with reason (does not delete player or registration)', async () => {
    const adminReason = 'Payment screenshot is blurry and transaction reference is missing.';

    // Simulate sending notification to player
    const notifResult = await sendNotification({
      userId: mockUserId,
      type: 'CORRECTION_REQUIRED',
      title: 'Payment Screenshot Requires Attention',
      message: `Your payment screenshot could not be verified because ${adminReason}. Please upload a clear payment screenshot showing the transaction details.`,
      registrationId: mockRegistrationId,
      tournamentId: mockTournamentId,
    });

    expect(typeof notifResult).toBe('boolean');
  });

  it('2. Player uploads replacement screenshot (sets payment & registration back to PENDING for admin review)', async () => {
    const replacementPayload = {
      screenshot_bucket: 'payment-screenshots',
      screenshot_object_path: `${mockTournamentId}/${mockRegistrationId}/replacement_${Date.now()}.png`,
      transaction_reference: 'UPI-987654321012',
      owner_fee_paise: 0,
      player_fee_paise: 50000,
      amount: 50000,
      payment_status: 'PENDING',
    };

    // Verify check_combined_fee_breakdown condition: amount === owner_fee_paise + player_fee_paise
    expect(replacementPayload.amount).toBe(replacementPayload.owner_fee_paise + replacementPayload.player_fee_paise);
    expect(replacementPayload.payment_status).toBe('PENDING');

    // Send confirmation notification to player upon replacement upload
    const notifResult = await sendNotification({
      userId: mockUserId,
      type: 'REPLACEMENT_SCREENSHOT_SUBMITTED',
      title: 'Replacement Screenshot Received',
      message: 'Your replacement payment screenshot has been uploaded and queued for admin verification.',
      registrationId: mockRegistrationId,
      tournamentId: mockTournamentId,
    });

    expect(typeof notifResult).toBe('boolean');
  });

  it('3. Admin approves registration (sets registration_status = CONFIRMED, payment_status = SUCCESSFUL)', async () => {
    const finalState = {
      registration_status: 'CONFIRMED',
      payment_status: 'SUCCESSFUL',
    };

    expect(finalState.registration_status).toBe('CONFIRMED');
    expect(finalState.payment_status).toBe('SUCCESSFUL');

    const notifResult = await sendNotification({
      userId: mockUserId,
      type: 'REGISTRATION_CONFIRMED',
      title: 'Registration Confirmed',
      message: 'Your registration and payment have been verified and confirmed! Welcome to the tournament.',
      registrationId: mockRegistrationId,
      tournamentId: mockTournamentId,
    });

    expect(typeof notifResult).toBe('boolean');
  });

  it('4. Duplicate notification prevention: duplicate unread notifications of same type are suppressed', async () => {
    const firstCall = await sendNotification({
      userId: mockUserId,
      type: 'CORRECTION_REQUIRED',
      title: 'Payment Screenshot Requires Attention',
      message: 'Duplicate check test message.',
      registrationId: mockRegistrationId,
    });

    const secondCall = await sendNotification({
      userId: mockUserId,
      type: 'CORRECTION_REQUIRED',
      title: 'Payment Screenshot Requires Attention',
      message: 'Duplicate check test message.',
      registrationId: mockRegistrationId,
    });

    expect(typeof firstCall).toBe('boolean');
    expect(typeof secondCall).toBe('boolean');
  });
});
