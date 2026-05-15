'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Settings, Volume2, Bell, Trash2, Download, Upload, Moon, Sun, RotateCcw, Database, Play, AlertTriangle } from 'lucide-react';
import { getSettings, setSettings as saveSettings, resetSettings } from '@/lib/user-settings';
import { unlockAudio, playPrizeSound } from '@/lib/sound-fx';
import AdminDataPanel from '@/components/AdminDataPanel';

export default function SettingsPage() {
    const { theme, setTheme } = useTheme();
    const [settings, setLocalSettings] = useState(null);
    const [mounted, setMounted] = useState(false);
    const [notifPerm, setNotifPerm] = useState('default');
    const [importResult, setImportResult] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setMounted(true);
        setLocalSettings(getSettings());
        if (typeof Notification !== 'undefined') setNotifPerm(Notification.permission);
    }, []);

    const update = useCallback((partial) => {
        const next = saveSettings(partial);
        setLocalSettings(next);
    }, []);

    const requestNotificationPermission = useCallback(async () => {
        if (typeof Notification === 'undefined') {
            alert('Trình duyệt không hỗ trợ Notification API');
            return;
        }
        const p = await Notification.requestPermission();
        setNotifPerm(p);
        if (p === 'granted') {
            update({ browserNotifications: true });
            new Notification('Vietlott Pro', { body: 'Thông báo đã được bật.', icon: '/icon-192x192.png' });
        } else {
            update({ browserNotifications: false });
        }
    }, [update]);

    const testSound = useCallback(async (tier) => {
        await unlockAudio();
        playPrizeSound(tier, settings?.soundVolume || 0.5);
    }, [settings]);

    const handleClearAllTickets = useCallback(async () => {
        if (!confirm('Xoá TOÀN BỘ vé đã chốt? Hành động này không hoàn tác được.')) return;
        setBusy(true);
        try {
            await fetch('/api/tickets/list?clearAll=1', { method: 'DELETE' });
            alert('Đã xoá toàn bộ vé.');
        } finally { setBusy(false); }
    }, []);

    const handleClearSimulated = useCallback(async () => {
        if (!confirm('Xoá tất cả kết quả mô phỏng (test)?')) return;
        setBusy(true);
        try {
            const r = await fetch('/api/tickets/list?clearSimulated=1', { method: 'DELETE' });
            const data = await r.json();
            alert(`Đã xoá ${data.deletedChecks || 0} kết quả mô phỏng.`);
        } finally { setBusy(false); }
    }, []);

    const handleExport = useCallback(async () => {
        setBusy(true);
        try {
            const r = await fetch('/api/tickets/export');
            if (!r.ok) throw new Error('Export thất bại');
            const data = await r.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vietlott-tickets-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            alert(`Lỗi: ${e.message}`);
        } finally { setBusy(false); }
    }, []);

    const handleImport = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBusy(true);
        setImportResult(null);
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const r = await fetch('/api/tickets/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed),
            });
            const data = await r.json();
            setImportResult(data);
        } catch (e) {
            setImportResult({ error: e.message });
        } finally {
            setBusy(false);
            e.target.value = ''; // allow re-importing same file
        }
    }, []);

    if (!mounted || !settings) {
        return <div className="loading-center"><div className="spinner" /></div>;
    }

    return (
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            <div className="page-header">
                <div className="page-badge" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' }}>
                    <Settings size={16} style={{ marginRight: 6 }} />
                    CÀI ĐẶT
                </div>
                <h1 className="page-title title-gradient">Cài Đặt</h1>
                <p className="page-subtitle">Tuỳ chỉnh thông báo, giao diện và quản lý dữ liệu</p>
            </div>

            {/* ADMIN DATA PANEL — sync/update/db from web */}
            <div style={{ marginBottom: '16px' }}>
                <AdminDataPanel />
            </div>

            {/* THEME */}
            <SettingsSection title="Giao diện" icon={theme === 'dark' ? Moon : Sun} color="#3b82f6">
                <Toggle
                    label="Chế độ tối"
                    description="Giao diện tối, dễ nhìn về đêm"
                    checked={theme === 'dark'}
                    onChange={(v) => setTheme(v ? 'dark' : 'light')}
                />
            </SettingsSection>

            {/* SOUND */}
            <SettingsSection title="Âm thanh" icon={Volume2} color="#10b981">
                <Toggle
                    label="Phát âm thanh khi trúng"
                    description="Mỗi tier có giai điệu khác nhau (jackpot có tiếng leng-keng)"
                    checked={settings.soundEnabled}
                    onChange={(v) => update({ soundEnabled: v })}
                />
                {settings.soundEnabled && (
                    <div style={{ marginTop: '14px' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                            Âm lượng: {Math.round(settings.soundVolume * 100)}%
                        </label>
                        <input
                            type="range"
                            min="0" max="1" step="0.05"
                            value={settings.soundVolume}
                            onChange={(e) => update({ soundVolume: parseFloat(e.target.value) })}
                            style={{ width: '100%' }}
                        />
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
                            {['third', 'second', 'first', 'jackpot2', 'jackpot'].map(tier => (
                                <button key={tier} onClick={() => testSound(tier)}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        padding: '6px 12px', borderRadius: '8px',
                                        background: 'var(--surface-strong)',
                                        border: '1px solid var(--surface-border)',
                                        color: 'var(--text-main)',
                                        fontSize: '0.78rem', cursor: 'pointer',
                                    }}
                                >
                                    <Play size={12} /> {tier}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </SettingsSection>

            {/* BROWSER NOTIFICATIONS */}
            <SettingsSection title="Thông báo trình duyệt" icon={Bell} color="#eab308">
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
                    Hiện thông báo ở khay hệ thống khi trúng giải — kể cả khi tab đang ẩn.
                </p>
                <div style={{
                    padding: '10px 14px', borderRadius: '8px',
                    background: notifPerm === 'granted' ? 'rgba(16,185,129,0.1)'
                              : notifPerm === 'denied' ? 'rgba(239,68,68,0.1)'
                              : 'rgba(234,179,8,0.1)',
                    color: notifPerm === 'granted' ? '#10b981' : notifPerm === 'denied' ? '#ef4444' : '#eab308',
                    fontSize: '0.85rem',
                    marginBottom: '12px',
                }}>
                    {notifPerm === 'granted' && '✓ Đã bật quyền thông báo'}
                    {notifPerm === 'denied' && '✗ Bạn đã từ chối quyền. Mở Cài đặt trình duyệt để bật lại.'}
                    {notifPerm === 'default' && '? Chưa cấp quyền'}
                </div>
                {notifPerm !== 'denied' && (
                    <button onClick={requestNotificationPermission} className="btn-primary" style={{ padding: '10px 18px', fontSize: '0.85rem' }}>
                        {notifPerm === 'granted' ? 'Test thông báo' : 'Bật thông báo'}
                    </button>
                )}
            </SettingsSection>

            {/* DATA MANAGEMENT */}
            <SettingsSection title="Dữ liệu vé chốt" icon={Database} color="#06b6d4">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button onClick={handleExport} disabled={busy} style={settingBtn}>
                        <Download size={16} /> Tải xuống toàn bộ vé (JSON backup)
                    </button>

                    <label style={{ ...settingBtn, cursor: 'pointer' }}>
                        <Upload size={16} /> Khôi phục từ file JSON
                        <input type="file" accept="application/json" onChange={handleImport} style={{ display: 'none' }} />
                    </label>

                    {importResult && (
                        <div style={{
                            padding: '10px 12px',
                            background: importResult.error ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                            color: importResult.error ? '#ef4444' : '#10b981',
                            borderRadius: '8px',
                            fontSize: '0.82rem',
                        }}>
                            {importResult.error
                                ? `❌ ${importResult.error}`
                                : `✓ Đã nhập ${importResult.imported || 0} vé (${importResult.skipped || 0} đã tồn tại, bỏ qua)`
                            }
                        </div>
                    )}

                    <hr style={{ border: 'none', borderTop: '1px solid var(--surface-border)', margin: '6px 0' }} />

                    <button onClick={handleClearSimulated} disabled={busy} style={{...settingBtn, color: '#eab308' }}>
                        <Trash2 size={16} /> Xoá kết quả mô phỏng (test data)
                    </button>
                    <button onClick={handleClearAllTickets} disabled={busy} style={{...settingBtn, color: '#ef4444' }}>
                        <AlertTriangle size={16} /> Xoá TẤT CẢ vé đã chốt
                    </button>
                </div>
            </SettingsSection>

            {/* MISC */}
            <SettingsSection title="Khác" icon={RotateCcw} color="#a855f7">
                <Toggle
                    label="Hỏi xác nhận khi tạo bộ số mới"
                    description="Tránh mất bộ chưa chốt khi nhấn nhầm 'Tạo bộ mới'"
                    checked={settings.confirmGenerate}
                    onChange={(v) => update({ confirmGenerate: v })}
                />
                <div style={{ marginTop: '14px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                        Tần suất kiểm tra kết quả mới: <strong>{settings.pollIntervalSec}s</strong>
                    </label>
                    <input
                        type="range" min="10" max="120" step="5"
                        value={settings.pollIntervalSec}
                        onChange={(e) => update({ pollIntervalSec: parseInt(e.target.value, 10) })}
                        style={{ width: '100%' }}
                    />
                </div>
                <button
                    onClick={() => { if (confirm('Đặt lại tất cả cài đặt về mặc định?')) { resetSettings(); setLocalSettings(getSettings()); } }}
                    style={{ ...settingBtn, marginTop: '16px', color: 'var(--text-muted)' }}
                >
                    <RotateCcw size={14} /> Đặt lại về mặc định
                </button>
            </SettingsSection>

            <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <Link href="/" style={{ color: 'var(--text-muted)' }}>← Về trang chủ</Link>
            </div>
        </div>
    );
}

const settingBtn = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    background: 'var(--surface-strong)',
    border: '1px solid var(--surface-border)',
    borderRadius: '8px',
    color: 'var(--text-main)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    textDecoration: 'none',
    width: '100%',
    textAlign: 'left',
    justifyContent: 'flex-start',
};

function SettingsSection({ title, icon: Icon, color, children }) {
    return (
        <div className="glass-panel" style={{ marginBottom: '16px', borderLeft: `3px solid ${color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Icon size={18} color={color} />
                <strong style={{ fontSize: '0.95rem' }}>{title}</strong>
            </div>
            {children}
        </div>
    );
}

function Toggle({ label, description, checked, onChange }) {
    return (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '4px 0' }}>
            <div style={{
                position: 'relative',
                width: '40px',
                height: '22px',
                borderRadius: '11px',
                background: checked ? 'var(--primary)' : 'var(--surface-strong)',
                transition: 'background 0.2s',
                flexShrink: 0,
                marginTop: '2px',
            }}>
                <div style={{
                    position: 'absolute',
                    top: '2px',
                    left: checked ? '20px' : '2px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: 'white',
                    transition: 'left 0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }} />
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', margin: 0 }}
                />
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{label}</div>
                {description && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
                        {description}
                    </div>
                )}
            </div>
        </label>
    );
}
