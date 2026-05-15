'use client';
import { useState, useTransition } from 'react';
import { runFullBacktest, generateWithWinner } from './actions';
import { getGameNames } from '@/lib/games';
import { FlaskConical, Trophy, Sparkles, BarChart3, Info, Loader2 } from 'lucide-react';

const TEST_WINDOWS = [50, 100, 200];

export default function ScienceLabPage() {
  const [game, setGame] = useState('645');
  const [testWindow, setTestWindow] = useState(100);
  const [data, setData] = useState(null);
  const [generated, setGenerated] = useState(null);
  const [isPending, startTransition] = useTransition();
  const [useAllDraws, setUseAllDraws] = useState(false);
  const [bao, setBao] = useState('standard');
  const gameNames = getGameNames();

  const runBacktest = () => {
    setData(null);
    setGenerated(null);
    startTransition(async () => {
      const res = await runFullBacktest(game, testWindow, useAllDraws);
      setData(res);
    });
  };

  const generateFromWinner = async () => {
    if (!data?.winner) return;
    const res = await generateWithWinner(game, data.winner.id, useAllDraws, bao);
    setGenerated(res);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-badge" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
          <FlaskConical size={16} style={{ marginRight: 6 }} />
          PHÒNG THÍ NGHIỆM SỐ
        </div>
        <h1 className="page-title title-gradient">Khoa Học Số</h1>
        <p className="page-subtitle">
          Tự động kiểm tra 8 chiến lược chọn số trên dữ liệu lịch sử để tìm ra cách dự đoán hiệu quả nhất.
        </p>
      </div>

      <div className="glass-panel section-spacing">
        <div className="lab-controls">
          <div className="lab-control-group">
            <label className="lab-label">Loại xổ số</label>
            <div className="game-picker">
              {['645', '655', '535'].map(g => (
                <button
                  key={g}
                  onClick={() => setGame(g)}
                  className={`btn-game${game === g ? ' active' : ''}`}
                  disabled={isPending}
                >
                  {gameNames[g]}
                </button>
              ))}
            </div>
          </div>

          <div className="lab-control-group">
            <label className="lab-label">Số kỳ test gần nhất</label>
            <div className="game-picker">
              {TEST_WINDOWS.map(w => (
                <button
                  key={w}
                  onClick={() => setTestWindow(w)}
                  className={`btn-game${testWindow === w ? ' active' : ''}`}
                  disabled={isPending}
                >
                  {w} kỳ
                </button>
              ))}
            </div>
          </div>

          <div className="lab-control-group">
            <label className="lab-label">Nguồn dữ liệu huấn luyện</label>
            <div className="data-source-toggle" style={{ margin: 0 }}>
              <button 
                onClick={() => setUseAllDraws(false)} 
                className={`data-source-btn${!useAllDraws ? ' active' : ''}`}
                disabled={isPending}
                style={{ padding: '8px 16px' }}
              >
                <span>500 kỳ gần nhất</span>
              </button>
              <button 
                onClick={() => setUseAllDraws(true)} 
                className={`data-source-btn${useAllDraws ? ' active' : ''}`}
                disabled={isPending}
                style={{ padding: '8px 16px' }}
              >
                <span>Tất cả các kỳ</span>
              </button>
            </div>
          </div>

          <div className="lab-control-group">
            <label className="lab-label">Chế độ tạo số (Bao)</label>
            <div className="custom-select-wrapper" style={{ margin: 0, padding: '8px 12px' }}>
              <select 
                value={bao} 
                onChange={(e) => setBao(e.target.value)}
                className="custom-select"
                disabled={isPending}
              >
                <option value="standard">Tiêu chuẩn</option>
                {(game === '645' || game === '655') && (
                  <>
                    <option value="5">Bao 5</option>
                    {[7, 8, 9, 10, 11, 12, 13, 14, 15, 18].map(b => (
                      <option key={b} value={b}>Bao {b}</option>
                    ))}
                  </>
                )}
                {game === '535' && (
                  <>
                    {[6, 7, 8, 9, 10].map(b => (
                      <option key={b} value={b}>Bao {b}</option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          <button
            onClick={runBacktest}
            className="btn-primary lab-run-btn"
            disabled={isPending}
          >
            {isPending ? <><Loader2 size={20} className="spin" /> Đang phân tích...</> : <><FlaskConical size={20} /> Bắt đầu kiểm tra</>}
          </button>
        </div>

        <div className="lab-info">
          <Info size={14} />
          <span>Hệ thống sẽ chạy {data ? '8' : ''} chiến lược trên {testWindow} kỳ quay gần nhất, đo độ chính xác trung bình của mỗi cách.</span>
        </div>
      </div>

      {data?.error && (
        <div className="glass-panel section-spacing">
          <div className="empty-state">⚠️ {data.error}</div>
        </div>
      )}

      {data?.winner && (
        <>
          <div className="glass-panel winner-panel section-spacing">
            <div className="winner-header">
              <Trophy size={32} color="#eab308" />
              <div>
                <div className="winner-label">Chiến lược thắng cuộc</div>
                <h2 className="winner-name">{data.winner.emoji} {data.winner.name}</h2>
              </div>
            </div>
            <p className="winner-desc">{data.winner.desc}</p>

            <div className="winner-stats">
              <div className="winner-stat">
                <div className="winner-stat-value">{data.winner.avgMatch}</div>
                <div className="winner-stat-label">Trúng trung bình / kỳ</div>
              </div>
              <div className="winner-stat">
                <div className="winner-stat-value" style={{ color: data.winner.liftOverRandom > 0 ? '#10b981' : '#ef4444' }}>
                  {data.winner.liftOverRandom > 0 ? '+' : ''}{data.winner.liftOverRandom}%
                </div>
                <div className="winner-stat-label">So với ngẫu nhiên</div>
              </div>
              <div className="winner-stat">
                <div className="winner-stat-value" style={{ color: '#3b82f6' }}>{data.winner.match3Rate}%</div>
                <div className="winner-stat-label">Tỉ lệ trúng 3+/{data.winner.testedDraws / data.winner.testedDraws * data.winner.testedDraws / 100 * 100 || data.testWindow}</div>
              </div>
              <div className="winner-stat">
                <div className="winner-stat-value" style={{ color: '#f59e0b' }}>{data.winner.match4Rate}%</div>
                <div className="winner-stat-label">Tỉ lệ trúng 4+</div>
              </div>
            </div>

            <button onClick={generateFromWinner} className="btn-primary lab-generate-btn">
              <Sparkles size={18} /> Tạo bộ số bằng chiến lược này
            </button>

            {generated && (
              <div className="winner-generated">
                <div className="winner-generated-label">Bộ số đề xuất:</div>
                <div className="ball-group">
                  {generated.main.map((n, i) => (
                    <span key={i} className="ball ball-hot">{n}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* MATCH HISTORY — Các kỳ quá khứ trùng ≥3 số với bộ vừa tạo */}
          {generated?.matchHistory && (
            <div className="glass-panel section-spacing" style={{ borderLeft: '3px solid #06b6d4' }}>
              <div className="panel-header">
                <BarChart3 size={20} color="#06b6d4" />
                <h2 className="panel-title">Đối chiếu lịch sử</h2>
                <span className="panel-subtitle">Tổng số kỳ quá khứ có ≥ 3 số trùng với bộ vừa tạo</span>
              </div>
              {generated.matchHistory.length === 0 ? (
                <p style={{ color: '#10b981', fontSize: '0.9rem', margin: 0 }}>
                  ✨ Không có kỳ nào trong lịch sử trùng ≥ 3 số với bộ này — bộ số "mới hoàn toàn".
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    {Object.entries(generated.matchSummary?.byCount || {})
                      .filter(([_, n]) => n > 0)
                      .map(([k, n]) => (
                        <span key={k} style={{
                          background: parseInt(k) >= 5 ? 'rgba(239,68,68,0.15)' : parseInt(k) === 4 ? 'rgba(245,158,11,0.15)' : 'rgba(6,182,212,0.15)',
                          color: parseInt(k) >= 5 ? '#ef4444' : parseInt(k) === 4 ? '#f59e0b' : '#06b6d4',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}>
                          {n} kỳ trùng {k} số
                        </span>
                      ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                    {generated.matchHistory.slice(0, 30).map((m, idx) => {
                      const matchedSet = new Set(m.matched);
                      return (
                        <div key={idx} style={{
                          background: 'var(--surface-strong)',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          borderLeft: m.matchCount >= 5 ? '3px solid #ef4444' : m.matchCount === 4 ? '3px solid #f59e0b' : '3px solid #06b6d4',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span>Kỳ <strong style={{ color: 'var(--text-main)' }}>#{m.draw_id}</strong> · {m.date}</span>
                            <span style={{ color: m.matchCount >= 5 ? '#ef4444' : m.matchCount === 4 ? '#f59e0b' : '#06b6d4', fontWeight: 700 }}>
                              Trùng {m.matchCount}/{m.balls.length}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {m.balls.map((b, i) => (
                              <span
                                key={i}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  background: matchedSet.has(b)
                                    ? 'linear-gradient(135deg, #10b981, #06b6d4)'
                                    : 'rgba(255,255,255,0.08)',
                                  color: matchedSet.has(b) ? 'white' : 'var(--text-muted)',
                                  border: matchedSet.has(b) ? 'none' : '1px solid var(--surface-border)',
                                }}
                              >
                                {b}
                              </span>
                            ))}
                            {m.special_ball && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: '28px', height: '28px', borderRadius: '50%',
                                fontSize: '0.72rem', fontWeight: 700,
                                background: 'linear-gradient(135deg, #eab308, #f59e0b)', color: 'white',
                              }}>{m.special_ball}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {generated.matchHistory.length > 30 && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', marginBottom: 0, textAlign: 'center' }}>
                      Còn {generated.matchHistory.length - 30} kỳ nữa.
                    </p>
                  )}
                </>
              )}
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '10px', marginBottom: 0, fontStyle: 'italic' }}>
                Bảng này KHÔNG dự đoán tương lai — chỉ cho bạn thấy bộ vừa tạo có lịch sử trùng lặp thế nào.
              </p>
            </div>
          )}

          <div className="glass-panel section-spacing">
            <div className="panel-header">
              <BarChart3 size={20} color="var(--primary)" />
              <h2 className="panel-title">Bảng xếp hạng các chiến lược</h2>
              <span className="panel-subtitle">
                Đã test trên {data.testWindow} kỳ quay, train từ {data.trainSize} kỳ trước đó
              </span>
            </div>

            <div style={{
              background: 'rgba(168, 85, 247, 0.08)',
              borderLeft: '3px solid #a855f7',
              padding: '12px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              lineHeight: 1.6,
            }}>
              <strong style={{ color: 'var(--text-main)' }}>💡 Cách đọc bảng này:</strong>
              <br />
              • <strong>TB trúng</strong>: trung bình mỗi kỳ thuật toán đoán được bao nhiêu số (max = {data.winner?.testedDraws ? '6' : '6'})
              <br />
              • <strong>vs ngẫu nhiên</strong>: hơn/kém so với chọn 6 số bất kỳ. Số kỳ vọng ngẫu nhiên = {data.winner?.expectedRandom || '~0.8'}
              <br />
              • <strong>3+/{data.testWindow}</strong>: trong {data.testWindow} kỳ test, có bao nhiêu lần thuật toán trúng ≥ 3 số
              <br />
              <span style={{ color: '#f59e0b' }}>
                ⚠️ Mọi chênh lệch dưới ±15% đều nằm trong sai số thống kê — không có ý nghĩa thực tế.
              </span>
            </div>

            <div className="strategy-leaderboard">
              {data.results.map((s, idx) => (
                <div key={s.id} className={`strategy-row${idx === 0 ? ' strategy-row-winner' : ''}`}>
                  <div className="strategy-rank">#{idx + 1}</div>
                  <div className="strategy-info">
                    <div className="strategy-name">{s.emoji} {s.name}</div>
                    <div className="strategy-desc">{s.desc}</div>
                  </div>
                  <div className="strategy-metrics">
                    <div className="strategy-metric">
                      <span className="strategy-metric-value">{s.avgMatch}</span>
                      <span className="strategy-metric-label">TB trúng</span>
                    </div>
                    <div className="strategy-metric">
                      <span className="strategy-metric-value" style={{ color: s.liftOverRandom > 0 ? '#10b981' : s.liftOverRandom < 0 ? '#ef4444' : 'var(--text-muted)' }}>
                        {s.liftOverRandom > 0 ? '+' : ''}{s.liftOverRandom}%
                      </span>
                      <span className="strategy-metric-label">vs ngẫu nhiên</span>
                    </div>
                    <div className="strategy-metric">
                      <span className="strategy-metric-value">{s.match3Rate}%</span>
                      <span className="strategy-metric-label">3+/{data.testWindow}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel section-spacing science-note">
            <h3 className="science-note-title">📖 Đọc thêm</h3>
            <p>
              <strong>Trúng trung bình / kỳ:</strong> Trong {data.testWindow} kỳ thử, mỗi lần thuật toán đoán ra 6 số,
              trung bình bao nhiêu số trùng với kết quả thật. Càng cao càng tốt. Số kỳ vọng ngẫu nhiên là {data.winner.expectedRandom}.
            </p>
            <p>
              <strong>So với ngẫu nhiên:</strong> Phần trăm vượt trội so với việc chọn 6 số bất kỳ. Dương = tốt hơn ngẫu nhiên.
            </p>
            <p>
              <strong>Lưu ý:</strong> Xổ số bản chất là ngẫu nhiên. Sự khác biệt giữa các chiến lược thường nằm trong sai số thống kê.
              Đây là công cụ tham khảo, không phải đảm bảo trúng.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
