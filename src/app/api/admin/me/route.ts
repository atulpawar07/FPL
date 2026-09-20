import { NextResponse } from 'next/server';
import { checkIsAdmin } from '@/lib/auth/is-admin';

export async function GET() {
  try {
    const { isAdmin, user } = await checkIsAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ isAdmin: false, error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({
      isAdmin: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.email,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ isAdmin: false, error: error.message }, { status: 500 });
  }
}
