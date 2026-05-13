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
  const gameNames = getGameNames();

  const runBacktest = () => {
    setData(null);
    setGenerated(null);
    startTransition(async () => {
      const res = await runFullBacktest(game, testWindow);
      setData(res);
    });
  };

  const generateFromWinner = async () => {
    if (!data?.winner) return;
    const res = await generateWithWinner(game, data.winner.id);
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

          <div className="glass-panel section-spacing">
            <div className="panel-header">
              <BarChart3 size={20} color="var(--primary)" />
              <h2 className="panel-title">Bảng xếp hạng các chiến lược</h2>
              <span className="panel-subtitle">
                Đã test trên {data.testWindow} kỳ quay, train từ {data.trainSize} kỳ trước đó
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
