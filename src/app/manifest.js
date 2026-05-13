export default function manifest() {
  return {
    name: 'Vietlott Analytics Pro',
    short_name: 'Vietlott Pro',
    description: 'Phân tích, tra cứu và gợi ý số Vietlott thông minh',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b0f19',
    theme_color: '#ff2a5f',
    lang: 'vi',
    categories: ['utilities', 'finance', 'lifestyle'],
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Gợi Ý Số May Mắn',
        short_name: 'Gợi Ý',
        description: 'Tạo bộ số ngẫu nhiên thông minh',
        url: '/du-doan',
        icons: [{ src: '/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Dò Số',
        short_name: 'Dò Số',
        description: 'Tra cứu kết quả Vietlott',
        url: '/tra-cuu',
        icons: [{ src: '/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Ví Vé',
        short_name: 'Ví Vé',
        description: 'Quản lý vé số của bạn',
        url: '/vi-ve',
        icons: [{ src: '/icon-192x192.png', sizes: '192x192' }],
      },
    ],
  };
}
