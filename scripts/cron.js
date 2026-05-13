const cron = require('node-cron');
const { updateLatestDraw, sendTelegramNotification } = require('./update-today');

console.log("=========================================");
console.log("🕒 VIETLOTT CRON JOB SCHEDULER STARTED ");
console.log("🕒 Timezone: Asia/Ho_Chi_Minh");
console.log("🕒 Schedule: 18:30, 18:45, 19:00 (retry)");
console.log("🕒 Source: XSKT.com.vn (update-today.js)");
console.log("=========================================");

// Lần 1: 18h30 — Mega 6/45, Max 3D (thường có sớm)
cron.schedule('30 18 * * *', async () => {
    console.log(`\n⏰ [CRON 18:30] Bắt đầu cào dữ liệu...`);
    try {
        const results = await updateLatestDraw();
        if (results && results.length > 0) {
            console.log(`✅ [CRON 18:30] Đã cập nhật ${results.length} kỳ mới!`);
        } else {
            console.log(`ℹ️ [CRON 18:30] Chưa có kết quả mới.`);
        }
    } catch (e) {
        console.error(`❌ [CRON 18:30] Lỗi:`, e);
    }
}, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
});

// Lần 2: 18h45 — Power 6/55 (thường có muộn hơn)
cron.schedule('45 18 * * *', async () => {
    console.log(`\n⏰ [CRON 18:45] Retry lấy kết quả...`);
    try {
        const results = await updateLatestDraw();
        if (results && results.length > 0) {
            console.log(`✅ [CRON 18:45] Đã cập nhật ${results.length} kỳ mới!`);
        } else {
            console.log(`ℹ️ [CRON 18:45] Chưa có kết quả mới.`);
        }
    } catch (e) {
        console.error(`❌ [CRON 18:45] Lỗi:`, e);
    }
}, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
});

// Lần 3: 19h00 — Retry cuối cùng
cron.schedule('0 19 * * *', async () => {
    console.log(`\n⏰ [CRON 19:00] Retry cuối cùng...`);
    try {
        const results = await updateLatestDraw();
        if (results && results.length > 0) {
            console.log(`✅ [CRON 19:00] Đã cập nhật ${results.length} kỳ mới!`);
            await sendTelegramNotification(`📊 <b>Tổng kết hôm nay:</b>\nĐã cập nhật ${results.length} kỳ quay mới vào hệ thống.`);
        } else {
            console.log(`ℹ️ [CRON 19:00] Không có kết quả mới hôm nay.`);
        }
    } catch (e) {
        console.error(`❌ [CRON 19:00] Lỗi:`, e);
    }
}, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
});

// Chạy 1 lần khởi động để check nếu có thiếu dữ liệu lúc deploy
setTimeout(() => {
    console.log("🚀 [INIT] Running initial boot update check...");
    updateLatestDraw().then(results => {
        if (results && results.length > 0) {
            console.log(`✅ [INIT] Đã cập nhật ${results.length} kỳ lúc boot.`);
        } else {
            console.log(`ℹ️ [INIT] DB đã up-to-date.`);
        }
    }).catch(e => console.error("Boot update error:", e));
}, 5000);
