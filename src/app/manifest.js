export default function manifest() {
  return {
    name: 'Vietlott Analytics Pro',
    short_name: 'Vietlott Pro',
    description: 'Ứng dụng phân tích và tra cứu xổ số Vietlott thông minh với AI',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0f19',
    theme_color: '#10b981',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
