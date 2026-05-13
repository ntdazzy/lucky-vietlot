const axios = require('axios');
const cheerio = require('cheerio');
const headers = { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

async function check() {
    const urls = [
        'https://xskt.com.vn/xsmega645/trang-1',
        'https://xskt.com.vn/xslotto-5-35/trang-1'
    ];
    for (const url of urls) {
        const res = await axios.get(url, { headers });
        const $ = cheerio.load(res.data);
        console.log(`URL: ${url} -> Title: ${$('title').text()}`);
    }
}
check();
