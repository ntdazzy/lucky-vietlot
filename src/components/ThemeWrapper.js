'use client';
import { ThemeProvider } from 'next-themes';

export default function ThemeWrapper({ children }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
      {children}
    </ThemeProvider>
  );
}
