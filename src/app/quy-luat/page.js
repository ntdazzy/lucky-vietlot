'use client';
import { useState, useEffect } from 'react';
import { analyzePatterns } from './actions';
import { getGameNames, getGame } from '@/lib/games';
import { Database, Network, LineChart, Cpu, Dice3, RefreshCcw } from 'lucide-react';

export default function PatternsPage() {
  const [game, setGame] = useState('645');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generatedNums, setGeneratedNums] = useState(null);

  useEffect(() => {
    setLoading(true);
    analyzePatterns(game).then(res => {
      setData(res);
      setLoading(false);
      setGeneratedNums(null);
    });
  }, [game]);

  const gameNames = getGameNames();

  const generateByRules = () => {
    if (!data) return;
    const cfg = getGame(game);
    const maxBall = cfg.maxBall;
    const ballCount = cfg.ballCount;
    const MAX_TRIES = 500;
    let picked = new Set();

    const topPairs = data.topPairs.slice(0, 5);
    const randPair = topPairs[Math.floor(Math.random() * topPairs.length)].pair.split("-");
    picked.add(randPair[0]);
    picked.add(randPair[1]);

    const lastBalls = data.lastDrawBalls.filter(b => !picked.has(b));
    if (lastBalls.length > 0) {
      picked.add(lastBalls[Math.floor(Math.random() * lastBalls.length)]);
    }

    let tries = 0;
    let added = false;
    while (tries < MAX_TRIES && !added) {
      const n = Math.floor(Math.random() * (maxBall - 1)) + 1;
      const s1 = n.toString().padStart(2, '0');
      const s2 = (n + 1).toString().padStart(2, '0');
      if (!picked.has(s1) && !picked.has(s2)) {
        picked.add(s1);
        picked.add(s2);
        added = true;
      }
      tries++;
    }

    if (data.topGap && data.topGap.length > 0) {
      const gapCandidates = data.topGap.filter(g => !picked.has(g.number));
      if (gapCandidates.length > 0 && picked.size < ballCount) {
        picked.add(gapCandidates[Math.floor(Math.random() * Math.min(5, gapCandidates.length))].number);
      }
    }

    tries = 0;
    while (picked.size < ballCount && tries < MAX_TRIES) {
      const r = (Math.floor(Math.random() * maxBall) + 1).toString().padStart(2, '0');
      picked.add(r);
      tries++;
    }

    setGeneratedNums(Array.from(picked).sort());
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-badge">
          <Network color="#84cc16" size={20} style={{ marginRight: '8px' }} />
          <span style={{ color: '#84cc16', fontWeight: 600, letterSpacing: '1px' }}>MẸO CHỌN SỐ THEO DỮ LIỆU</span>
        </div>
        <h1 className="page-title title-gradient">Phân Tích Xu Hướng</h1>
        <p className="page-subtitle">
          Dù xổ số là ngẫu nhiên, hệ thống vẫn có thể giúp bạn tìm ra những quy luật thú vị từ hàng ngàn kỳ quay trước.
        </p>
      </div>

      <div className="game-picker">
        {['645', '655', '535'].map(g => (
          <button key={g} onClick={() => setGame(g)} className={`btn-game${game === g ? ' active' : ''}`}>
            {gameNames[g]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
          <div className="spinner" style={{ display: 'inline-block', width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <div style={{ marginTop: '16px' }}>Đang quét và phân tích hàng ngàn kỳ quay...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

          {/* DASHBOARD */}
          <div className="stat-grid">

            {/* Cặp số hay đi cùng */}
            <div className="stat-card">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#a855f7', marginBottom: '20px' }}>
                <LineChart /> Đôi Bạn Cùng Tiến
              </h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
                Những cặp số thường hay rủ nhau cùng ra nhất.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {data.topPairs.slice(0, 5).map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-strong)', padding: '12px 16px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="ball" style={{ width: '36px', height: '36px', fontSize: '1rem', margin: 0 }}>{item.pair.split('-')[0]}</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '1.2rem' }}>&</span>
                      <span className="ball" style={{ width: '36px', height: '36px', fontSize: '1rem', margin: 0 }}>{item.pair.split('-')[1]}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.count} lần</span>
                      <span style={{ color: item.zScore > 2 ? '#ef4444' : '#a855f7', background: item.zScore > 2 ? 'rgba(239,68,68,0.1)' : 'rgba(168,85,247,0.1)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>Điểm: {item.zScore}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tỷ lệ số lặp lại & Số liên tiếp */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="stat-card" style={{ flex: 1 }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#38bdf8', marginBottom: '16px' }}>
                  <RefreshCcw /> Tỉ Lệ Rơi Lại Từ Kỳ Trước
                </h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
                  Tỉ lệ xuất hiện lại ít nhất 1 số của kỳ liền kề. Trung bình {data.avgRepeatPerDraw} số rơi lại mỗi kỳ.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '16px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#38bdf8', textShadow: '0 0 20px rgba(56,189,248,0.3)' }}>{data.repeatProb}%</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Toàn bộ</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#f59e0b', textShadow: '0 0 20px rgba(245,158,11,0.3)' }}>{data.repeatProbRecent}%</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>100 kỳ gần nhất</div>
                  </div>
                </div>
              </div>
              <div className="stat-card" style={{ flex: 1 }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#10b981', marginBottom: '16px' }}>
                  <Database /> Số Liền Kề Nhau
                </h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
                  Tỉ lệ xuất hiện 2 số sát nhau (VD: 23-24) trong cùng 1 kỳ quay.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '16px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#10b981', textShadow: '0 0 20px rgba(16,185,129,0.3)' }}>{data.consecutiveProb}%</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Toàn bộ</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#f59e0b', textShadow: '0 0 20px rgba(245,158,11,0.3)' }}>{data.consecutiveProbRecent}%</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>100 kỳ gần nhất</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SỐ LÂU CHƯA RA - GAP ANALYSIS */}
          {data.topGap && data.topGap.length > 0 && (
            <div className="glass-panel" style={{ borderLeft: '4px solid #ef4444' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ef4444', marginBottom: '16px', fontSize: '1.4rem' }}>
                Số Lâu Chưa Ra
              </h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>
                Những số đã không xuất hiện trong thời gian dài. Theo lý thuyết, vắng mặt càng lâu thì khả năng xuất hiện trong tương lai càng lớn.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {data.topGap.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--surface-strong)', padding: '12px 16px', borderRadius: '12px', minWidth: '80px' }}>
                    <span className="ball" style={{ width: '44px', height: '44px', fontSize: '1.1rem', margin: 0, background: idx < 3 ? 'linear-gradient(135deg, #ef4444, #f97316)' : '', color: idx < 3 ? '#fff' : '', border: idx < 3 ? 'none' : '', boxShadow: idx < 3 ? '0 0 15px rgba(239,68,68,0.4)' : '' }}>{item.number}</span>
                    <span style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 700, marginTop: '8px' }}>{item.gap} kỳ</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>vắng mặt</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TẠO BỘ SỐ NHANH */}
          <div className="algo-card">
            <h3 style={{ fontSize: '1.8rem', marginBottom: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Cpu color="var(--primary)" /> Tạo Bộ Số Nhanh
            </h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
              Bộ số bám sát các quy luật thống kê Big Data:<br />
              ✔️ 1 cặp trong Top 5 cặp Z-Score cao nhất.<br />
              ✔️ 1 lô rơi từ kỳ trước ({data.lastDrawBalls.join(', ')}).<br />
              ✔️ 1 cặp số liền kề (an toàn, có giới hạn loop).<br />
              ✔️ 1 số từ Top Số Lâu Chưa Ra (vắng lâu nhất).
            </p>

            <button className="btn-primary" onClick={generateByRules} style={{ width: '100%', padding: '16px', fontSize: '1.2rem', display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <Dice3 /> TẠO BỘ SỐ NGAY
            </button>

            {generatedNums && (
              <div style={{ marginTop: '32px', textAlign: 'center', animation: 'fadeInUp 0.4s ease-out' }}>
                <div className="ball-group" style={{ justifyContent: 'center' }}>
                  {generatedNums.map((num, idx) => (
                    <span key={idx} className="ball" style={{ width: 'clamp(40px, 12vw, 60px)', height: 'clamp(40px, 12vw, 60px)', fontSize: 'clamp(1rem, 4vw, 1.6rem)', flexShrink: 0, background: 'linear-gradient(135deg, var(--primary), #ff7b9c)', color: 'var(--text-main)', border: 'none' }}>
                      {num}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}