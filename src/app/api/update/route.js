import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { getDbWritable } from '@/lib/db';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.get(url, {
        headers: BROWSER_HEADERS,
        timeout: 20000,
        validateStatus: (s) => s < 500,
        ...options,
      });
      if (res.status === 200) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    }
    if (attempt < maxRetries) await new Promise(r => setTimeout(r, 1000 * attempt));
  }
  throw lastError;
}

async function editTelegramMessage(chatId, messageId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId || !messageId) return;
  try {
    await axios.post(`https://api.telegram.org/bot${token}/editMessageText`, {
      chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML',
    });
  } catch {}
}

async function sendTelegramNotification(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId, text: message, parse_mode: 'HTML',
    });
  } catch {}
}

// Source 1: xskt.com.vn
async function fetchFromXskt(game) {
  const sourceUrls = {
    '645': 'https://xskt.com.vn/vietlott/mega-6-45',
    '655': 'https://xskt.com.vn/vietlott/power-6-55',
    '535': 'https://xskt.com.vn/vietlott/535',
    'max-3dpro': 'https://xskt.com.vn/vietlott/max-3d-pro',
  };
  const url = sourceUrls[game.code];
  if (!url) return null;

  const res = await fetchWithRetry(url, { headers: { ...BROWSER_HEADERS, 'Referer': 'https://xskt.com.vn/' } });
  const $ = cheerio.load(res.data);

  if (game.code === '645') {
    const table = $('table:has(a[href*="xsmega645/ngay"])').first();
    if (!table.length) return null;
    const drawId = table.find('a[href*="xsmega645/ngay"] b').text().replace('#', '').trim();
    const link = table.find('a[href*="xsmega645/ngay"]').attr('href');
    const dateStr = link?.match(/ngay-(.+)/)?.[1].replace(/-/g, '/');
    const balls = table.find('.megaresult em').text().trim().split(/\s+/).join(', ');
    if (!drawId || !balls) return null;
    return { drawId, dateStr, balls };
  }
  if (game.code === '655') {
    const table = $('table:has(a[href*="xspower/ngay"])').first();
    if (!table.length) return null;
    const drawId = table.find('a[href*="xspower/ngay"] b').text().replace('#', '').trim();
    const link = table.find('a[href*="xspower/ngay"]').attr('href');
    const dateStr = link?.match(/ngay-(.+)/)?.[1].replace(/-/g, '/');
    const balls = table.find('.megaresult').eq(0).find('em').text().trim().split(/\s+/).join(', ');
    const special_ball = table.find('.jp2 .megaresult').text().trim();
    if (!drawId || !balls) return null;
    return { drawId, dateStr, balls, special_ball };
  }
  if (game.code === '535') {
    const table = $('table:has(a[href*="xs535"])').first();
    if (!table.length) return null;
    const drawId = table.find('a[href*="xs535"] b').first().text().replace('#', '').trim();
    const link = table.find('a[href*="xs535"]').attr('href');
    const dateStr = link?.match(/ngay-(.+)/)?.[1].replace(/-/g, '/');
    const balls = table.find('.megaresult em').text().trim().split(/\s+/).join(', ');
    if (!drawId || !balls) return null;
    return { drawId, dateStr, balls };
  }
  if (game.code === 'max-3dpro') {
    const table = $('table:has(a[href*="xsmax3dpro/ngay"])').first();
    if (!table.length) return null;
    const drawId = table.find('a[href*="xsmax3dpro/ngay"] b').text().replace('#', '').trim();
    const link = table.find('a[href*="xsmax3dpro/ngay"]').attr('href');
    const dateStr = link?.match(/ngay-(.+)/)?.[1].replace(/-/g, '/');
    const extractMax = (trIndex) => table.find('tr').eq(trIndex).find('b').map((i, el) => $(el).text().trim().replace(/\s+/, ', ')).get().join(', ');
    if (!drawId) return null;
    return { drawId, dateStr, dac_biet: extractMax(1), nhat: extractMax(3), nhi: extractMax(4), ba: extractMax(5) };
  }
  return null;
}

// Source 2: minhngoc.net.vn
async function fetchFromMinhngoc(game) {
  const sourceUrls = {
    '645': 'https://www.minhngoc.net.vn/ket-qua-xo-so/vietlott/mega-6-45.html',
    '655': 'https://www.minhngoc.net.vn/ket-qua-xo-so/vietlott/power-6-55.html',
  };
  const url = sourceUrls[game.code];
  if (!url) return null;

  const res = await fetchWithRetry(url, { headers: { ...BROWSER_HEADERS, 'Referer': 'https://www.minhngoc.net.vn/' } });
  const $ = cheerio.load(res.data);

  if (game.code === '645') {
    const ballsArr = [];
    $('.bong_tron_vietlott').slice(0, 6).each((i, el) => ballsArr.push($(el).text().trim()));
    if (ballsArr.length !== 6) return null;
    const drawId = $('.kqxs_vietlott_left .info .row span').filter((i, el) => $(el).text().includes('#')).text().match(/#(\d+)/)?.[1];
    const dateStr = $('.kqxs_vietlott_left .info .date').text().trim();
    if (!drawId) return null;
    return { drawId, dateStr, balls: ballsArr.join(', ') };
  }
  if (game.code === '655') {
    const ballsArr = [];
    $('.bong_tron_vietlott').slice(0, 6).each((i, el) => ballsArr.push($(el).text().trim()));
    const special_ball = $('.bong_tron_vietlott').eq(6).text().trim();
    if (ballsArr.length !== 6 || !special_ball) return null;
    const drawId = $('.kqxs_vietlott_left .info .row span').filter((i, el) => $(el).text().includes('#')).text().match(/#(\d+)/)?.[1];
    const dateStr = $('.kqxs_vietlott_left .info .date').text().trim();
    if (!drawId) return null;
    return { drawId, dateStr, balls: ballsArr.join(', '), special_ball };
  }
  return null;
}

const FETCHERS = [fetchFromXskt, fetchFromMinhngoc];

async function fetchGameResult(game) {
  const errors = [];
  for (const fetcher of FETCHERS) {
    try {
      const data = await fetcher(game);
      if (data) return { data, source: fetcher.name };
    } catch (e) {
      errors.push(`${fetcher.name}: ${e.message}`);
    }
  }
  return { data: null, errors };
}

function saveResult(db, game, data) {
  if (game.code === '645') {
    db.prepare(`INSERT OR IGNORE INTO draws_645 (date, draw_id, balls) VALUES (?, ?, ?)`).run(data.dateStr, data.drawId, data.balls);
  } else if (game.code === '655') {
    db.prepare(`INSERT OR IGNORE INTO draws_655 (date, draw_id, balls, special_ball) VALUES (?, ?, ?, ?)`).run(data.dateStr, data.drawId, data.balls, data.special_ball);
  } else if (game.code === '535') {
    db.prepare(`INSERT OR IGNORE INTO draws_535 (date, draw_id, balls) VALUES (?, ?, ?)`).run(data.dateStr, data.drawId, data.balls);
  } else if (game.code === 'max-3dpro') {
    db.prepare(`INSERT OR IGNORE INTO draws_max3dpro (date, draw_id, dac_biet, nhat, nhi, ba) VALUES (?, ?, ?, ?, ?, ?)`).run(data.dateStr, data.drawId, data.dac_biet, data.nhat, data.nhi, data.ba);
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chat_id');
  const messageId = searchParams.get('message_id');

  const db = getDbWritable();
  const GAMES = [
    { code: '645', name: 'Mega 6/45', table: 'draws_645' },
    { code: '655', name: 'Power 6/55', table: 'draws_655' },
    { code: '535', name: 'Lotto 5/35', table: 'draws_535' },
    { code: 'max-3dpro', name: 'Max 3D Pro', table: 'draws_max3dpro' },
  ];

  let progress = '🔄 <b>Đang cập nhật dữ liệu... [0%]</b>\n';
  await editTelegramMessage(chatId, messageId, progress);

  const results = { updated: [], skipped: [], failed: [] };

  for (let i = 0; i < GAMES.length; i++) {
    const game = GAMES[i];
    progress += `\n⏳ Đang quét <b>${game.name}</b>...`;
    await editTelegramMessage(chatId, messageId, progress);

    try {
      const { data, source, errors } = await fetchGameResult(game);

      if (!data) {
        progress += ` ❌ Lỗi (${errors?.[0] || 'không có dữ liệu'})`;
        results.failed.push({ game: game.name, errors });
      } else {
        const tableName = game.table;
        const exists = db.prepare(`SELECT 1 FROM ${tableName} WHERE draw_id = ?`).get(data.drawId);

        if (exists) {
          progress += ` ✓ Đã có #${data.drawId}`;
          results.skipped.push({ game: game.name, drawId: data.drawId });
        } else {
          saveResult(db, game, data);
          progress += ` 🎉 Kỳ mới #${data.drawId}`;
          results.updated.push({ game: game.name, drawId: data.drawId, dateStr: data.dateStr });
          const ballsText = data.balls ? `\nKết quả: ${data.balls}${data.special_ball ? ` | ĐB: ${data.special_ball}` : ''}` : '';
          await sendTelegramNotification(`🎉 <b>Có kết quả ${game.name} mới!</b>\nKỳ #${data.drawId} - ${data.dateStr}${ballsText}`);
        }
      }
    } catch (e) {
      progress += ` ❌ ${e.message}`;
      results.failed.push({ game: game.name, error: e.message });
    }

    const pct = Math.round(((i + 1) / GAMES.length) * 100);
    progress = progress.replace(/\[\d+%\]/, `[${pct}%]`);
    await editTelegramMessage(chatId, messageId, progress);
  }

  const summary = `\n\n📊 <b>Tổng kết:</b>\n` +
    `✅ Cập nhật mới: ${results.updated.length}\n` +
    `⏭ Đã có sẵn: ${results.skipped.length}\n` +
    `❌ Lỗi: ${results.failed.length}`;

  if (results.failed.length > 0) {
    progress += summary + `\n\n💡 <i>Lỗi 403 thường do Railway bị chặn IP. Dùng /them để nhập tay.</i>`;
  } else {
    progress += summary;
  }
  await editTelegramMessage(chatId, messageId, progress);

  return NextResponse.json({ success: true, results });
}

// POST endpoint for manual data entry from Telegram
export async function POST(request) {
  try {
    const body = await request.json();
    const { game, drawId, dateStr, balls, special_ball, secret } = body;

    if (secret !== process.env.UPDATE_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDbWritable();
    const gameMap = {
      '645': { code: '645', name: 'Mega 6/45', table: 'draws_645' },
      '655': { code: '655', name: 'Power 6/55', table: 'draws_655' },
      '535': { code: '535', name: 'Lotto 5/35', table: 'draws_535' },
    };

    const g = gameMap[game];
    if (!g) return NextResponse.json({ error: 'Invalid game' }, { status: 400 });

    saveResult(db, g, { drawId, dateStr, balls, special_ball });
    await sendTelegramNotification(`📝 <b>Đã thêm thủ công:</b>\n${g.name} #${drawId} - ${dateStr}\nKết quả: ${balls}${special_ball ? ` | ĐB: ${special_ball}` : ''}`);

    return NextResponse.json({ success: true, game: g.name, drawId });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
