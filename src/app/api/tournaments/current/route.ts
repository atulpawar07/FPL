import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Fetch active tournament
    const { data: tournament, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !tournament) {
      return NextResponse.json({ tournament: null }, { status: 200 });
    }

    return NextResponse.json(tournament);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
