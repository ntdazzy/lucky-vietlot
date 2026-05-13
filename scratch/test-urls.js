const axios = require('axios');
const headers = { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function test() {
    const urls = [
        'https://xskt.com.vn/xsmega645/p/1',
        'https://xskt.com.vn/xsmega645/p/2',
        'https://xskt.com.vn/xsmega645/trang-1',
        'https://xskt.com.vn/xsmega645/trang-2',
        'https://xskt.com.vn/xsmega645/200-ngay'
    ];
    
    for (const url of urls) {
        try {
            console.log(`Testing ${url}...`);
            const res = await axios.get(url, { headers, timeout: 5000 });
            console.log(`- Success! Status: ${res.status}`);
        } catch (e) {
            console.log(`- Failed! Status: ${e.response?.status || 'Error'}`);
        }
    }
}

test();
