import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/is-admin';

// GET /api/admin/managers - List all managers
export async function GET() {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const { data: managers, error } = await supabase
      .from('managers')
      .select('*')
      .order('granted_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ managers: managers || [] });
  } catch (err: any) {
    const status = err.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Failed to fetch managers' }, { status });
  }
}

// POST /api/admin/managers - Grant manager role to a user email
export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireAdmin();
    const supabase = createAdminClient();

    const { email, displayName } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid user email is required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if manager already exists
    const { data: existing } = await supabase
      .from('managers')
      .select('id, is_active')
      .ilike('user_email', cleanEmail)
      .maybeSingle();

    if (existing) {
      if (existing.is_active) {
        return NextResponse.json({ error: 'User is already an active manager' }, { status: 400 });
      } else {
        // Reactivate
        const { data: updated, error: updateErr } = await supabase
          .from('managers')
          .update({ is_active: true, display_name: displayName || cleanEmail, granted_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        return NextResponse.json({ manager: updated, message: 'Manager access re-activated' });
      }
    }

    // Try finding user's auth ID from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', cleanEmail)
      .maybeSingle();

    const { data: newManager, error: insertErr } = await supabase
      .from('managers')
      .insert({
        granted_by: adminUser.id,
        user_email: cleanEmail,
        user_id: profile?.id || null,
        display_name: displayName || cleanEmail.split('@')[0],
        is_active: true,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json({ manager: newManager, message: 'Manager access granted successfully' });
  } catch (err: any) {
    const status = err.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Failed to grant manager role' }, { status });
  }
}

// DELETE /api/admin/managers - Revoke manager role
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Manager ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('managers')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Manager access revoked' });
  } catch (err: any) {
    const status = err.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Failed to revoke manager role' }, { status });
  }
}
