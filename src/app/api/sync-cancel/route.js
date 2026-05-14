import { NextResponse } from 'next/server';
import { requestCancel, getSyncStatus } from '@/lib/sync-status';

export const dynamic = 'force-dynamic';

export async function GET() {
    const status = getSyncStatus();
    if (!status.running) {
        return NextResponse.json({ success: false, message: 'Không có tiến trình đồng bộ nào đang chạy' });
    }
    const ok = requestCancel();
    return NextResponse.json({
        success: ok,
        message: ok ? 'Đã gửi tín hiệu hủy. Tiến trình sẽ dừng ở chu kỳ kiểm tra tiếp theo.' : 'Không thể hủy',
        status: getSyncStatus(),
    });
}
