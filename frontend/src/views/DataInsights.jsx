import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

const TYPE_COLORS = {
  comparison: '#2563eb',
  correlation: '#8b5cf6',
  pattern: '#16a34a',
  info: '#64748b'
};

const TYPE_ICONS = {
  comparison: '⚖️',
  correlation: '📈',
  pattern: '🔍',
  info: 'ℹ️'
};

function InsightCard({ insight }) {
  const borderColor = TYPE_COLORS[insight.type] || '#e2e8f0';

  return (
    <div className="card" style={{ borderLeft: `4px solid ${borderColor}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '1.2rem' }}>{TYPE_ICONS[insight.type]}</span>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{insight.title}</h3>
      </div>
      <p style={{ margin: '0.5rem 0', lineHeight: 1.6 }}>{insight.body}</p>
      {insight.detail && (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
          {insight.detail}
        </p>
      )}
    </div>
  );
}

export default function DataInsights({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/dashboard/insights', { token })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Analyzing your data…</p>;

  return (
    <div>
      {data.overlap_period && (
        <p style={{ color: '#64748b', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Cross-device analysis period: {data.overlap_period.start} to {data.overlap_period.end}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {data.insights.map((insight, i) => (
          <InsightCard key={i} insight={insight} />
        ))}
      </div>

      {data.insights.length === 0 && (
        <p style={{ color: '#64748b' }}>No insights available yet. Upload data from both Apple Watch and WHOOP to see cross-device analysis.</p>
      )}
    </div>
  );
}
