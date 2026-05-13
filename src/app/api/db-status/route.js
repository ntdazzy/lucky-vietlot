import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const tables = {
      'Mega 6/45': 'draws_645',
      'Power 6/55': 'draws_655',
      'Lotto 5/35': 'draws_535',
      'Max 3D Pro': 'draws_max3dpro'
    };

    const counts = {};
    for (const [name, table] of Object.entries(tables)) {
      try {
        const row = db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get();
        counts[name] = row.n;
      } catch (e) {
        counts[name] = 0;
      }
    }

    return NextResponse.json({ success: true, counts });
  } catch (error) {
    console.error('DB Status API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
