import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

function CompactInsight({ insight }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{ padding: '0.6rem 0.85rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '0.85rem' }}>{insight.title}</strong>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
      </div>
      <p style={{ fontSize: '0.82rem', color: '#475569', margin: '0.25rem 0 0', lineHeight: 1.4 }}>{insight.body}</p>
      {expanded && insight.detail && (
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.35rem 0 0', lineHeight: 1.4, borderTop: '1px solid #f1f5f9', paddingTop: '0.35rem' }}>{insight.detail}</p>
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

  const categories = {
    'Device Comparison': data.insights.filter(i => i.type === 'comparison' || i.type === 'correlation'),
    'Patterns & Habits': data.insights.filter(i => i.type === 'pattern'),
    'Status': data.insights.filter(i => i.type === 'info')
  };

  return (
    <div>
      <h2>Insights</h2>
      {data.overlap_period && (
        <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.8rem' }}>
          Based on {Math.round((new Date(data.overlap_period.end) - new Date(data.overlap_period.start)) / 86400000)} days of overlapping data
        </p>
      )}

      {Object.entries(categories).map(([category, items]) => items.length > 0 && (
        <div key={category} style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.8rem', marginBottom: '0.4rem' }}>{category.toUpperCase()}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {items.map((insight, i) => <CompactInsight key={i} insight={insight} />)}
          </div>
        </div>
      ))}

      {data.insights.length === 0 && (
        <p style={{ color: '#64748b' }}>No insights yet. Upload data from both devices.</p>
      )}
    </div>
  );
}
