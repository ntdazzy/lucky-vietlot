'use client';
import { useState, useEffect, useCallback } from 'react';
import { generatePrediction, fetchHistory, clearHistory as clearHistoryAction } from './actions';
import { getGameNames } from '@/lib/games';
import { Sparkles, Target, Layers, BarChart3, RefreshCcw, History, Trash2, Clock } from 'lucide-react';

const GAME_NAMES = getGameNames();
const GAME_KEYS = ['645', '655', '535', 'max3dpro'];
const UNSUPPORTED_GAMES = new Set(['max3dpro']);

export default function PredictionPage() {
  const [game, setGame] = useState('645');
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    const h = await fetchHistory(game);
    setHistory(h);
  }, [game]);

  const generate = useCallback(async () => {
    setLoading(true);
    const result = await generatePrediction(game);
    setPrediction(result);
    if (result) await loadHistory();
    setLoading(false);
  }, [game, loadHistory]);

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
                { color: '#f59e0b', title: 'Yếu tố tâm linh', desc: 'Thêm một chút xíu ngẫu nhiên may mắn.' },
                { color: '#06b6d4', title: 'Chốt số xịn nhất', desc: 'Tạo hàng trăm bộ và chọn ra bộ có điểm số phân tích cao nhất.' },
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
