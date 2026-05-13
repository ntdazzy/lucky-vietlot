const axios = require('axios');
const cheerio = require('cheerio');
const headers = { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function check() {
    const res = await axios.get('https://xskt.com.vn/xsmega645/trang-1', { headers });
    const $ = cheerio.load(res.data);
    const tables = $('table.result');
    console.log(`Page 1 has ${tables.length} tables.`);
    
    tables.first().each((i, el) => {
        console.log("First table draw ID:", $(el).find('.kmt b').text());
    });
}
check();
