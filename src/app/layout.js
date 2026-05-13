import './globals.css';
import { Inter } from 'next/font/google';
import ThemeWrapper from '@/components/ThemeWrapper';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin', 'vietnamese'], display: 'swap' });

export const metadata = {
  title: 'Vietlott Analytics Pro',
  description: 'Nền tảng phân tích và dự đoán Vietlott hiện đại',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Vietlott Pro'
  }
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f19' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={inter.className} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body>
        <ThemeWrapper>
          <Navbar />
          <main className="container" style={{ marginTop: '40px', paddingBottom: '60px' }}>
            {children}
          </main>
        </ThemeWrapper>
      </body>
    </html>
  );
}