import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  return NextResponse.json(
    {
      error: 'Direct client payment verification callbacks are disabled. All payments must be verified via admin approval.',
      status: 'DISABLED',
    },
    { status: 403 }
  );
}
