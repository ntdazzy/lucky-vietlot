import './globals.css';
import { Inter } from 'next/font/google';
import ThemeWrapper from '@/components/ThemeWrapper';
import Navbar from '@/components/Navbar';
import PWAProvider from '@/components/PWAProvider';
import NotificationListener from '@/components/NotificationListener';

const inter = Inter({ subsets: ['latin', 'vietnamese'], display: 'swap' });

export const metadata = {
  title: 'Vietlott Analytics Pro',
  description: 'Phân tích, tra cứu và gợi ý số Vietlott thông minh — dùng như app trên điện thoại',
  applicationName: 'Vietlott Pro',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Vietlott Pro',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: '/icon-192x192.png',
    apple: '/icon-192x192.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f19' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={inter.className} suppressHydrationWarning>
      <body>
        <ThemeWrapper>
          <Navbar />
          <main className="container main-content">
            {children}
          </main>
          <NotificationListener />
          <PWAProvider />
        </ThemeWrapper>
      </body>
    </html>
  );
}
