'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { getGameNames } from '@/lib/games';
import GameChip from '@/components/GameChip';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Ticket, Filter, RefreshCcw, Trophy, Sparkles, Award, Medal, Star, Clock, Search, ArrowUpDown, Trash2 } from 'lucide-react';

const GAME_NAMES = getGameNames();
const GAME_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: '645', label: 'Mega 6/45' },
  { key: '655', label: 'Power 6/55' },
  { key: '535', label: 'Lotto 5/35' },
];
const STATUS_FILTERS = [
  { key: 'all',     label: 'Tất cả' },
  { key: 'pending', label: 'Đang chờ' },
  { key: 'won',     label: 'Đã trúng' },
  { key: 'none',    label: 'Chưa trúng' },
];

const SORT_OPTIONS = [
  { key: 'newest', label: 'Mới nhất trước' },
  { key: 'oldest', label: 'Cũ nhất trước' },
  { key: 'tier',   label: 'Giải cao nhất' },
  { key: 'match',  label: 'Số trùng nhiều nhất' },
];

const TIER_COLOR_MAP = {
  jackpot:  '#fbbf24',
  jackpot2: '#a855f7',
  first:    '#ef4444',
  second:   '#f59e0b',
  third:    '#10b981',
  none:     '#64748b',
  pending:  '#06b6d4',
};

const TIER_ICONS = {
  jackpot: Trophy, jackpot2: Sparkles,
  first: Award, second: Medal, third: Star, none: Clock,
};

function ballCountFor(game) { return game === '535' ? 5 : 6; }

function cardClassForCheck(check, ticketBallCount) {
  if (!check) return 'win-card-pending';
  if (!check.prize) return 'win-card-none';
  // FULL match = jackpot independent of tier name (for game-specific 5/5 or 6/6)
  if (check.matchCount === ticketBallCount) {
    return check.prize.id === 'jackpot2' ? 'win-card-jp2' : 'win-card-jackpot';
  }
  switch (check.prize.id) {
    case 'jackpot':  return 'win-card-jackpot';
    case 'jackpot2': return 'win-card-jp2';
    case 'first':    return 'win-card-first';
    case 'second':   return 'win-card-second';
    case 'third':    return 'win-card-third';
    default:         return 'win-card-none';
  }
}

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gameFilter, setGameFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState('newest');
  const [expandedIds, setExpandedIds] = useState({});
  const [busy, setBusy] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const url = gameFilter === 'all'
        ? '/api/tickets/list?limit=200'
        : `/api/tickets/list?game=${gameFilter}&limit=200`;
      const r = await fetch(url, { cache: 'no-store' });
      const data = await r.json();
      if (data.success) setTickets(data.tickets);
    } catch {}
    setLoading(false);
  }, [gameFilter]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  // Filter + sort + search
  const filtered = useMemo(() => {
    let res = tickets;
    if (statusFilter === 'pending') res = res.filter(t => t.drawsRemaining > 0);
    if (statusFilter === 'won') res = res.filter(t => t.winCount > 0);
    if (statusFilter === 'none') res = res.filter(t => t.drawsRemaining === 0 && t.winCount === 0);
    if (search.trim()) {
      const q = search.trim().replace(/\s+/g, '');
      res = res.filter(t => t.mainBalls.join('').includes(q) || String(t.id) === q);
    }
    res = [...res]; // clone before sort
    const bestMatch = (t) => Math.max(0, ...(t.checks?.map(c => c.matchCount || 0) || [0]));
    switch (sortMode) {
      case 'oldest':
        res.sort((a, b) => a.id - b.id);
        break;
      case 'tier':
        res.sort((a, b) => (a.bestPrize?.rank || 99) - (b.bestPrize?.rank || 99));
        break;
      case 'match':
        res.sort((a, b) => bestMatch(b) - bestMatch(a));
        break;
      case 'newest':
      default:
        res.sort((a, b) => b.id - a.id);
    }
    return res;
  }, [tickets, statusFilter, search, sortMode]);

  // Compute stats summary
  const stats = useMemo(() => {
    const totalTickets = tickets.length;
    const totalChecks = tickets.reduce((s, t) => s + (t.checks?.length || 0), 0);
    const totalCost = tickets.reduce((s, t) => s + (t.lockForDraws || 1) * 10000, 0);
    const winsByTier = {};
    let bestPrize = null;
    let bestRank = 999;
    let totalChecked = 0;
    for (const t of tickets) {
      for (const c of (t.checks || [])) {
        totalChecked++;
        const tierId = c.prize?.id || 'none';
        if (tierId !== 'none') {
          winsByTier[tierId] = (winsByTier[tierId] || 0) + 1;
          if (c.prize.rank < bestRank) { bestRank = c.prize.rank; bestPrize = c.prize; }
        }
      }
    }
    const noneCount = totalChecked - Object.values(winsByTier).reduce((s, v) => s + v, 0);
    return { totalTickets, totalChecks, totalCost, winsByTier, bestPrize, totalChecked, noneCount };
  }, [tickets]);

  // Build pie chart data
  const chartData = useMemo(() => {
    const data = [];
    const tierLabels = {
      jackpot: '🏆 Jackpot', jackpot2: '💎 JP2',
      first: '🥇 Nhất', second: '🥈 Nhì', third: '🥉 Ba',
    };
    for (const [tier, label] of Object.entries(tierLabels)) {
      const n = stats.winsByTier[tier] || 0;
      if (n > 0) data.push({ name: label, value: n, color: TIER_COLOR_MAP[tier] });
    }
    if (stats.noneCount > 0) data.push({ name: 'Không trúng', value: stats.noneCount, color: TIER_COLOR_MAP.none });
    return data;
  }, [stats]);

  const handleClearSimulated = useCallback(async () => {
    if (!confirm('Xoá tất cả kết quả mô phỏng (test)?')) return;
    setBusy(true);
    try {
      const r = await fetch('/api/tickets/list?clearSimulated=1', { method: 'DELETE' });
      const data = await r.json();
      alert(`Đã xoá ${data.deletedChecks || 0} kết quả mô phỏng.`);
      await loadTickets();
    } finally { setBusy(false); }
  }, [loadTickets]);

  return (
    <div>
      <div className="page-header">
        <div className="page-badge" style={{ background: 'rgba(234, 179, 8, 0.12)', color: '#eab308' }}>
          <Ticket size={16} style={{ marginRight: 6 }} />
          VÉ CHỐT CỦA TÔI
        </div>
        <h1 className="page-title title-gradient">Vé Đã Chốt</h1>
        <p className="page-subtitle">Toàn bộ bộ số đã khoá và kết quả đối chiếu từng kỳ</p>
      </div>

      {/* STATS SUMMARY */}
      <div className="glass-panel" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
          <div className="stat-card">
            <div className="stat-card__label">Tổng vé chốt</div>
            <div className="stat-card__value">{stats.totalTickets}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Đã đối chiếu</div>
            <div className="stat-card__value">{stats.totalChecks} kỳ</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Chi phí giả định</div>
            <div className="stat-card__value" style={{ fontSize: '1rem' }}>{stats.totalCost.toLocaleString('vi-VN')}đ</div>
          </div>
          {stats.bestPrize && (
            <div className="stat-card" style={{ borderLeft: `3px solid ${stats.bestPrize.color}` }}>
              <div className="stat-card__label">Giải cao nhất</div>
              <div className="stat-card__value" style={{ color: stats.bestPrize.color, fontSize: '0.95rem' }}>
                {stats.bestPrize.emoji} {stats.bestPrize.label}
              </div>
            </div>
          )}
        </div>
        {Object.keys(stats.winsByTier).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
            {Object.entries(stats.winsByTier).map(([tier, n]) => (
              <span key={tier} style={{
                fontSize: '0.78rem',
                padding: '4px 12px',
                borderRadius: '20px',
                background: `${TIER_COLOR_MAP[tier]}22`,
                color: TIER_COLOR_MAP[tier],
                fontWeight: 700,
              }}>
                <strong>{n}</strong> lần {tier}
              </span>
            ))}
          </div>
        )}

        {/* MINI PIE CHART */}
        {chartData.length > 0 && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--surface-border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px', textAlign: 'center' }}>
              Phân bố kết quả ({stats.totalChecked} kỳ đã đối chiếu)
            </div>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={chartData} cx="50%" cy="50%" outerRadius={80} innerRadius={45} dataKey="value" label={(entry) => `${entry.value}`}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'rgba(11,15,25,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                    formatter={(value, name) => [`${value} kỳ`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', fontSize: '0.75rem' }}>
              {chartData.map((d, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: d.color }} />
                  {d.name}: {d.value}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FILTERS */}
      <div className="glass-panel" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Filter size={16} color="#a855f7" />
          <strong style={{ fontSize: '0.9rem' }}>Lọc</strong>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Loại xổ số</div>
          <div className="game-picker" style={{ justifyContent: 'flex-start' }}>
            {GAME_FILTERS.map(g => (
              <button key={g.key}
                onClick={() => setGameFilter(g.key)}
                className={`btn-game${gameFilter === g.key ? ' active' : ''}`}
                style={{ fontSize: '0.78rem', padding: '6px 14px', minHeight: '36px' }}
              >{g.label}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Trạng thái</div>
          <div className="game-picker" style={{ justifyContent: 'flex-start' }}>
            {STATUS_FILTERS.map(s => (
              <button key={s.key}
                onClick={() => setStatusFilter(s.key)}
                className={`btn-game${statusFilter === s.key ? ' active' : ''}`}
                style={{ fontSize: '0.78rem', padding: '6px 14px', minHeight: '36px' }}
              >{s.label}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
          <Search size={14} color="var(--text-muted)" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo ID vé hoặc dãy số..."
            style={{ flex: 1, fontSize: '0.85rem', minHeight: '38px' }}
          />
          <button onClick={loadTickets} className="btn-ghost" style={{ minHeight: '38px' }} title="Tải lại">
            <RefreshCcw size={14} />
          </button>
        </div>

        {/* SORT */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <ArrowUpDown size={14} color="var(--text-muted)" />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Sắp xếp:</span>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            className="custom-select"
            style={{ padding: '6px 28px 6px 10px', fontSize: '0.82rem', minHeight: '34px' }}
          >
            {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>

          <button
            onClick={handleClearSimulated}
            disabled={busy}
            style={{
              marginLeft: 'auto',
              padding: '5px 10px',
              fontSize: '0.72rem',
              borderRadius: '6px',
              background: 'rgba(234,179,8,0.1)',
              border: '1px solid rgba(234,179,8,0.3)',
              color: '#eab308',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Xoá tất cả check mô phỏng (test data)"
          >
            <Trash2 size={12} /> Xoá test
          </button>
        </div>
      </div>

      {/* GAME PALETTE LEGEND — show all chip styles at top */}
      <div className="glass-panel" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Màu nhận biết:</span>
        <GameChip game="645" size="sm" />
        <GameChip game="655" size="sm" />
        <GameChip game="535" size="sm" />
        <GameChip game="max3dpro" size="sm" />
      </div>

      {/* TICKET LIST */}
      {loading ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
          <div className="spinner" />
          <div style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Đang tải...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
          <Ticket size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            {tickets.length === 0 ? 'Bạn chưa chốt vé nào.' : 'Không có vé nào khớp bộ lọc.'}
          </p>
          {tickets.length === 0 && (
            <Link href="/du-doan" className="btn-primary" style={{ display: 'inline-block', marginTop: '16px', textDecoration: 'none' }}>
              Vào trang tạo số
            </Link>
          )}
        </div>
      ) : (
        <div>
          {filtered.map(t => <TicketCard key={t.id} ticket={t} expanded={expandedIds[t.id]} onToggle={() => setExpandedIds(s => ({...s, [t.id]: !s[t.id]}))} />)}
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket, expanded, onToggle }) {
  const ballCount = ballCountFor(ticket.game);
  const checks = ticket.checks || [];
  const fullMatchCheck = checks.find(c => c.matchCount === ballCount);
  const bestPrize = ticket.bestPrize;
  const isPending = ticket.drawsRemaining > 0;

  // Apply special "celebration" backgrounds for top tiers: jackpot OR jackpot2
  const isCelebration = bestPrize?.id === 'jackpot' || bestPrize?.id === 'jackpot2';
  const hasJackpot = isCelebration;
  const ticketCardClass = bestPrize?.id === 'jackpot' ? 'win-card-jackpot'
                       : bestPrize?.id === 'jackpot2' ? 'win-card-jp2'
                       : '';

  // Show top check by default (the highest-prize one)
  const headerCheck = bestPrize ? checks.find(c => c.prize?.id === bestPrize.id) : checks[checks.length - 1] || null;

  return (
    <div
      className={`glass-panel ticket-card ${ticketCardClass}`}
      style={{
        marginBottom: '14px',
        ...(hasJackpot ? { color: 'white' } : {}),
      }}
    >
      {/* HEADER ROW */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', opacity: hasJackpot ? 0.9 : 0.7, fontWeight: 600 }}>Vé #{ticket.id}</span>
            <GameChip game={ticket.game} size="sm" variant={hasJackpot ? 'outline' : 'soft'} />
          </div>
          <div style={{ fontSize: '0.72rem', opacity: hasJackpot ? 0.85 : 0.6 }}>
            Chốt: {ticket.confirmedAt} · {ticket.lockForDraws} kỳ
            {ticket.parentTicketId ? <> · 🔁 từ #{ticket.parentTicketId}</> : null}
          </div>
        </div>
        {bestPrize ? (
          <span style={{
            fontSize: '0.78rem',
            fontWeight: 800,
            padding: '6px 14px',
            borderRadius: '20px',
            background: hasJackpot ? 'rgba(0,0,0,0.25)' : `${bestPrize.color}25`,
            color: hasJackpot ? 'white' : bestPrize.color,
          }}>
            {bestPrize.emoji} {bestPrize.label}
          </span>
        ) : isPending ? (
          <span style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            padding: '6px 14px',
            borderRadius: '20px',
            background: 'rgba(234,179,8,0.15)',
            color: '#eab308',
          }}>
            ⏳ {ticket.drawsChecked}/{ticket.lockForDraws} kỳ
          </span>
        ) : (
          <span style={{
            fontSize: '0.78rem',
            padding: '6px 14px',
            borderRadius: '20px',
            background: 'rgba(100,116,139,0.15)',
            color: 'var(--text-muted)',
          }}>
            ➖ Chưa trúng
          </span>
        )}
      </div>

      {/* TICKET BALLS */}
      <div style={{ marginBottom: checks.length > 0 ? '14px' : 0 }}>
        <div style={{ fontSize: '0.72rem', opacity: 0.7, marginBottom: '6px' }}>Bộ số chốt:</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {ticket.mainBalls.map((b, i) => {
            const isHitInAny = checks.some(c => c.matched.includes(b));
            return (
              <span
                key={i}
                className={`ball${isHitInAny ? ' ball-hit' : ''}`}
                style={{ width: '36px', height: '36px', fontSize: '0.85rem' }}
              >{b}</span>
            );
          })}
          {ticket.specialBall && (
            <span className="ball gold" style={{ width: '36px', height: '36px', fontSize: '0.85rem' }}>{ticket.specialBall}</span>
          )}
        </div>
      </div>

      {/* CHECK LIST */}
      {checks.length > 0 && (
        <>
          {/* Default: show 1-2 most relevant checks. Expand to show all. */}
          {(expanded ? checks : checks.slice(headerCheck ? checks.indexOf(headerCheck) : 0, (headerCheck ? checks.indexOf(headerCheck) : 0) + 1)).map((c, i) => (
            <CheckRow key={c.checkId} check={c} ticketBalls={ticket.mainBalls} ballCount={ballCount} bgInherit={hasJackpot} />
          ))}

          {checks.length > 1 && (
            <button
              onClick={onToggle}
              style={{
                marginTop: '6px',
                background: 'transparent',
                border: 'none',
                color: hasJackpot ? 'rgba(255,255,255,0.9)' : 'var(--text-muted)',
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontWeight: 600,
                textDecoration: 'underline',
              }}
            >
              {expanded ? `Thu gọn` : `Xem tất cả ${checks.length} kỳ →`}
            </button>
          )}
        </>
      )}

      {/* ACTION FOOTER */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px', paddingTop: '12px', borderTop: hasJackpot ? '1px solid rgba(255,255,255,0.25)' : '1px solid var(--surface-border)' }}>
        <Link
          href={`/ket-qua/${ticket.id}`}
          style={{
            fontSize: '0.78rem',
            padding: '6px 14px',
            borderRadius: '8px',
            background: hasJackpot ? 'rgba(0,0,0,0.25)' : 'var(--surface-strong)',
            color: hasJackpot ? 'white' : 'inherit',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          📄 Chi tiết
        </Link>
      </div>
    </div>
  );
}

function CheckRow({ check, ticketBalls, ballCount, bgInherit }) {
  const matched = new Set(check.matched);
  const drawBalls = check.drawBalls || [];
  const tierColor = check.prize?.color;
  const isFull = check.matchCount === ballCount;

  return (
    <div style={{
      background: bgInherit ? 'rgba(0,0,0,0.18)' : 'var(--surface-strong)',
      padding: '10px 12px',
      borderRadius: '10px',
      marginBottom: '8px',
      borderLeft: tierColor ? `3px solid ${tierColor}` : '3px solid var(--surface-border)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.75rem', opacity: bgInherit ? 0.85 : 0.7 }}>
          Kỳ <strong>#{check.drawId}</strong> · {check.date}
          {check.simulated ? <span style={{ marginLeft: '6px', opacity: 0.7 }}>🧪</span> : null}
        </span>
        <span style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          color: tierColor || (bgInherit ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)'),
        }}>
          {isFull ? '🎊 TRÚNG ĐỘC ĐẮC!' : `${check.matchCount}/${ballCount}${check.prize?.id && check.prize.id !== 'none' ? ` · ${check.prize.label}` : ''}`}
        </span>
      </div>
      <div style={{ fontSize: '0.7rem', opacity: bgInherit ? 0.85 : 0.6, marginBottom: '4px' }}>Kết quả kỳ này:</div>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {drawBalls.map((b, i) => {
          const isHit = matched.has(b);
          return (
            <span
              key={i}
              className={`ball${isHit ? ' ball-hit' : ''}`}
              style={{ width: '30px', height: '30px', fontSize: '0.72rem', opacity: isHit ? 1 : 0.55 }}
            >{b}</span>
          );
        })}
        {check.drawSpecial && (
          <span className="ball gold" style={{
            width: '30px', height: '30px', fontSize: '0.72rem',
            opacity: check.specialMatch ? 1 : 0.4,
          }}>{check.drawSpecial}</span>
        )}
      </div>
    </div>
  );
}
