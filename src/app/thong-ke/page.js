import { getStats, getDecadeDistribution, getSumDistribution, getTrendData, getEvenOddDistribution } from '@/lib/db';
import { getGameNames } from '@/lib/games';
import { BarChart2 } from 'lucide-react';
import DashboardCharts from '@/components/DashboardCharts';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Thống Kê Trực Quan - Vietlott Analytics Pro',
  description: 'Biểu đồ phân tích tần suất, xu hướng và phân bố xổ số Vietlott',
};

export default async function ThongKePage({ searchParams }) {
  const resolvedParams = await searchParams;
  const game = resolvedParams.game || '645';
  const gameNames = getGameNames();

  const stats = getStats(game);
  const decadeDist = getDecadeDistribution(game);
  const sumDist = getSumDistribution(game);
  const trendData = getTrendData(game, 50);
  const evenOddDist = getEvenOddDistribution(game);

  // Prepare frequency data sorted by number
  const freqData = stats
    .map(s => ({ number: s.number, count: s.count, gap: s.gap, weightedScore: s.weightedScore }))
    .sort((a, b) => parseInt(a.number) - parseInt(b.number));

  // Gap analysis sorted by gap descending
  const gapData = [...stats]
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 20)
    .map(s => ({ number: s.number, gap: s.gap, count: s.count }));

  // Decade data for radar
  const decadeData = decadeDist ? Object.entries(decadeDist.overall).map(([label, data]) => ({
    decade: label,
    overall: data.pctTotal,
    recent: decadeDist.recent?.[label]?.avgPerDraw ? Math.round((decadeDist.recent[label].avgPerDraw / (freqData.length > 45 ? 6 : 6)) * 1000) / 10 : 0,
  })) : [];

  return (
    <div>
      <div className="page-header">
        <div className="page-badge page-badge--info">
          <BarChart2 size={16} />
          <span>PHÂN TÍCH CHUYÊN SÂU</span>
        </div>
        <h1 className="page-title">Thống Kê Trực Quan</h1>
        <p className="page-subtitle">
          Biểu đồ phân tích tần suất, xu hướng và phân bố xổ số — giúp bạn hiểu rõ hơn các con số
        </p>

        <div className="game-picker mt-lg">
          {['645', '655', 'max3dpro'].map(g => (
            <a key={g} href={`/thong-ke?game=${g}`} className={`btn-game${game === g ? ' active' : ''}`}>
              {gameNames[g]}
            </a>
          ))}
        </div>
      </div>

      {game === 'max3dpro' ? (
        <div className="glass-panel text-center mx-auto-sm">
          <p className="text-muted">
            Biểu đồ thống kê chưa hỗ trợ Max 3D Pro.<br />
            Vui lòng chọn Mega 6/45 hoặc Power 6/55.
          </p>
        </div>
      ) : (
        <DashboardCharts
          freqData={freqData}
          gapData={gapData}
          sumDist={sumDist}
          trendData={trendData}
          evenOddDist={evenOddDist}
          decadeData={decadeData}
          gameName={gameNames[game]}
          totalDraws={stats.length > 0 ? stats[0].count + stats[0].gap : 0}
        />
      )}
    </div>
  );
}
