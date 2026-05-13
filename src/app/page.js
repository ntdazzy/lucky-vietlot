import { getStats, getLatestDraws } from '@/lib/db';
import { getGameNames } from '@/lib/games';
import { Trophy, TrendingUp, Activity, BarChart2 } from 'lucide-react';
import FreqChart from '@/components/Chart';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }) {
  const resolvedParams = await searchParams;
  const game = resolvedParams.game || '645';
  
  const stats = getStats(game);
  const top10 = stats.slice(0, 10);
  const bottom10 = [...stats].reverse().slice(0, 5);
  const latestDraws = getLatestDraws(game, 5);

  const gameNames = getGameNames();

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title title-gradient">Vietlott Analytics Pro</h1>
        <p className="page-subtitle">
          Khám phá các con số may mắn hôm nay
        </p>

        <div className="game-picker">
          {['645', '655', '535', 'max3dpro'].map(g => (
            <a key={g} href={`/?game=${g}`} className={`btn-game${game === g ? ' active' : ''}`}>{gameNames[g]}</a>
          ))}
        </div>
      </div>

      {game !== 'max3dpro' && (
        <div className="stat-grid" style={{ marginBottom: '40px' }}>
          <div className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Trophy color="var(--primary)" size={28} />
              <h2 className="stat-card__label">Con số đang hot</h2>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Xuất hiện nhiều nhất gần đây</p>
            <div className="ball-group">
              {top10.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="ball" style={idx < 3 ? { background: 'linear-gradient(135deg, var(--primary), #ff7b9c)', color: 'var(--text-main)', border: 'none', boxShadow: 'var(--glow-primary)' } : {}}>
                    {item.number}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{item.count} lần</span>
                </div>
              ))}
            </div>
          </div>

          <div className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Activity color="var(--secondary)" size={28} />
              <h2 className="stat-card__label">Con số 'ngủ đông'</h2>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Lâu lắm rồi chưa thấy tăm hơi</p>
            <div className="ball-group">
              {bottom10.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="ball" style={{ opacity: 0.7, background: '#1e293b', color: '#94a3b8', borderColor: '#334155' }}>
                    {item.number}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{item.count} lần</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {game !== 'max3dpro' && stats.length > 0 && (
        <div className="glass-panel" style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BarChart2 color="var(--primary)" size={28} />
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Biểu đồ tần suất</h2>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px' }}>Xem toàn bộ các con số đã ra bao nhiêu lần</p>
          <FreqChart data={stats} />
        </div>
      )}

      <div className="glass-panel table-responsive">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <TrendingUp color="#10b981" size={28} />
          <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Kết Quả Mới Nhất</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Ngày Quay</th>
              <th>Kỳ Quay</th>
              {game !== 'max3dpro' ? <th>Kết Quả (Bộ Số)</th> : <th>Đặc Biệt</th>}
              {game === '655' && <th>Đặc Biệt</th>}
              {game === 'max3dpro' && <th>Giải Nhất</th>}
            </tr>
          </thead>
          <tbody>
            {latestDraws.map(draw => {
              let balls = [];
              if (game !== 'max3dpro' && draw.balls) balls = draw.balls.split(',');
              
              return (
                <tr key={draw.id}>
                  <td style={{ fontWeight: 600 }}>{draw.date}</td>
                  <td style={{ color: 'var(--text-muted)' }}>#{draw.draw_id}</td>
                  
                  {game !== 'max3dpro' ? (
                    <td>
                      {balls.map((b, i) => (
                        <span key={i} className="ball" style={{ width: '36px', height: '36px', fontSize: '0.9rem' }}>
                          {b.trim()}
                        </span>
                      ))}
                    </td>
                  ) : (
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{draw.dac_biet}</td>
                  )}
                  
                  {game === '655' && (
                    <td>
                      <span className="ball special" style={{ width: '36px', height: '36px', fontSize: '0.9rem' }}>
                        {draw.special_ball}
                      </span>
                    </td>
                  )}
                  
                  {game === 'max3dpro' && (
                    <td>{draw.nhat}</td>
                  )}
                </tr>
              )
            })}
            {latestDraws.length === 0 && (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', padding: '40px' }}>Chưa có dữ liệu</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
