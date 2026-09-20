import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function DELETE() {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Logout error' }, { status: 500 });
  }
}
