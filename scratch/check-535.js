const axios = require('axios');
const cheerio = require('cheerio');
const headers = { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

async function check() {
    const res = await axios.get('https://xskt.com.vn/xslotto-5-35/trang-1', { headers });
    const $ = cheerio.load(res.data);
    $('table.result').each((i, el) => {
        console.log(`Table ${i}: ${$(el).text().substring(0, 100)}...`);
    });
}
check();
