import { createAdminClient } from '@/lib/supabase/admin';

export interface CreateNotificationParams {
  userId: string;
  type: 'CORRECTION_REQUIRED' | 'REGISTRATION_CONFIRMED' | 'REGISTRATION_REJECTED' | 'REPLACEMENT_SCREENSHOT_SUBMITTED' | string;
  title: string;
  message: string;
  registrationId?: string;
  tournamentId?: string;
  paymentId?: string;
}

export async function sendNotification(params: CreateNotificationParams): Promise<boolean> {
  try {
    const supabase = createAdminClient();

    // Prevent duplicate unread notifications for the same event type and registration
    if (params.registrationId && params.type) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', params.userId)
        .eq('registration_id', params.registrationId)
        .eq('type', params.type)
        .is('read_at', null)
        .maybeSingle();

      if (existing) {
        return true;
      }
    }

    const { error } = await supabase.from('notifications').insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      registration_id: params.registrationId || null,
      tournament_id: params.tournamentId || null,
      payment_id: params.paymentId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.warn('Notification insert skipped or failed:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('Notification exception:', err.message);
    return false;
  }
}
