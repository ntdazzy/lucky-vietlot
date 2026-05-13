const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://xskt.com.vn/vietlott/mega-6-45').then(r => {
    const $ = cheerio.load(r.data);
    
    // Mega 6/45
    const megaTable = $('table:has(a[href*="xsmega645/ngay"])').first();
    const megaDraw = megaTable.find('a[href*="xsmega645/ngay"] b').text().replace('#', '').trim();
    const megaDate = megaTable.find('a[href*="xsmega645/ngay"]').attr('href').match(/ngay-(.+)/)[1].replace(/-/g, '/');
    const megaBalls = megaTable.find('.megaresult em').text().trim().split(/\s+/).join(', ');
    console.log("Mega:", megaDraw, megaDate, megaBalls);
    
    // Power 6/55
    const powerTable = $('table:has(a[href*="xspower/ngay"])').first();
    const powerDraw = powerTable.find('a[href*="xspower/ngay"] b').text().replace('#', '').trim();
    const powerDate = powerTable.find('a[href*="xspower/ngay"]').attr('href').match(/ngay-(.+)/)[1].replace(/-/g, '/');
    const powerBalls = powerTable.find('.megaresult').eq(0).find('em').text().trim().split(/\s+/).join(', ');
    const powerSpecial = powerTable.find('.jp2 .megaresult').text().trim();
    console.log("Power:", powerDraw, powerDate, powerBalls, "| special:", powerSpecial);
    
    // Max 3D Pro
    const maxTable = $('table:has(a[href*="xsmax3dpro/ngay"])').first();
    const maxDraw = maxTable.find('a[href*="xsmax3dpro/ngay"] b').text().replace('#', '').trim();
    const maxDate = maxTable.find('a[href*="xsmax3dpro/ngay"]').attr('href').match(/ngay-(.+)/)[1].replace(/-/g, '/');
    const extractMax = (trIndex) => maxTable.find('tr').eq(trIndex).find('b').map((i, el) => $(el).text().trim().replace(/\s+/, ', ')).get().join(', ');
    console.log("Max3DPro:", maxDraw, maxDate);
    console.log(" DB:", extractMax(1));
    console.log(" 1:", extractMax(3));
    console.log(" 2:", extractMax(4));
    console.log(" 3:", extractMax(5));

}).catch(e => console.error(e.message));
