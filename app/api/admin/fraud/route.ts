import { NextRequest, NextResponse } from 'next/server';
import { FraudDetector } from '@/lib/fraud/fraud-detector';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'stats') {
    const stats = FraudDetector.getStats();
    return NextResponse.json(stats);
  }

  if (action === 'check') {
    const ip = searchParams.get('ip');
    if (!ip) {
      return NextResponse.json({ error: 'Missing ip parameter' }, { status: 400 });
    }
    
    const result = FraudDetector.check({ ip });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, ip } = body;

  if (action === 'block' && ip) {
    FraudDetector.addBlockedIP(ip);
    return NextResponse.json({ success: true, message: `Blocked ${ip}` });
  }

  if (action === 'unblock' && ip) {
    const removed = FraudDetector.removeBlockedIP(ip);
    return NextResponse.json({ success: removed, message: removed ? `Unblocked ${ip}` : `${ip} not in blocklist` });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
