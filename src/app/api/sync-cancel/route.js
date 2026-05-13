import { NextResponse } from 'next/server';
import { setSyncCancelled } from '@/lib/sync-status';

export const dynamic = 'force-dynamic';

export async function GET() {
    setSyncCancelled(true);
    return NextResponse.json({ success: true, message: 'Sync cancellation signal sent' });
}
