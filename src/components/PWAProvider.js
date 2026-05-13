'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

export default function PWAProvider() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    setIsStandalone(standalone);

    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    const isProd = process.env.NODE_ENV === 'production';
    if ('serviceWorker' in navigator && isProd) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
          .then((reg) => {
            reg.addEventListener('updatefound', () => {
              const sw = reg.installing;
              if (!sw) return;
              sw.addEventListener('statechange', () => {
                if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                  sw.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            });
          })
          .catch(() => {});
      });
    } else if ('serviceWorker' in navigator && !isProd) {
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!localStorage.getItem('pwa-install-dismissed')) {
        setShowInstall(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (iOS && !standalone && !localStorage.getItem('pwa-install-dismissed')) {
      setShowInstall(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstall(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowInstall(false);
    localStorage.setItem('pwa-install-dismissed', '1');
  };

  if (isStandalone || !showInstall) return null;

  return (
    <div className="pwa-install-banner">
      <button className="pwa-install-close" onClick={handleDismiss} aria-label="Đóng">
        <X size={18} />
      </button>
      <div className="pwa-install-content">
        <div className="pwa-install-icon">
          <Download size={24} />
        </div>
        <div className="pwa-install-text">
          <strong>Cài đặt Vietlott Pro</strong>
          {isIOS ? (
            <span>Nhấn <Share size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> rồi chọn &quot;Thêm vào màn hình chính&quot;</span>
          ) : (
            <span>Dùng như app trên điện thoại — tải nhanh, không cần mở trình duyệt</span>
          )}
        </div>
        {!isIOS && deferredPrompt && (
          <button className="btn-primary pwa-install-btn" onClick={handleInstall}>
            Cài đặt
          </button>
        )}
      </div>
    </div>
  );
}
