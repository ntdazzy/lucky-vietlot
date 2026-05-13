'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function FreqChart({ data }) {
  // data should be sorted by number 1-45 or 1-55
  const chartData = [...data].sort((a, b) => parseInt(a.number) - parseInt(b.number));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'rgba(11, 15, 25, 0.9)', border: '1px solid rgba(255,255,255,0.2)', padding: '12px', borderRadius: '8px' }}>
          <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--primary)' }}>Số: {payload[0].payload.number}</p>
          <p style={{ margin: 0, color: 'white' }}>Số lần xuất hiện: {payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', height: 300, marginTop: '20px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
          <XAxis 
            dataKey="number" 
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.count >= 20 ? 'var(--primary)' : 'var(--secondary)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
