import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ ok: false, error: 'No demo reset in real-only mode. State lives on Avalanche Fuji contracts and x402 settlement.' }, { status: 410 });
}
