import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

const STATUS_STYLES = {
  green: { bg: '#f0fdf4', border: '#bbf7d0', dot: '#22c55e' },
  yellow: { bg: '#fefce8', border: '#fde68a', dot: '#f59e0b' },
  red: { bg: '#fef2f2', border: '#fecaca', dot: '#ef4444' }
};

function getSeenInsights() {
  try { return JSON.parse(localStorage.getItem('hs_seen_insights') || '[]'); } catch { return []; }
}
function markSeen(title) {
  const seen = getSeenInsights();
  if (!seen.includes(title)) {
    seen.push(title);
    localStorage.setItem('hs_seen_insights', JSON.stringify(seen));
  }
}

function CompactInsight({ insight, isNew, onSeen }) {
  const [expanded, setExpanded] = useState(false);
  const style = STATUS_STYLES[insight.status] || STATUS_STYLES.green;

  function handleClick() {
    setExpanded(!expanded);
    if (isNew && onSeen) onSeen(insight.title);
  }

  return (
    <div
      onClick={handleClick}
      style={{
        padding: '0.65rem 0.85rem',
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
        position: 'relative'
      }}
    >
      {isNew && (
        <span style={{
          position: 'absolute', top: -6, right: -6,
          background: '#2563eb', color: '#fff', fontSize: '0.6rem', fontWeight: 700,
          padding: '0.1rem 0.4rem', borderRadius: 8
        }}>NEW</span>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: style.dot, flexShrink: 0 }} />
          <strong style={{ fontSize: '0.85rem' }}>{insight.title}</strong>
        </div>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
      </div>
      <p style={{ fontSize: '0.82rem', color: '#475569', margin: '0.25rem 0 0 1.1rem', lineHeight: 1.4 }}>{insight.body}</p>
      {expanded && insight.detail && (
        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.35rem 0 0 1.1rem', lineHeight: 1.4, borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.35rem' }}>{insight.detail}</p>
      )}
    </div>
  );
}

export default function DataInsights({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [seenList, setSeenList] = useState(getSeenInsights());

  useEffect(() => {
    apiRequest('/dashboard/insights', { token })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token]);

  function handleSeen(title) {
    markSeen(title);
    setSeenList(getSeenInsights());
  }

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Analyzing your data…</p>;

  const categories = {
    'Device Comparison': data.insights.filter(i => i.type === 'comparison' || i.type === 'correlation'),
    'Patterns & Habits': data.insights.filter(i => i.type === 'pattern'),
    'Status': data.insights.filter(i => i.type === 'info')
  };

  const newCount = data.insights.filter(i => !seenList.includes(i.title)).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Insights</h2>
        {newCount > 0 && (
          <span style={{ background: '#2563eb', color: '#fff', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 10 }}>
            {newCount} new
          </span>
        )}
      </div>
      {data.overlap_period && (
        <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.8rem' }}>
          Based on {Math.round((new Date(data.overlap_period.end) - new Date(data.overlap_period.start)) / 86400000)} days of overlapping data
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.7rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} /> Normal</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} /> Worth noting</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} /> Needs attention</span>
      </div>

      {Object.entries(categories).map(([category, items]) => items.length > 0 && (
        <div key={category} style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.8rem', marginBottom: '0.4rem' }}>{category.toUpperCase()}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {items.map((insight, i) => (
              <CompactInsight
                key={i}
                insight={insight}
                isNew={!seenList.includes(insight.title)}
                onSeen={handleSeen}
              />
            ))}
          </div>
        </div>
      ))}

      {data.insights.length === 0 && (
        <p style={{ color: '#64748b' }}>No insights yet. Upload data from both devices.</p>
      )}
    </div>
  );
}
