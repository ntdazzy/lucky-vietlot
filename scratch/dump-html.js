const axios = require('axios');
const headers = { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function dump() {
    const res = await axios.get('https://xskt.com.vn/xsmega645/trang-1', { headers });
    console.log(res.data.substring(0, 10000));
}
dump();
