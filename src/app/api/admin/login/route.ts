import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    // Default Phase 1 Admin credentials check: admin@cricket.org / admin123
    if (email === 'admin@cricket.org' && password === 'admin123') {
      const cookieStore = await cookies();
      cookieStore.set('admin_session', 'authenticated_super_admin', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 86400, // 24 hours
        path: '/',
      });

      return NextResponse.json({
        success: true,
        user: {
          name: 'Super Administrator',
          email: 'admin@cricket.org',
          role: 'SUPER_ADMIN',
        },
      });
    }

    return NextResponse.json({ error: 'Invalid admin credentials' }, { status: 401 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Authentication error' }, { status: 500 });
  }
}
