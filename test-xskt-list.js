const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://xskt.com.vn/xsmax3dpro').then(r => {
    const $ = cheerio.load(r.data);
    console.log($('table.max3d').first().html().substring(0, 3000));
}).catch(e => console.error(e.message));
