'use client';
import { useState, useEffect, useCallback } from 'react';
import { generatePrediction, generateSharpPrediction, fetchHistory, clearHistory as clearHistoryAction } from './actions';
import { getGameNames } from '@/lib/games';
import { Sparkles, Target, Layers, BarChart3, RefreshCcw, History, Trash2, Clock, Zap, Database, FlaskConical, AlertTriangle, Shield, Crosshair } from 'lucide-react';

const GAME_NAMES = getGameNames();
const GAME_KEYS = ['645', '655', '535', 'max3dpro'];
const UNSUPPORTED_GAMES = new Set(['max3dpro']);

function gameConfigBallCount(game) {
  return game === '535' ? 5 : 6;
}

function comboCount(n, k) {
  if (k > n || k < 0) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
  return Math.round(r);
}

export default function PredictionPage() {
  const [game, setGame] = useState('645');
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [useAllDraws, setUseAllDraws] = useState(false);
  const [bao, setBao] = useState('standard');
  // Sharp v5 mode — anti-popularity + coverage optimization
  const [sharpMode, setSharpMode] = useState(true);

  const loadHistory = useCallback(async () => {
    const h = await fetchHistory(game);
    setHistory(h);
  }, [game]);

  const generate = useCallback(async () => {
    setLoading(true);
    const result = sharpMode
      ? await generateSharpPrediction(game, { bao })
      : await generatePrediction(game, useAllDraws, bao);
    setPrediction(result);
    if (result) await loadHistory();
    setLoading(false);
  }, [game, loadHistory, useAllDraws, bao, sharpMode]);

  useEffect(() => {
    loadHistory();
    generate();
  }, [generate, loadHistory]);

  const handleClearHistory = async () => {
    await clearHistoryAction(game);
    setHistory([]);
  };

  return (
    <div>
      {/* HEADER */}
      <div className="page-header">
        <div className="page-badge page-badge--warning">
          <Target size={16} />
          <span>TÌM SỐ ĐẸP HÔM NAY</span>
        </div>
        <h1 className="page-title">Gợi Ý Số May Mắn</h1>
        <p className="page-subtitle">
          Công cụ dự đoán vui vẻ giúp bạn chọn ra những con số có khả năng trúng cao
        </p>

        <div className="game-picker--grid mt-lg">
          {GAME_KEYS.map(g => (
            <button
              key={g}
              onClick={() => setGame(g)}
              className={`btn-game${game === g ? ' active' : ''}`}
            >
              {GAME_NAMES[g]}
            </button>
          ))}
        </div>
      </div>

      {UNSUPPORTED_GAMES.has(game) ? (
        <div className="glass-panel text-center mx-auto-sm">
          <p className="text-muted">
            Công cụ tìm số chưa hỗ trợ {GAME_NAMES[game]}.<br />
            Bạn vui lòng thử lại với Mega hoặc Power nhé.
          </p>
        </div>
      ) : (
        <div className="prediction-content">

          {/* CÁCH CHỌN SỐ */}
          <div className="glass-panel" style={{ borderLeft: '3px solid #a855f7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Crosshair size={18} color="#a855f7" />
              <strong style={{ fontSize: '0.95rem' }}>Cách chọn số</strong>
            </div>
            <div className="data-source-toggle">
              <button
                onClick={() => setSharpMode(true)}
                className={`data-source-btn${sharpMode ? ' active' : ''}`}
              >
                <Shield size={16} />
                <span>Bộ Số Ít Đụng Hàng</span>
              </button>
              <button
                onClick={() => setSharpMode(false)}
                className={`data-source-btn${!sharpMode ? ' active' : ''}`}
              >
                <Zap size={16} />
                <span>Theo Lịch Sử</span>
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px', lineHeight: 1.6 }}>
              {sharpMode
                ? '🛡️ Chọn bộ số mà ÍT người chơi đặt (tránh sinh nhật, số "may mắn", dãy liên tiếp). Nếu trúng, bạn không phải chia jackpot với nhiều người.'
                : '⚡ Tham khảo các số hay ra trong lịch sử (số nóng, số lạnh, cặp số đi cùng nhau).'}
            </p>
            {sharpMode && (
              <div style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(16,185,129,0.08)', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                💡 <strong style={{ color: '#10b981' }}>Lưu ý quan trọng:</strong> Mọi bộ số đều có cơ hội trúng <strong>như nhau</strong> (1 / 8 triệu cho Mega). Cách này KHÔNG khó trúng hơn — chỉ khác là nếu trúng thì giải lớn hơn vì ít người chia.
              </div>
            )}
          </div>

          {/* CHẾ ĐỘ CHƠI (Bao) — hiện ở cả 2 mode */}
          <div className="glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Layers size={18} color="#3b82f6" />
              <strong style={{ fontSize: '0.95rem' }}>Chế độ chơi</strong>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <div className="custom-select-wrapper">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Loại vé:</span>
                <select
                  value={bao}
                  onChange={(e) => setBao(e.target.value)}
                  className="custom-select"
                >
                  <option value="standard">Vé thường ({gameConfigBallCount(game)} số)</option>
                  {(game === '645' || game === '655') && !sharpMode && (
                    <option value="5">Bao 5 (chọn 5 số, hệ thống ghép số 6)</option>
                  )}
                  {(game === '645' || game === '655') && (
                    <>
                      {[7, 8, 9, 10, 11, 12, 13, 14, 15, 18].map(b => (
                        <option key={b} value={b}>Bao {b} (chọn {b} số, sinh {comboCount(b, 6)} vé)</option>
                      ))}
                    </>
                  )}
                  {game === '535' && (
                    <>
                      {[6, 7, 8, 9, 10].map(b => (
                        <option key={b} value={b}>Bao {b} (chọn {b} số, sinh {comboCount(b, 5)} vé)</option>
                      ))}
                    </>
                  )}
                </select>
              </div>
            </div>
            {bao !== 'standard' && bao !== '5' && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '10px', lineHeight: 1.5 }}>
                💰 Bao {bao}: chi phí <strong style={{ color: 'var(--primary)' }}>{(comboCount(parseInt(bao), game === '535' ? 5 : 6) * 10000).toLocaleString('vi-VN')}đ</strong>. Nếu trúng đủ 6/6 trong số bạn chọn, bạn sẽ trúng nhiều giải cùng lúc.
              </p>
            )}
          </div>

          {/* DATA SOURCE — chỉ hiện ở mode "Theo Lịch Sử" */}
          {!sharpMode && (
          <div className="glass-panel data-source-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Database size={18} color="#06b6d4" />
              <strong style={{ fontSize: '0.95rem' }}>Phạm vi dữ liệu</strong>
            </div>
            <div className="data-source-toggle">
              <button
                onClick={() => setUseAllDraws(false)}
                className={`data-source-btn${!useAllDraws ? ' active' : ''}`}
              >
                <Clock size={16} />
                <span>200 kỳ gần đây</span>
              </button>
              <button
                onClick={() => setUseAllDraws(true)}
                className={`data-source-btn${useAllDraws ? ' active' : ''}`}
              >
                <Database size={16} />
                <span>Toàn bộ lịch sử</span>
              </button>
            </div>
            {prediction && !sharpMode && prediction.drawsAnalyzed && (
              <div className="data-source-info" style={{ marginTop: '10px' }}>
                <Zap size={14} />
                <span>
                  Đã phân tích <strong>{prediction.drawsAnalyzed}</strong> kỳ quay,
                  tìm được {prediction.candidatesFound} bộ số khả thi.
                </span>
              </div>
            )}
          </div>
          )}

          {/* SỰ THẬT VỀ VÉ SỐ */}
          {prediction?.realityCheck?.ev && (
            <div className="glass-panel" style={{ borderLeft: '3px solid #ef4444', background: 'rgba(239, 68, 68, 0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <AlertTriangle size={18} color="#ef4444" />
                <strong style={{ fontSize: '0.95rem' }}>Sự thật bạn cần biết</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                <div className="stat-card">
                  <div className="stat-card__label">Cơ hội trúng giải lớn</div>
                  <div className="stat-card__value" style={{ color: '#ef4444', fontSize: '0.95rem' }}>
                    {prediction.realityCheck.jackpotOdds || '—'}
                  </div>
                  <div className="stat-card__sub">cho mỗi vé</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card__label">Trung bình mỗi vé</div>
                  <div className="stat-card__value" style={{ color: '#ef4444', fontSize: '0.95rem' }}>
                    mất {Math.round(prediction.realityCheck.ev.expectedLossPerTicket).toLocaleString('vi-VN')}đ
                  </div>
                  <div className="stat-card__sub">tính theo xác suất</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card__label">Mỗi 10.000đ</div>
                  <div className="stat-card__value" style={{ color: '#f59e0b', fontSize: '0.95rem' }}>
                    đáng giá {Math.round(prediction.realityCheck.ev.expectedReturn).toLocaleString('vi-VN')}đ
                  </div>
                  <div className="stat-card__sub">trung bình</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card__label">Phần Vietlott giữ</div>
                  <div className="stat-card__value" style={{ color: '#ef4444', fontSize: '0.95rem' }}>
                    {Math.round(prediction.realityCheck.ev.houseEdge * 100)}%
                  </div>
                  <div className="stat-card__sub">trên mỗi vé bán ra</div>
                </div>
              </div>
              {prediction.realityCheck.verdict?.verdict && (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                  💡 {prediction.realityCheck.verdict.verdict}
                </p>
              )}
            </div>
          )}

          {/* BAO INFO PANEL — khi user chọn Bao */}
          {prediction?.baoSize && (
            <div className="glass-panel" style={{ borderLeft: '3px solid #3b82f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Layers size={18} color="#3b82f6" />
                <strong style={{ fontSize: '0.95rem' }}>Thông tin vé Bao {prediction.baoSize}</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                <div className="stat-card">
                  <div className="stat-card__label">Số bạn chọn</div>
                  <div className="stat-card__value" style={{ color: '#3b82f6' }}>{prediction.baoSize}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card__label">Số vé tạo ra</div>
                  <div className="stat-card__value" style={{ color: '#3b82f6' }}>{prediction.ticketsGenerated}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card__label">Chi phí</div>
                  <div className="stat-card__value" style={{ color: 'var(--primary)' }}>
                    {prediction.totalCost.toLocaleString('vi-VN')}đ
                  </div>
                </div>
                {prediction.realityCheck?.baoMath && (
                  <div className="stat-card">
                    <div className="stat-card__label">Cơ hội trúng JP</div>
                    <div className="stat-card__value" style={{ color: '#ef4444', fontSize: '0.85rem' }}>
                      1 / {prediction.realityCheck.baoMath.oddsAgainst.toLocaleString('vi-VN')}
                    </div>
                  </div>
                )}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '12px', marginBottom: 0, lineHeight: 1.5 }}>
                💡 Bao {prediction.baoSize} nghĩa là bạn chọn {prediction.baoSize} số, hệ thống sẽ tự ghép thành {prediction.ticketsGenerated} vé khác nhau (mỗi tổ hợp {gameConfigBallCount(game)} số). Nếu kết quả quay có đủ {gameConfigBallCount(game)} số nằm trong bộ {prediction.baoSize} số của bạn → bạn trúng giải lớn + nhiều giải phụ cùng lúc.
              </p>
            </div>
          )}

          {/* PHÂN TÍCH KHOA HỌC — Profile fit, anti-share, evidence */}
          {prediction?.scientific && (
            <div className="glass-panel" style={{ borderLeft: '3px solid #10b981' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Shield size={18} color="#10b981" />
                <strong style={{ fontSize: '0.95rem' }}>Phân tích khoa học (dựa trên {prediction.scientific.profile?.basedOnDraws?.toLocaleString('vi-VN') || prediction.scientific.matchSummary?.totalMatching || '?'} kỳ quá khứ)</strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                {prediction.scientific.antiShare && (
                  <div className="stat-card">
                    <div className="stat-card__label">Mức độ đụng hàng</div>
                    <div className="stat-card__value" style={{ color: prediction.scientific.antiShare.avgPopularity < 1 ? '#10b981' : '#f59e0b' }}>
                      {prediction.scientific.antiShare.avgPopularity < 0.95 ? 'Thấp' : prediction.scientific.antiShare.avgPopularity > 1.1 ? 'Cao' : 'TB'}
                    </div>
                    <div className="stat-card__sub">điểm: {prediction.scientific.antiShare.avgPopularity}</div>
                  </div>
                )}
                {prediction.scientific.typicality && (
                  <div className="stat-card">
                    <div className="stat-card__label">Khớp mẫu quá khứ</div>
                    <div className="stat-card__value" style={{ color: prediction.scientific.typicality.avgZ < 1.5 ? '#10b981' : '#f59e0b' }}>
                      {prediction.scientific.typicality.avgZ < 1 ? 'Rất khớp' : prediction.scientific.typicality.avgZ < 2 ? 'Khớp' : 'Khác lạ'}
                    </div>
                    <div className="stat-card__sub">độ lệch: {prediction.scientific.typicality.avgZ}σ</div>
                  </div>
                )}
                {prediction.breakdown?.lowCount != null && (
                  <div className="stat-card">
                    <div className="stat-card__label">Số nhỏ (≤ 31)</div>
                    <div className="stat-card__value" style={{ color: prediction.breakdown.lowCount <= 3 ? '#10b981' : '#f59e0b' }}>
                      {prediction.breakdown.lowCount}/{prediction.main.length}
                    </div>
                    <div className="stat-card__sub">tránh sinh nhật</div>
                  </div>
                )}
                {prediction.scientific.matchSummary && (
                  <div className="stat-card">
                    <div className="stat-card__label">Trùng &ge;3 số quá khứ</div>
                    <div className="stat-card__value" style={{ color: prediction.scientific.matchSummary.totalMatching < 10 ? '#10b981' : '#f59e0b' }}>
                      {prediction.scientific.matchSummary.totalMatching} kỳ
                    </div>
                    <div className="stat-card__sub">{prediction.scientific.matchSummary.pctOfHistory}% lịch sử</div>
                  </div>
                )}
              </div>

              {prediction.scientific.antiShare?.verdict && (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px', lineHeight: 1.5 }}>
                  💡 {prediction.scientific.antiShare.verdict}
                </p>
              )}
              {prediction.scientific.typicality?.verdict && (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  📊 {prediction.scientific.typicality.verdict}
                </p>
              )}
            </div>
          )}

          {/* MATCH HISTORY — Các kỳ quá khứ có ≥3 số trùng */}
          {prediction?.scientific?.matchHistory && (
            <div className="glass-panel" style={{ borderLeft: '3px solid #06b6d4' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <History size={18} color="#06b6d4" />
                <strong style={{ fontSize: '0.95rem' }}>Các kỳ quá khứ trùng &ge; 3 số</strong>
              </div>
              {prediction.scientific.matchHistory.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#10b981', margin: 0 }}>
                  ✨ Không có kỳ nào trong lịch sử trùng &ge; 3 số với bộ này — đây là bộ số "mới hoàn toàn".
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {Object.entries(prediction.scientific.matchSummary?.byCount || {})
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                    {prediction.scientific.matchHistory.slice(0, 30).map((m, idx) => {
                      const matchedSet = new Set(m.matched);
                      return (
                        <div key={idx} style={{
                          background: 'var(--surface-strong)',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          borderLeft: m.matchCount >= 5 ? '3px solid #ef4444' : m.matchCount === 4 ? '3px solid #f59e0b' : '3px solid #06b6d4',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span>Kỳ <strong style={{ color: 'var(--text-main)' }}>#{m.draw_id}</strong> &middot; {m.date}</span>
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
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #eab308, #f59e0b)',
                                color: 'white',
                              }}>{m.special_ball}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {prediction.scientific.matchHistory.length > 30 && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', marginBottom: 0, textAlign: 'center' }}>
                      Còn {prediction.scientific.matchHistory.length - 30} kỳ nữa, đang ẩn để tiết kiệm không gian.
                    </p>
                  )}
                </>
              )}
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '10px', marginBottom: 0, fontStyle: 'italic' }}>
                Bảng này KHÔNG dự đoán tương lai — chỉ cho bạn thấy lịch sử trùng lặp của bộ số được tạo.
              </p>
            </div>
          )}

          {/* MAIN PREDICTION */}
          <div className="glass-panel glass-panel--relative text-center">
            <h2 className="section-header section-header--center">
              <Sparkles color="#eab308" /> Bộ Số May Mắn Dành Cho Bạn
            </h2>

            {loading ? (
              <div className="loading-center">
                <div className="spinner" />
                <div className="loading-center__text">Đang phân tích dữ liệu...</div>
              </div>
            ) : prediction ? (
              <>
                <div className="ball-group ball-group--center">
                  {prediction.main.map((num, i) => (
                    <div key={i} className="ball special ball--lg">{num}</div>
                  ))}
                  {prediction.special && (
                    <div className="ball gold ball--lg">{prediction.special}</div>
                  )}
                </div>

                {/* BREAKDOWN — bỏ qua field rỗng (Bao mode không có sum/spread) */}
                {prediction.breakdown && (
                  <div className="breakdown-grid mb-md">
                    {[
                      { label: 'Tổng', value: prediction.breakdown.sum, sub: prediction.sumRange ? `${prediction.sumRange[0]}–${prediction.sumRange[1]}` : null, color: '#3b82f6' },
                      { label: 'Chẵn/Lẻ', value: prediction.breakdown.evens != null ? `${prediction.breakdown.evens}/${prediction.breakdown.odds}` : null, color: '#10b981' },
                      { label: 'Độ rộng', value: prediction.breakdown.spread, color: '#f59e0b' },
                      { label: 'Vùng số', value: prediction.breakdown.decadeCount, color: '#a855f7' },
                      { label: 'Lượt thử', value: prediction.attempts, color: '#ef4444' },
                    ].filter(item => item.value !== undefined && item.value !== null && item.value !== '').map((item, idx) => (
                      <div key={idx} className="stat-card">
                        <div className="stat-card__label">{item.label}</div>
                        <div className="stat-card__value" style={{ color: item.color }}>{item.value}</div>
                        {item.sub && <div className="stat-card__sub">{item.sub}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* REGENERATE */}
                <button onClick={generate} className="btn-primary btn-generate">
                  <RefreshCcw size={20} /> TẠO BỘ SỐ MỚI
                </button>
              </>
            ) : null}
          </div>

          {/* ENSEMBLE STRATEGY RESULTS */}
          {prediction?.strategyResults?.length > 0 && (
            <div className="glass-panel">
              <h3 className="section-header">
                <Zap size={18} color="#eab308" /> Kết quả Ensemble (3 chiến lược)
              </h3>
              <div className="strategy-leaderboard">
                {prediction.strategyResults.map((s, idx) => (
                  <div key={idx} className={`strategy-row${idx === 0 ? ' strategy-row-winner' : ''}`}>
                    <span className="strategy-rank">#{idx + 1}</span>
                    <div className="strategy-info">
                      <div className="strategy-name">{s.name}</div>
                      <div className="strategy-desc">{s.desc}</div>
                    </div>
                    <div className="strategy-metrics">
                      <div className="strategy-metric">
                        <span className="strategy-metric-value" style={{ color: '#3b82f6' }}>{s.candidates}</span>
                        <span className="strategy-metric-label">Ứng viên</span>
                      </div>
                      <div className="strategy-metric">
                        <span className="strategy-metric-value" style={{ color: '#10b981' }}>{Math.round(s.bestScore)}</span>
                        <span className="strategy-metric-label">Điểm cao</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BACKTEST RESULTS */}
          {prediction?.backtestResult && (
            <div className="glass-panel">
              <h3 className="section-header">
                <FlaskConical size={18} color="#a855f7" /> Backtest — Kiểm chứng thực tế
              </h3>
              <p className="text-muted text-sm mb-sm">
                Đã thử chiến lược trên {prediction.backtestResult.tested} kỳ quay gần nhất
              </p>
              <div className="backtest-grid">
                <div className="backtest-card">
                  <div className="backtest-value" style={{ color: '#3b82f6' }}>
                    {prediction.backtestResult.avgMatch}
                  </div>
                  <div className="backtest-label">TB số trúng / kỳ</div>
                </div>
                {prediction.backtestResult.match3Rate !== undefined && (
                  <div className="backtest-card">
                    <div className="backtest-value" style={{ color: '#10b981' }}>
                      {prediction.backtestResult.match3Rate}%
                    </div>
                    <div className="backtest-label">Tỷ lệ ≥3 số</div>
                  </div>
                )}
                {prediction.backtestResult.match4Rate !== undefined && (
                  <div className="backtest-card">
                    <div className="backtest-value" style={{ color: '#f59e0b' }}>
                      {prediction.backtestResult.match4Rate}%
                    </div>
                    <div className="backtest-label">Tỷ lệ ≥4 số</div>
                  </div>
                )}
                {prediction.backtestResult.match5Rate !== undefined && (
                  <div className="backtest-card">
                    <div className="backtest-value" style={{ color: '#ef4444' }}>
                      {prediction.backtestResult.match5Rate}%
                    </div>
                    <div className="backtest-label">Tỷ lệ ≥5 số</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TOP SCORED */}
          {prediction?.topScored?.length > 0 && (
            <div className="glass-panel">
              <h3 className="section-header">
                <BarChart3 size={18} color="#3b82f6" /> 10 Số Nổi Bật Nhất
              </h3>
              <p className="top-scored-desc">
                Tổng hợp từ nhiều yếu tố phân tích. Mỗi lần tạo, điểm thay đổi do yếu tố may mắn.
              </p>
              <div className="top-scored-list">
                {prediction.topScored.map((item, idx) => (
                  <div key={idx} className="top-scored-item">
                    <span className={`ball no-margin${idx < 3 ? ' special' : ''}`}>
                      {item.number}
                    </span>
                    <span
                      className="top-scored-item__score"
                      style={{ color: idx < 3 ? 'var(--primary)' : '#3b82f6' }}
                    >
                      {item.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HISTORY */}
          <div className="glass-panel">
            <div className="flex-between">
              <h3 className="section-header m-0">
                <History size={18} color="#06b6d4" /> Lịch Sử ({history.length})
              </h3>
              <div className="btn-group">
                {history.length > 0 && (
                  <button onClick={handleClearHistory} className="btn-danger">
                    <Trash2 size={14} /> Xoá hết
                  </button>
                )}
                <button onClick={() => setShowHistory(!showHistory)} className="btn-ghost">
                  {showHistory ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
            </div>

            {showHistory && (
              history.length > 0 ? (
                <div className="history-list">
                  {history.map((item, idx) => (
                    <div key={item.id} className="history-item">
                      <div className="history-item__balls">
                        <span className="history-item__index">#{history.length - idx}</span>
                        {item.main.map((num, i) => (
                          <span key={i} className="ball no-margin">{num}</span>
                        ))}
                        {item.special && (
                          <span className="ball gold no-margin">{item.special}</span>
                        )}
                      </div>
                      <div className="history-item__meta">
                        {item.breakdown && <span>Σ{item.breakdown.sum}</span>}
                        <span className="inline-icon">
                          <Clock size={11} /> {item.date}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">
                  Chưa có lịch sử. Nhấn &ldquo;Tạo bộ số mới&rdquo; để bắt đầu.
                </p>
              )
            )}

            {!showHistory && history.length > 0 && (
              <p className="history-summary">
                Bạn đã tạo {history.length} bộ số cho {GAME_NAMES[game]}. Nhấn &ldquo;Hiện&rdquo; để xem.
              </p>
            )}
          </div>

          {/* CÁCH HỆ THỐNG CHỌN SỐ */}
          <div className="glass-panel">
            <h3 className="section-header">
              <Layers size={18} color="var(--primary)" /> Cách hệ thống chọn số (dễ hiểu)
            </h3>
            <div className="algo-grid">
              {sharpMode ? [
                { color: '#10b981', title: 'Tránh số sinh nhật', desc: 'Hầu hết người chơi pick theo ngày sinh (1-31), nên hệ thống ưu tiên các số > 31 để bộ của bạn ít trùng với người khác.' },
                { color: '#a855f7', title: 'Tránh số "may mắn"', desc: 'Các số 7, 8, 9, 68, 86... được nhiều người tin là may. Hệ thống tránh nhồi quá nhiều số này.' },
                { color: '#ef4444', title: 'Tránh dãy liên tiếp', desc: 'Bộ như 01-02-03-04-05-06 nhiều người chọn vì "không ai chọn đâu" — nhưng thực ra rất phổ biến.' },
                { color: '#3b82f6', title: 'Rải đều khắp bảng số', desc: 'Không tụm vào 1 vùng (như 30-39). Trải đều giúp đa dạng vùng số.' },
                { color: '#f59e0b', title: 'Cân chẵn / lẻ', desc: 'Tránh bộ toàn chẵn hoặc toàn lẻ — kiểu bộ này nhiều người chọn vì trông "đặc biệt".' },
                { color: '#06b6d4', title: 'Không hứa trúng nhiều hơn', desc: 'Mọi bộ số đều có cơ hội trúng như nhau. Cách này chỉ giúp bạn không phải CHIA GIẢI với nhiều người nếu may mắn trúng.' },
              ].map((item, idx) => (
                <div key={idx} className="algo-card" style={{ borderLeftColor: item.color }}>
                  <div className="algo-card__title" style={{ color: item.color }}>{item.title}</div>
                  {item.desc}
                </div>
              )) : [
                { color: '#3b82f6', title: 'Số đang hay ra', desc: 'Ưu tiên chọn những số thường xuyên xuất hiện trong các kỳ gần đây.' },
                { color: '#10b981', title: 'Số đi chung một cặp', desc: 'Tìm các số hay rủ nhau ra cùng lúc trong các kỳ trước.' },
                { color: '#ef4444', title: 'Số ngủ đông', desc: 'Cố tình chọn số đã lâu không thấy để đón đầu.' },
                { color: '#a855f7', title: 'Dải số đồng đều', desc: 'Không chọn tụm lại một chỗ, rải đều các đầu số từ nhỏ đến lớn.' },
                { color: '#f59e0b', title: 'Phối hợp 3 chiến lược', desc: 'Chạy song song 3 cách: ưa số nóng, cân bằng, săn số lạnh — rồi chọn bộ tốt nhất.' },
                { color: '#06b6d4', title: 'Đối chiếu lịch sử', desc: 'Thử lại cách chọn này trên 100 kỳ gần nhất xem có thật sự hơn ngẫu nhiên không.' },
              ].map((item, idx) => (
                <div key={idx} className="algo-card" style={{ borderLeftColor: item.color }}>
                  <div className="algo-card__title" style={{ color: item.color }}>{item.title}</div>
                  {item.desc}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
