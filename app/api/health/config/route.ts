import { NextResponse } from 'next/server';
import { getDemoReadiness } from '@/lib/real-config';

export async function GET() {
  const readiness = getDemoReadiness();
  return NextResponse.json(readiness, { status: readiness.ok ? 200 : 500 });
}
