const axios = require('axios');
const cheerio = require('cheerio');
const headers = { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function parse() {
    const res = await axios.get('https://xskt.com.vn/xsmega645/trang-1', { headers });
    const $ = cheerio.load(res.data);
    
    console.log("--- TABLES ---");
    $('table.result').each((i, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        console.log(`Table ${i}: ${text.substring(0, 100)}...`);
        const drawId = $(el).find('a[href*="/ngay-"] b').text();
        console.log(`- Found drawId: ${drawId}`);
    });
}
parse();
