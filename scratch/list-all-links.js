const axios = require('axios');
const cheerio = require('cheerio');
const headers = { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

async function check() {
    const res = await axios.get('https://xskt.com.vn/xsmega645/trang-1', { headers });
    const $ = cheerio.load(res.data);
    console.log("--- ALL LINKS ---");
    $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('/')) {
            console.log(href);
        }
    });
}
check();
