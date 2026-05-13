const axios = require('axios');
const cheerio = require('cheerio');
const headers = { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

async function check() {
    const res = await axios.get('https://xskt.com.vn/kqxs-vietlott/', { headers });
    const $ = cheerio.load(res.data);
    console.log("--- GAMES ON VIETLOTT PAGE ---");
    $('.sidebar-box a').each((i, el) => {
        console.log($(el).text().trim(), ":", $(el).attr('href'));
    });
}
check();
