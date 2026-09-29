import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/auth/is-manager';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSignedScreenshotUrl } from '@/lib/storage/upload';

export async function GET(req: NextRequest) {
  try {
    await requireManager();
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');

    if (!path || path.trim() === '') {
      return NextResponse.json({ error: 'Missing screenshot path' }, { status: 400 });
    }

    const cleanPath = path.trim();
    const supabase = createAdminClient();

    // 1. Verify database ownership against payments table
    const { data: byObjectPath } = await supabase
      .from('payments')
      .select('id, screenshot_object_path, payment_screenshot_url, screenshot_bucket')
      .eq('screenshot_object_path', cleanPath)
      .maybeSingle();

    const { data: byUrl } = !byObjectPath
      ? await supabase
          .from('payments')
          .select('id, screenshot_object_path, payment_screenshot_url, screenshot_bucket')
          .eq('payment_screenshot_url', cleanPath)
          .maybeSingle()
      : { data: null };

    const paymentRecord = byObjectPath || byUrl;
    let isAuthorizedPath = false;

    if (paymentRecord) {
      const bucket = paymentRecord.screenshot_bucket || 'payment-screenshots';
      if (bucket === 'payment-screenshots') {
        isAuthorizedPath = true;
      }
    } else {
      // Fallback check on team_owners table
      const { data: ownerRecord } = await supabase
        .from('team_owners')
        .select('id, payment_screenshot_url')
        .eq('payment_screenshot_url', cleanPath)
        .maybeSingle();

      if (ownerRecord) {
        isAuthorizedPath = true;
      }
    }

    if (!isAuthorizedPath) {
      return NextResponse.json({ error: 'Payment screenshot not found or unauthorized' }, { status: 404 });
    }

    // 2. Always generate signed URL strictly for payment-screenshots bucket with 900s expiry
    const signedUrl = await getSignedScreenshotUrl('payment-screenshots', cleanPath, 900);
    if (!signedUrl) {
      return NextResponse.json({ error: 'Failed to generate signed screenshot URL' }, { status: 500 });
    }

    return NextResponse.json({ signedUrl });
  } catch (err: any) {
    const status = err.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status });
  }
}
