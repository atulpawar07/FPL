import { NextResponse } from 'next/server';
import { checkIsManagerOrAdmin } from '@/lib/auth/is-manager';

export async function GET() {
  try {
    const { isManager, isAdmin, user, role } = await checkIsManagerOrAdmin();
    if (!isManager || !user) {
      return NextResponse.json({ isManager: false, isAdmin: false, error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({
      isManager: true,
      isAdmin,
      role,
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.email,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ isManager: false, isAdmin: false, error: error.message }, { status: 500 });
  }
}
