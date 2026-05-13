const cron = require('node-cron');
const scraper = require('./scraper');

console.log("=========================================");
console.log("🕒 VIETLOTT CRON JOB SCHEDULER STARTED ");
console.log("🕒 Timezone: Asia/Ho_Chi_Minh");
console.log("🕒 Schedule: Every day at 18:30");
console.log("=========================================");

// Chạy vào 18h30 mỗi ngày theo giờ Việt Nam
cron.schedule('30 18 * * *', async () => {
    console.log(`\n⏰ [CRON TRIGGERED] Starting scheduled scraper at ${new Date().toLocaleString('vi-VN')}...`);
    try {
        await scraper.main();
        console.log(`✅ [CRON FINISHED] Scraper completed successfully at ${new Date().toLocaleString('vi-VN')}!`);
    } catch (e) {
        console.error(`❌ [CRON ERROR] Scraper failed:`, e);
    }
}, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
});

// Chạy 1 lần khởi động để check nếu có thiếu dữ liệu lúc deploy
setTimeout(() => {
    console.log("🚀 [INIT] Running initial boot scraper check...");
    scraper.main().catch(e => console.error("Boot scraper error:", e));
}, 5000);
