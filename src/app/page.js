import { getStats, getLatestDraws } from '@/lib/db';
import { getGameNames } from '@/lib/games';
import { Flame, Snowflake, TrendingUp, BarChart2 } from 'lucide-react';
import FreqChart from '@/components/Chart';
import GameChip from '@/components/GameChip';
import HomeAdminToggle from '@/components/HomeAdminToggle';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }) {
  const resolvedParams = await searchParams;
  const game = resolvedParams.game || '645';

  const stats = getStats(game);
  const hot = stats.slice(0, 6);
  const cold = [...stats].reverse().slice(0, 6);
  const latestDraws = getLatestDraws(game, 5);
  const gameNames = getGameNames();

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title title-gradient">Vietlott Analytics</h1>
        <p className="page-subtitle">Khám phá các con số may mắn hôm nay</p>

        <div className="game-picker">
          {['645', '655', '535', 'max3dpro'].map(g => (
            <a
              key={g}
              href={`/?game=${g}`}
              className={`game-pick-link${game === g ? ' is-active' : ''}`}
            >
              <GameChip game={g} size="md" variant={game === g ? 'solid' : 'soft'} />
            </a>
          ))}
        </div>

        {/* Admin tools — collapsed by default, expand for sync/update/DB */}
        <HomeAdminToggle />
      </div>

      {game !== 'max3dpro' && (
        <div className="hot-cold-grid">
          <div className="glass-panel hot-panel">
            <div className="panel-header">
              <Flame size={20} color="#ff2a5f" />
              <h2 className="panel-title">Số hay ra</h2>
              <span className="panel-subtitle">Top 6 xuất hiện nhiều nhất</span>
            </div>
            <div className="number-list">
              {hot.map((item, idx) => (
                <div key={item.number} className="number-row">
                  <span className="number-rank">#{idx + 1}</span>
                  <span className={`ball ${idx < 3 ? 'ball-hot' : ''}`}>{item.number}</span>
                  <div className="number-bar">
                    <div className="number-bar-fill hot" style={{ width: `${Math.min(100, (item.count / (hot[0]?.count || 1)) * 100)}%` }} />
                  </div>
                  <span className="number-count">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel cold-panel">
            <div className="panel-header">
              <Snowflake size={20} color="#06b6d4" />
              <h2 className="panel-title">Số lâu chưa ra</h2>
              <span className="panel-subtitle">Top 6 ít xuất hiện gần đây</span>
            </div>
            <div className="number-list">
              {cold.map((item, idx) => (
                <div key={item.number} className="number-row">
                  <span className="number-rank">#{idx + 1}</span>
                  <span className="ball ball-cold">{item.number}</span>
                  <div className="number-bar">
                    <div className="number-bar-fill cold" style={{ width: `${Math.min(100, (item.gap / 50) * 100)}%` }} />
                  </div>
                  <span className="number-count">{item.gap} kỳ</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {game !== 'max3dpro' && stats.length > 0 && (
        <div className="glass-panel section-spacing">
          <div className="panel-header">
            <BarChart2 size={20} color="var(--primary)" />
            <h2 className="panel-title">Biểu đồ tần suất</h2>
            <span className="panel-subtitle">Số lần xuất hiện của từng con số</span>
          </div>
          <FreqChart data={stats} />
        </div>
      )}

      <div className="glass-panel section-spacing">
        <div className="panel-header">
          <TrendingUp size={20} color="#10b981" />
          <h2 className="panel-title">Kết quả mới nhất</h2>
          <span className="panel-subtitle">{latestDraws.length} kỳ quay gần đây</span>
        </div>
        <div className="draws-list">
          {latestDraws.map(draw => {
            let balls = [];
            if (game !== 'max3dpro' && draw.balls) balls = draw.balls.split(',');
            return (
              <div key={draw.id} className="draw-row">
                <div className="draw-meta">
                  <span className="draw-date">{draw.date}</span>
                  <span className="draw-id">Kỳ #{draw.draw_id}</span>
                </div>
                {game !== 'max3dpro' ? (
                  <div className="draw-balls">
                    {balls.map((b, i) => (
                      <span key={i} className="ball">{b.trim()}</span>
                    ))}
                    {game === '655' && draw.special_ball && (
                      <span className="ball special">{draw.special_ball}</span>
                    )}
                  </div>
                ) : (
                  <div className="draw-balls">
                    <span className="draw-prize">{draw.dac_biet}</span>
                  </div>
                )}
              </div>
            );
          })}
          {latestDraws.length === 0 && (
            <div className="empty-state">Chưa có dữ liệu cho {gameNames[game]}</div>
          )}
        </div>
      </div>
    </div>
  );
}
