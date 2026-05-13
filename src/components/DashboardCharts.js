'use client';

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, AreaChart, Area,
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Legend
} from 'recharts';
import { BarChart2, TrendingUp, PieChart as PieIcon, Activity, Target, AlertTriangle } from 'lucide-react';

const COLORS = ['#ff2a5f', '#00e5ff', '#eab308', '#10b981', '#a855f7', '#f97316', '#3b82f6', '#ef4444'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{label || payload[0]?.name}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color || p.fill, margin: 0, fontSize: '0.85rem' }}>
            {p.name || p.dataKey}: <strong>{p.value}</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardCharts({ freqData, gapData, sumDist, trendData, evenOddDist, decadeData, gameName, totalDraws }) {
  const [activeTab, setActiveTab] = useState('freq');

  const tabs = [
    { id: 'freq', label: 'Tần suất', icon: <BarChart2 size={16} /> },
    { id: 'trend', label: 'Xu hướng', icon: <TrendingUp size={16} /> },
    { id: 'evenodd', label: 'Chẵn/Lẻ', icon: <PieIcon size={16} /> },
    { id: 'sum', label: 'Tổng', icon: <Activity size={16} /> },
    { id: 'decade', label: 'Vùng số', icon: <Target size={16} /> },
    { id: 'gap', label: 'Gap', icon: <AlertTriangle size={16} /> },
  ];

  return (
    <div className="dashboard-container">
      {/* Tab navigation */}
      <div className="dashboard-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`dashboard-tab${activeTab === tab.id ? ' active' : ''}`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* FREQUENCY BAR CHART */}
      {activeTab === 'freq' && (
        <div className="glass-panel dashboard-chart-panel">
          <div className="panel-header">
            <BarChart2 size={20} color="var(--primary)" />
            <h2 className="panel-title">Tần suất xuất hiện - {gameName}</h2>
            <span className="panel-subtitle">Số lần xuất hiện của từng con số trong {totalDraws}+ kỳ</span>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={freqData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <XAxis dataKey="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="count" name="Số lần" radius={[3, 3, 0, 0]}>
                  {freqData.map((entry, idx) => {
                    const maxCount = Math.max(...freqData.map(d => d.count));
                    const ratio = entry.count / maxCount;
                    return (
                      <Cell 
                        key={idx} 
                        fill={ratio > 0.85 ? '#ff2a5f' : ratio > 0.7 ? '#f97316' : ratio > 0.5 ? '#eab308' : '#00e5ff'} 
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend-info">
            <span className="legend-dot" style={{background:'#ff2a5f'}}></span> Rất nóng
            <span className="legend-dot" style={{background:'#f97316'}}></span> Nóng
            <span className="legend-dot" style={{background:'#eab308'}}></span> Ấm
            <span className="legend-dot" style={{background:'#00e5ff'}}></span> Lạnh
          </div>
        </div>
      )}

      {/* TREND LINE CHART */}
      {activeTab === 'trend' && (
        <div className="glass-panel dashboard-chart-panel">
          <div className="panel-header">
            <TrendingUp size={20} color="#10b981" />
            <h2 className="panel-title">Xu hướng Tổng & Chẵn theo thời gian</h2>
            <span className="panel-subtitle">Trung bình tổng & tỷ lệ chẵn qua từng cửa sổ 50 kỳ</span>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={trendData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <XAxis dataKey="drawId" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.floor(trendData.length / 8)} />
                <YAxis yAxisId="left" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} domain={[30, 70]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="avgSum" name="TB Tổng" stroke="#ff2a5f" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="evenRatio" name="% Chẵn" stroke="#00e5ff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* EVEN/ODD PIE CHART */}
      {activeTab === 'evenodd' && (
        <div className="glass-panel dashboard-chart-panel">
          <div className="panel-header">
            <PieIcon size={20} color="#a855f7" />
            <h2 className="panel-title">Phân bố Chẵn / Lẻ</h2>
            <span className="panel-subtitle">Tỷ lệ các kiểu chẵn/lẻ trong lịch sử</span>
          </div>
          <div className="chart-wrapper chart-wrapper--center">
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={evenOddDist}
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  innerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, pct }) => `${name} (${pct}%)`}
                  labelLine={true}
                >
                  {evenOddDist.map((entry, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="evenodd-table">
            {evenOddDist.map((item, idx) => (
              <div key={idx} className="evenodd-row">
                <span className="evenodd-color" style={{ background: COLORS[idx % COLORS.length] }}></span>
                <span className="evenodd-name">{item.name}</span>
                <span className="evenodd-pct">{item.pct}%</span>
                <span className="evenodd-count">{item.value} kỳ</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUM DISTRIBUTION */}
      {activeTab === 'sum' && (
        <div className="glass-panel dashboard-chart-panel">
          <div className="panel-header">
            <Activity size={20} color="#3b82f6" />
            <h2 className="panel-title">Phân bố Tổng 6 bóng</h2>
            <span className="panel-subtitle">Histogram tổng giá trị của 6 bóng mỗi kỳ</span>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={sumDist} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <defs>
                  <linearGradient id="sumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="range" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="count" name="Số kỳ" stroke="#3b82f6" strokeWidth={2} fill="url(#sumGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* DECADE RADAR */}
      {activeTab === 'decade' && (
        <div className="glass-panel dashboard-chart-panel">
          <div className="panel-header">
            <Target size={20} color="#eab308" />
            <h2 className="panel-title">Phân bố theo Vùng Số</h2>
            <span className="panel-subtitle">So sánh tỷ lệ xuất hiện tổng thể vs 50 kỳ gần nhất</span>
          </div>
          <div className="chart-wrapper chart-wrapper--center">
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart data={decadeData} cx="50%" cy="50%" outerRadius={120}>
                <PolarGrid stroke="var(--surface-border)" />
                <PolarAngleAxis dataKey="decade" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <PolarRadiusAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Radar name="Tổng thể" dataKey="overall" stroke="#ff2a5f" fill="#ff2a5f" fillOpacity={0.2} strokeWidth={2} />
                <Radar name="50 kỳ gần nhất" dataKey="recent" stroke="#00e5ff" fill="#00e5ff" fillOpacity={0.2} strokeWidth={2} />
                <Legend />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* GAP ANALYSIS TABLE */}
      {activeTab === 'gap' && (
        <div className="glass-panel dashboard-chart-panel">
          <div className="panel-header">
            <AlertTriangle size={20} color="#ef4444" />
            <h2 className="panel-title">Gap Analysis — Số lâu chưa ra</h2>
            <span className="panel-subtitle">Top 20 số có khoảng cách xa nhất kể từ lần xuất hiện cuối</span>
          </div>
          <div className="gap-grid">
            {gapData.map((item, idx) => (
              <div key={idx} className={`gap-card${idx < 3 ? ' gap-card--hot' : ''}`}>
                <div className="gap-card-number">
                  <span className={`ball${idx < 3 ? ' special' : ''}`}>{item.number}</span>
                </div>
                <div className="gap-card-info">
                  <div className="gap-card-value">{item.gap} kỳ</div>
                  <div className="gap-card-label">chưa xuất hiện</div>
                </div>
                <div className="gap-card-bar">
                  <div 
                    className="gap-card-bar-fill" 
                    style={{ 
                      width: `${Math.min(100, (item.gap / (gapData[0]?.gap || 1)) * 100)}%`,
                      background: idx < 3 ? '#ff2a5f' : idx < 8 ? '#f97316' : '#3b82f6'
                    }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
