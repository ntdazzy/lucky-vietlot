'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCcw, Zap, Globe, Database, X, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import GameChip from './GameChip';

// ============================================================================
// ADMIN DATA PANEL
// ----------------------------------------------------------------------------
// On-screen equivalent of Telegram /db, /update, /syncall, /syncfull, /cancel
// commands. Shows live DB counts and sync progress.
// ============================================================================

export default function AdminDataPanel({ compact = false }) {
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [syncState, setSyncState] = useState({ running: false, durationMs: 0 });
    const [actionInProgress, setActionInProgress] = useState(null);
    const [logs, setLogs] = useState([]);
    const pollRef = useRef(null);

    const pushLog = useCallback((kind, message) => {
        setLogs(prev => [{ ts: new Date(), kind, message }, ...prev].slice(0, 6));
    }, []);

    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const r = await fetch('/api/db-status', { cache: 'no-store' });
            const data = await r.json();
            if (data.success) {
                setStats(data);
                setSyncState(data.sync || { running: false });
            }
        } catch (e) {
            pushLog('error', 'Không lấy được DB status: ' + e.message);
        }
        setStatsLoading(false);
    }, [pushLog]);

    // Initial load + poll while syncing
    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    useEffect(() => {
        if (syncState.running) {
            // Poll while sync running so user sees live updates
            if (!pollRef.current) {
                pollRef.current = setInterval(fetchStats, 3000);
            }
        } else if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [syncState.running, fetchStats]);

    const handleUpdate = useCallback(async () => {
        setActionInProgress('update');
        pushLog('info', 'Đang gọi /api/update...');
        try {
            const r = await fetch('/api/update');
            const data = await r.json();
            const u = data.results?.updated?.length || 0;
            const s = data.results?.skipped?.length || 0;
            const f = data.results?.failed?.length || 0;
            pushLog('success', `Update xong: +${u} mới, ${s} đã có, ${f} lỗi`);
            await fetchStats();
        } catch (e) {
            pushLog('error', 'Update thất bại: ' + e.message);
        }
        setActionInProgress(null);
    }, [fetchStats, pushLog]);

    const handleSync = useCallback(async (full = false) => {
        setActionInProgress(full ? 'syncfull' : 'sync');
        pushLog('info', full ? 'Khởi động backfill TOÀN BỘ...' : 'Khởi động sync tăng tiến...');
        try {
            const r = await fetch(`/api/sync-all${full ? '?full=1' : ''}`);
            const data = await r.json();
            if (data.success) {
                pushLog('success', `Sync token=${data.token} đã bắt đầu`);
            } else if (data.error) {
                pushLog('error', data.error);
            }
            await fetchStats();
        } catch (e) {
            pushLog('error', 'Sync thất bại: ' + e.message);
        }
        setActionInProgress(null);
    }, [fetchStats, pushLog]);

    const handleCancel = useCallback(async () => {
        setActionInProgress('cancel');
        try {
            const r = await fetch('/api/sync-cancel');
            const data = await r.json();
            pushLog(data.success ? 'info' : 'error', data.message || 'Đã gửi tín hiệu hủy');
            await fetchStats();
        } catch (e) {
            pushLog('error', 'Hủy thất bại: ' + e.message);
        }
        setActionInProgress(null);
    }, [fetchStats, pushLog]);

    const isAnyAction = actionInProgress !== null;

    return (
        <div className="glass-panel" style={{ borderLeft: '3px solid #06b6d4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Database size={18} color="#06b6d4" />
                <strong style={{ fontSize: '0.95rem' }}>Quản trị dữ liệu</strong>
                {syncState.running && (
                    <span style={{
                        marginLeft: 'auto',
                        fontSize: '0.72rem',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        background: 'rgba(234,179,8,0.15)',
                        color: '#eab308',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                    }}>
                        <Activity size={12} className="spin" />
                        Sync đang chạy ({Math.round(syncState.durationMs / 1000)}s)
                    </span>
                )}
            </div>

            {/* DB COUNTS */}
            {stats?.counts && (
                <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Database hiện có
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                        {Object.entries(stats.counts).map(([name, n]) => {
                            const code = name.includes('Mega') ? '645' : name.includes('Power') ? '655' : name.includes('Lotto') ? '535' : 'max3dpro';
                            return (
                                <div key={name} style={{
                                    background: 'var(--surface-strong)',
                                    padding: '10px 12px',
                                    borderRadius: '10px',
                                }}>
                                    <GameChip game={code} size="sm" variant="soft" />
                                    <div style={{ marginTop: '6px', fontWeight: 700, fontSize: '1.1rem' }}>
                                        {n.toLocaleString('vi-VN')} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>kỳ</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Tổng: <strong style={{ color: 'var(--text-main)' }}>{stats.total?.toLocaleString('vi-VN') || 0}</strong> kỳ
                    </div>
                </div>
            )}

            {/* ACTIONS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                <ActionButton
                    icon={RefreshCcw}
                    label="Lấy kỳ mới"
                    sub="Quét xskt 1 vòng"
                    color="#10b981"
                    onClick={handleUpdate}
                    disabled={isAnyAction || syncState.running}
                    busy={actionInProgress === 'update'}
                />
                <ActionButton
                    icon={Zap}
                    label="Sync tăng tiến"
                    sub="Bổ sung kỳ thiếu"
                    color="#3b82f6"
                    onClick={() => handleSync(false)}
                    disabled={isAnyAction || syncState.running}
                    busy={actionInProgress === 'sync'}
                />
                <ActionButton
                    icon={Globe}
                    label="Backfill toàn bộ"
                    sub="Quét lại từ ngày đầu"
                    color="#a855f7"
                    onClick={() => handleSync(true)}
                    disabled={isAnyAction || syncState.running}
                    busy={actionInProgress === 'syncfull'}
                />
                <ActionButton
                    icon={statsLoading ? Activity : Database}
                    label="Cập nhật DB"
                    sub="Reload thống kê"
                    color="#06b6d4"
                    onClick={fetchStats}
                    disabled={statsLoading}
                    busy={statsLoading}
                />
                {syncState.running && (
                    <ActionButton
                        icon={X}
                        label="Hủy sync"
                        sub="Dừng tiến trình"
                        color="#ef4444"
                        onClick={handleCancel}
                        disabled={actionInProgress === 'cancel'}
                        busy={actionInProgress === 'cancel'}
                    />
                )}
            </div>

            {/* LIVE LOG */}
            {logs.length > 0 && (
                <div style={{
                    marginTop: '14px',
                    padding: '10px 12px',
                    background: 'var(--surface-strong)',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontFamily: 'monospace',
                }}>
                    {logs.map((l, i) => (
                        <div key={i} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: l.kind === 'error' ? '#ef4444'
                                  : l.kind === 'success' ? '#10b981'
                                  : 'var(--text-muted)',
                            marginBottom: i < logs.length - 1 ? '4px' : 0,
                        }}>
                            {l.kind === 'error' ? <AlertCircle size={12} />
                              : l.kind === 'success' ? <CheckCircle2 size={12} />
                              : <Activity size={12} />}
                            <span style={{ opacity: 0.6 }}>{l.ts.toLocaleTimeString('vi-VN')}</span>
                            <span style={{ flex: 1 }}>{l.message}</span>
                        </div>
                    ))}
                </div>
            )}

            {!compact && (
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '12px 0 0', fontStyle: 'italic' }}>
                    💡 Tương đương lệnh <code>/update</code>, <code>/syncall</code>, <code>/syncfull</code>, <code>/db</code> trên Telegram bot.
                </p>
            )}
        </div>
    );
}

function ActionButton({ icon: Icon, label, sub, color, onClick, disabled, busy }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '4px',
                padding: '10px 12px',
                background: busy ? `${color}25` : 'var(--surface-strong)',
                border: `1px solid ${busy ? color : 'var(--surface-border)'}`,
                borderRadius: '10px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled && !busy ? 0.5 : 1,
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                textAlign: 'left',
                transition: 'all 0.15s',
            }}
        >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                <Icon size={14} color={color} className={busy ? 'spin' : ''} />
                {label}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub}</span>
        </button>
    );
}
