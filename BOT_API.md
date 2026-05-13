# Vietlott Pro - Bot API Reference

## Vấn đề 403 trên Railway

Railway đặt server ở Mỹ → các trang Vietnam (vietlott.vn, xskt.com.vn, minhngoc) có thể chặn IP nước ngoài.

### Giải pháp đã triển khai

**1. Multi-source fallback chain:**
- Source 1: `xskt.com.vn` (chính)
- Source 2: `minhngoc.net.vn` (dự phòng)
- Nếu cả 2 đều fail → trả lỗi cụ thể + gợi ý dùng `/them`

**2. Browser fingerprint thực:**
- Đầy đủ Sec-Fetch headers, Chrome 131 UA, Vietnamese locale
- Retry 3 lần với exponential backoff
- Referer header để qua check chống bot

**3. Manual input endpoint** - dùng khi auto fail:
```
POST /api/update
Content-Type: application/json
{
  "game": "645",
  "drawId": "1234",
  "dateStr": "06/05/2026",
  "balls": "01, 02, 03, 04, 05, 06",
  "special_ball": "07",
  "secret": "your_secret"
}
```

### Nếu vẫn 403 mãi → chuyển deployment

**Option A: VPS Vietnam (rẻ nhất, ~50k/tháng):**
- Vietnix, Tinohost, Mat Bao
- IP Vietnam → không bị chặn

**Option B: ScraperAPI/ScrapingBee:**
- Free tier 1000 req/tháng
- Set proxy qua biến `SCRAPER_API_KEY`

**Option C: GitHub Actions cron job:**
- GitHub Actions runner ở nhiều location, có thể từ Vietnam
- Chạy scrape → push DB qua API tới Railway
- Free 2000 min/tháng

---

## Bot Commands → API Endpoints

### `/update` - Cập nhật kết quả mới
```
GET https://your-app.up.railway.app/api/update?chat_id=XXX&message_id=YYY
```

### `/kq <game>` - Xem kết quả mới nhất
```
GET https://your-app.up.railway.app/api/results?game=645&limit=1
GET https://your-app.up.railway.app/api/results?game=655&limit=3
GET https://your-app.up.railway.app/api/results?game=535&limit=1
```

Response:
```json
{
  "success": true,
  "game": "Mega 6/45",
  "results": [
    { "drawId": "1234", "date": "06/05/2026", "balls": "01, 02, 03, 04, 05, 06" }
  ]
}
```

### `/predict <game>` - Gợi ý số
```
GET https://your-app.up.railway.app/api/predict?game=645
GET https://your-app.up.railway.app/api/predict?game=535
```

### `/them <game> <drawId> <date> <balls>` - Thêm tay (khi 403)
```
POST https://your-app.up.railway.app/api/update
Body: { game, drawId, dateStr, balls, special_ball?, secret }
```

Bot ví dụ parse:
```
/them 645 1234 06/05/2026 01,02,03,04,05,06
→ POST /api/update với body tương ứng
```

---

## Environment Variables (Railway)

```
TELEGRAM_BOT_TOKEN=xxx       # Bot token từ @BotFather
TELEGRAM_CHAT_ID=xxx         # Chat ID để bot gửi thông báo
UPDATE_SECRET=random_string  # Bảo vệ endpoint /them (manual input)
RAILWAY_VOLUME_MOUNT_PATH=/data  # Persistent volume cho SQLite
```

---

## Bot side: Code mẫu (Node.js + node-telegram-bot-api)

```javascript
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const API_BASE = process.env.RAILWAY_APP_URL;
const SECRET = process.env.UPDATE_SECRET;

bot.onText(/\/update/, async (msg) => {
  const sent = await bot.sendMessage(msg.chat.id, '🔄 Đang cập nhật...');
  await axios.get(`${API_BASE}/api/update?chat_id=${msg.chat.id}&message_id=${sent.message_id}`);
});

bot.onText(/\/kq(?:\s+(\d+))?/, async (msg, match) => {
  const game = match[1] || '645';
  try {
    const { data } = await axios.get(`${API_BASE}/api/results?game=${game}&limit=1`);
    if (!data.success) return bot.sendMessage(msg.chat.id, `❌ ${data.error}`);
    const r = data.results[0];
    bot.sendMessage(msg.chat.id, 
      `🎯 <b>${data.game}</b>\nKỳ #${r.drawId} - ${r.date}\nKết quả: <code>${r.balls}</code>${r.specialBall ? `\nĐB: <code>${r.specialBall}</code>` : ''}`, 
      { parse_mode: 'HTML' }
    );
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Lỗi: ${e.message}`);
  }
});

bot.onText(/\/predict(?:\s+(\d+))?/, async (msg, match) => {
  const game = match[1] || '645';
  try {
    const { data } = await axios.get(`${API_BASE}/api/predict?game=${game}`);
    if (!data.success) return bot.sendMessage(msg.chat.id, `❌ ${data.error}`);
    const p = data.prediction;
    bot.sendMessage(msg.chat.id, 
      `🎲 <b>Gợi ý ${game}</b>\nBộ số: <code>${p.main.join(', ')}</code>${p.special ? `\nĐB: <code>${p.special}</code>` : ''}\nĐộ tin cậy: ${Math.round(p.confidence * 100)}%`, 
      { parse_mode: 'HTML' }
    );
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Lỗi: ${e.message}`);
  }
});

// /them 645 1234 06/05/2026 01,02,03,04,05,06 [07]
bot.onText(/\/them\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(\S+))?/, async (msg, match) => {
  const [_, game, drawId, dateStr, ballsRaw, special_ball] = match;
  const balls = ballsRaw.split(',').map(b => b.trim().padStart(2, '0')).join(', ');
  try {
    await axios.post(`${API_BASE}/api/update`, { game, drawId, dateStr, balls, special_ball, secret: SECRET });
    bot.sendMessage(msg.chat.id, `✅ Đã thêm ${game} #${drawId}`);
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Lỗi: ${e.response?.data?.error || e.message}`);
  }
});
```
