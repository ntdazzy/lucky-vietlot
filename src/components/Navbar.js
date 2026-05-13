'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Menu, X, Sun, Moon, Home, Search, BrainCircuit, Wallet, BookOpen, TrendingUp } from 'lucide-react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navLinks = [
    { name: 'Trang Chủ', path: '/', icon: <Home size={18} /> },
    { name: 'Tìm Số Đẹp', path: '/du-doan', icon: <BrainCircuit size={18} />, color: '#eab308' },
    { name: 'Dò Số', path: '/tra-cuu', icon: <Search size={18} /> },
    { name: 'Mẹo Chọn Số', path: '/quy-luat', icon: <TrendingUp size={18} /> },
    { name: 'Ví Vé', path: '/vi-ve', icon: <Wallet size={18} />, color: '#10b981' },
    { name: 'Hướng Dẫn Bao', path: '/huong-dan', icon: <BookOpen size={18} /> },
  ];

  const closeMenu = () => setIsOpen(false);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <Link href="/" className="logo" onClick={closeMenu}>
          <span style={{ color: 'var(--primary)' }}>VIETLOTT</span> PRO
        </Link>

        {/* Desktop Menu */}
        <div className="desktop-menu">
          {navLinks.map((link, idx) => (
            <Link 
              key={idx} 
              href={link.path} 
              className="nav-link"
              style={{ color: link.color || 'var(--text-main)', fontWeight: link.color ? 'bold' : 500 }}
            >
              {link.name}
            </Link>
          ))}
          
          {mounted && (
            <button 
              className="theme-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          )}
        </div>

        {/* Mobile controls */}
        <div className="mobile-controls">
          {mounted && (
            <button 
              className="theme-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          )}
          
          <button 
            className="hamburger-btn" 
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <div className={`mobile-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="mobile-sidebar-content">
          {navLinks.map((link, idx) => (
            <Link 
              key={idx} 
              href={link.path} 
              className="mobile-nav-link"
              onClick={closeMenu}
              style={{ color: link.color || 'var(--text-main)' }}
            >
              {link.icon}
              <span>{link.name}</span>
            </Link>
          ))}
        </div>
      </div>
      
      {/* Overlay */}
      {isOpen && <div className="mobile-overlay" onClick={closeMenu}></div>}
    </nav>
  );
}
