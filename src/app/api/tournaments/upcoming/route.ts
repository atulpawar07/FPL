import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();

    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('tournament_date', { ascending: true });

    return NextResponse.json({
      success: true,
      tournaments: tournaments || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
