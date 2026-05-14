# TODO — Vietlott Analytics Pro

> Phân tích ngày 14/05/2026 bởi Senior Dev review.
> Phân loại: 🔴 Cao | 🟡 Trung bình | 🟢 Thấp

---

## 1. FILES & FOLDERS THỪA (Không được import/sử dụng)

### Trong `vietlott-analytics/`

| File | Lý do | Hành động |
|---|---|---|
| `src/app/page.module.css` | Next.js boilerplate, không được import ở bất kỳ đâu | **Xóa** |
| `public/file.svg` | Next.js default, không được dùng | **Xóa** |
| `public/globe.svg` | Next.js default, không được dùng | **Xóa** |
| `public/next.svg` | Next.js default, không được dùng | **Xóa** |
| `public/vercel.svg` | Next.js default, không được dùng | **Xóa** |
| `public/window.svg` | Next.js default, không được dùng | **Xóa** |
| `README.md` | Chỉ chứa nội dung mặc định của Next.js, không phải doc dự án | Viết lại hoặc xóa |
| `AGENTS.md` | Chỉ chứa 1 cảnh báo về Next.js version | Merge vào CLAUDE.md rồi xóa |
| `.env.example` | Kiểm tra xem có cần giữ không |  |

### Code thừa trong source

| Vị trí | Chi tiết |
|---|---|
| `src/lib/games.js:11` | `getLotteryGames()` — export nhưng không được import ở bất kỳ file nào |
| `src/lib/games.js:12` | `getAllGames()` — export nhưng không được import ở bất kỳ file nào |
| `src/app/du-doan/actions.js:393` | `deleteHistoryItem()` — export nhưng không được gọi từ page nào |
| `src/lib/db.js:431` | `deletePredictionById()` — chỉ được dùng bởi `deleteHistoryItem` (cũng thừa) |

### Ở root `claude/` (ngoài project)

| File | Lý do |
|---|---|
| `vietlott_test.html` | File test cũ, không liên quan đến project Next.js |
| `vietlott_scraper/test.html` | File test HTML scraper cũ |
| `vietlott_scraper/test.js` | File test JS scraper cũ |
| `vietlott_scraper/` (toàn bộ) | Scraper cũ — logic đã được tích hợp vào `scripts/` và API routes. CSV dữ liệu đã import xong vào DB. Cân nhắc archive hoặc xóa |

---

## 2. BUGS — Cần sửa ngay

### 🔴 BUG-01: Link sai route trong trang Dò Số (`tra-cuu/page.js`)
- **File:** `src/app/tra-cuu/page.js:82,97`
- **Vấn đề:** Tất cả link game picker và mode tabs trỏ đến `/search?game=...` nhưng route thực tế là `/tra-cuu`. Không tồn tại route `/search` → **404 khi nhấn nút**.
- **Fix:** Đổi `/search` → `/tra-cuu` ở cả 2 dòng.

### 🔴 BUG-02: Phép tính vô nghĩa trong Khoa Học Số (`khoa-hoc/page.js`)
- **File:** `src/app/khoa-hoc/page.js:178`
- **Vấn đề:** `data.winner.testedDraws / data.winner.testedDraws * data.winner.testedDraws / 100 * 100` = luôn ra `testedDraws` (chia cho chính nó = 1, nhân lại = chính nó). Label hiển thị sai.
- **Fix:** Nên là `{data.testWindow}` đơn giản (giống label của match4Rate ở dòng 182).

### 🟡 BUG-03: `console.error` trong production code
- **File:** `src/app/tra-cuu/page.js:52`, `src/app/api/predict/route.js:29`, `src/app/api/db-status/route.js:28`
- **Vấn đề:** Vi phạm rule `code-style.md` — không dùng `console.log` trong production.
- **Fix:** Dùng logging service hoặc xóa, hoặc thay bằng server-side logger.

---

## 3. CODE SMELLS & RỦI RO

### 🔴 SMELL-01: API `sync-all/route.js` dùng CommonJS lẫn ESM
- **File:** `src/app/api/sync-all/route.js:3-6`
- **Vấn đề:** `const axios = require('axios')` + `const cheerio = require('cheerio')` + `const Database = require('better-sqlite3')` — trộn `require()` với ESM `import` ở line 1-2. Có thể gây lỗi bundle hoặc tree-shaking trong Next.js.
- **Fix:** Chuyển tất cả sang ESM `import`.

### 🔴 SMELL-02: `sync-all/route.js` duplicate `getDbWritable()`
- **File:** `src/app/api/sync-all/route.js:10-15`
- **Vấn đề:** Tạo lại function `getDbWritable()` thay vì import từ `@/lib/db`. Dẫn đến 2 DB connection riêng biệt, không đồng bộ.
- **Fix:** Import từ `@/lib/db.js`.

### 🔴 SMELL-03: `sync-all` xóa TOÀN BỘ data trước khi sync
- **File:** `src/app/api/sync-all/route.js:63-68`
- **Vấn đề:** `DELETE FROM draws_645`, `DELETE FROM draws_655`, etc. → Nếu sync fail giữa chừng, **toàn bộ data bị mất** không phục hồi được. Đây là thao tác cực kỳ nguy hiểm.
- **Fix:** Dùng temporary table hoặc transaction rollback, hoặc chỉ `INSERT OR REPLACE` thay vì xóa trước.

### 🟡 SMELL-04: SQL table name interpolation
- **File:** `src/lib/db.js` (nhiều dòng: 56, 65, 101, 177, 217, 270, 314, 335, 360, 446, 479, 528)
- **Vấn đề:** `` `SELECT * FROM ${table}` `` — table name chèn trực tiếp vào SQL string. Dù đã validate qua `validateGame()`, đây vẫn là anti-pattern. Nếu ai thêm game mới với table name chứa ký tự đặc biệt → SQL injection.
- **Fix:** Whitelist table names cứng hoặc dùng bracket escaping.

### 🟡 SMELL-05: O(n²) trong DashboardCharts
- **File:** `src/components/DashboardCharts.js:74`
- **Vấn đề:** `Math.max(...freqData.map(d => d.count))` được gọi BÊN TRONG `.map()` callback → O(n²). Với 45-55 số thì không quá nặng, nhưng là code smell rõ ràng.
- **Fix:** Tính `maxCount` 1 lần trước vòng lặp.

### 🟡 SMELL-06: Toàn bộ data load vào RAM để xử lý
- **File:** `src/lib/db.js` — hầu hết các function (`getStats`, `getAdvancedStats`, `getDecadeDistribution`, v.v.)
- **Vấn đề:** Lấy toàn bộ draws bằng `SELECT * FROM table` rồi xử lý bằng JS. Với ~1500 kỳ quay hiện tại thì OK, nhưng khi data tăng lên sẽ chậm.
- **Fix:** Chuyển sang SQL aggregation khi có thể (SUM, COUNT, GROUP BY).

### 🟡 SMELL-07: `tra-cuu/page.js` hardcode table mapping
- **File:** `src/app/tra-cuu/page.js:7`
- **Vấn đề:** `VALID_TABLES` duplicate thông tin từ `games.js`. Nếu thêm game mới, phải sửa 2 chỗ.
- **Fix:** Import từ `games.js` hoặc `db.js`.

### 🟡 SMELL-08: Inline styles tràn lan
- **Files:** `src/app/vi-ve/page.js`, `src/app/huong-dan/page.js`, `src/app/quy-luat/page.js`, `src/app/tra-cuu/page.js`
- **Vấn đề:** Hàng trăm dòng inline `style={{...}}` thay vì dùng CSS classes trong `globals.css`. Khiến code khó đọc, khó maintain, và tăng bundle size.
- **Fix:** Trích xuất thành CSS classes trong `globals.css`.

### 🟢 SMELL-09: `alert()` trong Ví Vé
- **File:** `src/app/vi-ve/page.js:43`
- **Vấn đề:** Dùng `alert()` native — UX kém, không match design system.
- **Fix:** Dùng custom toast/modal component.

### 🟢 SMELL-10: Missing error boundary
- **Vấn đề:** Không có `error.js` ở bất kỳ route nào. Nếu server component throw error → trắng trang.
- **Fix:** Thêm `src/app/error.js` global.

### 🟢 SMELL-11: `csv-parser` trong dependencies
- **File:** `package.json`
- **Vấn đề:** `csv-parser` chỉ dùng trong `scripts/import-db.js` (one-time import script), không cần trong production runtime.
- **Fix:** Chuyển sang `devDependencies`.

---

## 4. CÔNG VIỆC DANG DỞ

### 🔴 TODO-01: Trang Thống Kê thiếu game Lotto 5/35
- **File:** `src/app/thong-ke/page.js:60`
- **Vấn đề:** Game picker chỉ có `['645', '655', 'max3dpro']` — thiếu `'535'`. Lotto 5/35 đã có data nhưng không thể xem thống kê.
- **Fix:** Thêm `'535'` vào array.

### 🟡 TODO-02: Ví Vé chỉ hỗ trợ 645 và 655
- **File:** `src/app/vi-ve/page.js:117-123`
- **Vấn đề:** Select chỉ có Mega 6/45 và Power 6/55. Thiếu Lotto 5/35 (đã có data).
- **Fix:** Thêm option Lotto 5/35, cập nhật `checkWinningTickets()` action.

### 🟡 TODO-03: Thiếu loading state cho nhiều trang
- **File:** `src/app/page.js`, `src/app/thong-ke/page.js`
- **Vấn đề:** Là Server Components, không có `loading.js` → trắng trang khi data chậm.
- **Fix:** Thêm `loading.js` cho mỗi route.

### 🟡 TODO-04: Thiếu SEO metadata cho một số trang
- **Files:** `src/app/tra-cuu/page.js`, `src/app/quy-luat/page.js`, `src/app/vi-ve/page.js`, `src/app/khoa-hoc/page.js`
- **Vấn đề:** Không export `metadata` object → dùng title mặc định.
- **Fix:** Thêm `export const metadata = {...}` cho mỗi page.

### 🟢 TODO-05: Service Worker cache strategy cần review
- **File:** `public/sw.js`
- **Vấn đề:** Cache version `vietlott-v1` hardcoded. Không tự update khi deploy version mới.
- **Fix:** Inject build hash vào cache version, hoặc dùng Next.js built-in PWA plugin.

### 🟢 TODO-06: `.gitignore` thiếu một số entries
- Cần đảm bảo `vietlott.db` (file SQLite ~10MB) không bị commit vào Git.

---

## 5. ĐỀ XUẤT CẢI TIẾN

### 🟡 IMP-01: Tách CSS inline thành module/classes
- Ước tính ~500 dòng inline style có thể chuyển sang `globals.css`.
- Giảm ~30% kích thước JSX, dễ maintain hơn nhiều.

### 🟡 IMP-02: Thêm TypeScript
- Dự án đang dùng JS thuần. TypeScript sẽ bắt được nhiều bug tại compile time (đặc biệt bug tính toán như BUG-02).

### 🟡 IMP-03: Thêm test coverage
- Hiện tại: **0 tests**. Không có unit test, integration test, hay e2e test.
- Ưu tiên: Test cho `src/lib/db.js` (logic phức tạp) và `src/app/du-doan/actions.js` (prediction engine).

### 🟢 IMP-04: Responsive improvements
- Một số trang (vi-ve, huong-dan, quy-luat) dùng hardcoded pixel values thay vì responsive CSS variables.

### 🟢 IMP-05: Accessibility
- Thiếu ARIA labels ở nhiều interactive elements.
- Thiếu `alt` text cho icon-only buttons.
- Color contrast chưa được kiểm tra cho light mode.
