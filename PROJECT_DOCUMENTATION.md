# 🎲 Vietlott Analytics & Telegram Assistant

Hệ thống phân tích dữ liệu xổ số Vietlott thông minh, kết hợp giữa nền tảng Web hiện đại và trợ lý Telegram tự động hóa.

---

## 🚀 1. Tổng Quan Dự Án
Dự án được thiết kế để giải quyết nhu cầu tra cứu kết quả, dự đoán số may mắn và quản lý dữ liệu Vietlott một cách tự động và chuyên nghiệp. Hệ thống bao gồm hai thành phần chính:
1.  **Vietlott Analytics (Web):** Nền tảng phân tích chuyên sâu, quản lý cơ sở dữ liệu.
2.  **Telegram Bot (Assistant):** Giao diện điều khiển từ xa, nhận thông báo thời gian thực và tra cứu nhanh.

---

## 🛠 2. Công Nghệ Sử Dụng (Tech Stack)

### **Frontend & Backend (Web)**
*   **Framework:** Next.js (App Router)
*   **Database:** SQLite (Better-SQLite3) - Lưu trữ hiệu năng cao, bền vững.
*   **Hosting:** Railway (Persistent Volume) - Đảm bảo dữ liệu không bị mất khi deploy.
*   **Styling:** Vanilla CSS (Modern & Premium Aesthetics).

### **Telegram Assistant (Bot)**
*   **Framework:** Telegraf (Node.js)
*   **Hosting:** Vercel (Serverless Functions) - Tốc độ phản hồi cực nhanh.
*   **Webhook:** Tích hợp Webhook bảo mật cao.

### **Data Processing**
*   **Scraping:** Cheerio + Axios.
*   **Anti-Bot:** Sử dụng kỹ thuật ngụy trang Headers và chuyển đổi nguồn dữ liệu sang XSKT để vượt qua Cloudflare của Vietlott.vn.

---

## 🧩 3. Các Thành Phần Hệ Thống

### **A. Cơ Sở Dữ Liệu (SQLite)**
Toàn bộ dữ liệu lịch sử của Mega 6/45, Power 6/55 và Max 3D Pro được lưu trữ trong tệp `vietlott.db`. Trên Railway, tệp này được gắn vào một **Volume** riêng để bảo toàn dữ liệu qua các lần cập nhật mã nguồn.

### **B. Bộ Cào Dữ Liệu (Scraper)**
Hệ thống sử dụng logic cào dữ liệu "Siêu tốc":
*   **Nguồn:** `xskt.com.vn` (Bypass 403 Forbidden).
*   **Hiệu suất:** Quét 3 giải đấu chỉ với 1 yêu cầu HTTP duy nhất.
*   **Trigger:** Có thể chạy thủ công qua `update.bat` hoặc từ xa qua lệnh `/update` trên Telegram.

---

## 🤖 4. Tính Năng Telegram Bot

Trợ lý ảo được bảo vệ bằng **Middleware Bảo Mật**, chỉ phản hồi duy nhất ID Chat của chủ nhân.

| Lệnh | Chức Năng | Chi Tiết |
| :--- | :--- | :--- |
| `/status` | Kiểm tra máy chủ | Kiểm tra tình trạng Online/Offline và Ping của Railway. |
| `/update` | Cập nhật dữ liệu | Kích hoạt bộ cào dữ liệu từ xa, báo cáo tiến độ 0% -> 100%. |
| `/kq <645/655>` | Tra cứu kết quả | Lấy kết quả kỳ gần nhất trực tiếp từ cơ sở dữ liệu. |
| `/dudoan <645/655>` | Dự đoán số | Gọi API phân tích từ Web để đưa ra các bộ số tiềm năng. |

---

## 🔒 5. Bảo Mật & Ổn Định

### **Bảo mật Chat ID**
Mọi yêu cầu gửi đến Bot đều được kiểm tra `TELEGRAM_CHAT_ID`. Nếu không khớp, Bot sẽ từ chối phục vụ, đảm bảo hệ thống không bị lạm dụng bởi người lạ.

### **Vượt rào Cloudflare**
Thay vì truy cập trực tiếp `vietlott.vn` (thường xuyên chặn IP máy chủ datacenter), hệ thống đã được chuyển hướng sang `xskt.com.vn`. Điều này đảm bảo tính năng cập nhật luôn hoạt động ổn định 24/7.

### **Cơ chế "Thức tỉnh" (Wake-up)**
Bot sử dụng cơ chế `axios` timeout ngắn để kích hoạt máy chủ Railway từ trạng thái ngủ (Sleep Mode) mà không làm treo tiến trình của Bot trên Vercel.

---

## 📈 6. Hướng Dẫn Bảo Trì

1.  **Cập nhật dữ liệu tại nhà:** Nếu muốn cập nhật nhanh trên máy tính cá nhân, chạy file `update.bat`.
2.  **Biến môi trường (Environment Variables):**
    *   `TELEGRAM_BOT_TOKEN`: Token từ BotFather.
    *   `TELEGRAM_CHAT_ID`: ID chat cá nhân của bạn.
    *   `RAILWAY_DOMAIN`: Địa chỉ web trên Railway.
3.  **Deploy:** Mọi thay đổi code khi `git push` sẽ tự động được cập nhật lên Web và Bot.

---

*Tài liệu được biên soạn tự động bởi Trợ lý AI Antigravity - 2026.*
