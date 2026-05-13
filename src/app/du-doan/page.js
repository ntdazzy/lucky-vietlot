'use client';
import { useState, useEffect, useCallback } from 'react';
import { generatePrediction, fetchHistory, clearHistory as clearHistoryAction } from './actions';
import { getGameNames } from '@/lib/games';
import { Sparkles, Target, Layers, BarChart3, RefreshCcw, History, Trash2, Clock, Zap, Database, FlaskConical } from 'lucide-react';

const GAME_NAMES = getGameNames();
const GAME_KEYS = ['645', '655', '535', 'max3dpro'];
const UNSUPPORTED_GAMES = new Set(['max3dpro']);

export default function PredictionPage() {
  const [game, setGame] = useState('645');
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [useAllDraws, setUseAllDraws] = useState(false);

  const loadHistory = useCallback(async () => {
    const h = await fetchHistory(game);
    setHistory(h);
  }, [game]);

  const generate = useCallback(async () => {
    setLoading(true);
    const result = await generatePrediction(game, useAllDraws);
    setPrediction(result);
    if (result) await loadHistory();
    setLoading(false);
  }, [game, loadHistory, useAllDraws]);

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

          {/* DATA SOURCE TOGGLE */}
          <div className="glass-panel data-source-panel">
            <div className="data-source-toggle">
              <button 
                onClick={() => setUseAllDraws(false)} 
                className={`data-source-btn${!useAllDraws ? ' active' : ''}`}
              >
                <Clock size={16} />
                <span>200 kỳ gần nhất</span>
              </button>
              <button 
                onClick={() => setUseAllDraws(true)} 
                className={`data-source-btn${useAllDraws ? ' active' : ''}`}
              >
                <Database size={16} />
                <span>Tất cả các kỳ</span>
              </button>
            </div>
            {prediction && (
              <div className="data-source-info">
                <Zap size={14} />
                <span>
                  Đang phân tích <strong>{prediction.drawsAnalyzed}</strong> kỳ quay | 
                  Ensemble: {prediction.candidatesFound} ứng viên từ {prediction.attempts} lượt thử
                </span>
              </div>
            )}
          </div>

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

                {/* BREAKDOWN */}
                {prediction.breakdown && (
                  <div className="breakdown-grid mb-md">
                    {[
                      { label: 'Tổng', value: prediction.breakdown.sum, sub: `${prediction.sumRange[0]}–${prediction.sumRange[1]}`, color: '#3b82f6' },
                      { label: 'Chẵn/Lẻ', value: `${prediction.breakdown.evens}/${prediction.breakdown.odds}`, color: '#10b981' },
                      { label: 'Độ rộng', value: prediction.breakdown.spread, color: '#f59e0b' },
                      { label: 'Vùng số', value: prediction.breakdown.decadeCount, color: '#a855f7' },
                      { label: 'Lượt thử', value: prediction.attempts, color: '#ef4444' },
                    ].map((item, idx) => (
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

          {/* ALGORITHM EXPLANATION */}
          <div className="glass-panel">
            <h3 className="section-header">
              <Layers size={18} color="var(--primary)" /> Cách Máy Tính Chọn Số (Dễ Hiểu)
            </h3>
            <div className="algo-grid">
              {[
                { color: '#3b82f6', title: 'Con số đang hot', desc: 'Ưu tiên chọn những số thường xuyên xuất hiện gần đây.' },
                { color: '#10b981', title: 'Đi chung một cặp', desc: 'Tìm các số hay rủ nhau ra cùng lúc trong các kỳ trước.' },
                { color: '#ef4444', title: 'Con số ngủ đông', desc: 'Cố tình chọn số đã lâu lắm không thấy để đón đầu.' },
                { color: '#a855f7', title: 'Dải số đồng đều', desc: 'Không chọn tụm lại một chỗ, rải đều các đầu số từ nhỏ đến lớn.' },
                { color: '#f59e0b', title: 'Ensemble AI', desc: 'Chạy 3 chiến lược (nóng, cân bằng, lạnh) rồi chọn bộ tốt nhất.' },
                { color: '#06b6d4', title: 'Kiểm chứng ngược', desc: 'Backtest trên 100 kỳ gần nhất để đánh giá hiệu quả thuật toán.' },
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
