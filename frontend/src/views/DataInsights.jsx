import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

const STATUS_STYLES = {
  green: { bg: '#f0fdf4', border: '#bbf7d0', dot: '#22c55e' },
  yellow: { bg: '#fefce8', border: '#fde68a', dot: '#f59e0b' },
  red: { bg: '#fef2f2', border: '#fecaca', dot: '#ef4444' }
};

function getSeenInsights() {
  try { return JSON.parse(localStorage.getItem('hs_seen_insights') || '{}'); } catch { return {}; }
}
function markSeen(title, body) {
  const seen = getSeenInsights();
  seen[title] = body;
  localStorage.setItem('hs_seen_insights', JSON.stringify(seen));
}
function isNewInsight(title, body) {
  const seen = getSeenInsights();
  return seen[title] !== body;
}

function CompactInsight({ insight, isNew, onSeen }) {
  const [expanded, setExpanded] = useState(false);
  const style = STATUS_STYLES[insight.status] || STATUS_STYLES.green;

  function handleClick() {
    setExpanded(!expanded);
    if (isNew && onSeen) onSeen(insight.title, insight.body);
  }

  return (
    <div onClick={handleClick}
      style={{
        padding: '0.65rem 0.85rem', background: style.bg, border: `1px solid ${style.border}`,
        borderRadius: 10, cursor: 'pointer', position: 'relative'
      }}>
      {isNew && (
        <span style={{
          position: 'absolute', top: -6, right: -6,
          background: '#2563eb', color: '#fff', fontSize: '0.6rem', fontWeight: 700,
          padding: '0.1rem 0.4rem', borderRadius: 8
        }}>CHANGED</span>
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
  const [showAll, setShowAll] = useState(false);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    apiRequest('/dashboard/insights', { token })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token]);

  function handleSeen(title, body) {
    markSeen(title, body);
    forceUpdate(n => n + 1);
  }

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Analyzing your data…</p>;

  const all = data.insights || [];
  const needsAttention = all.filter(i => i.status === 'red');
  const worthNoting = all.filter(i => i.status === 'yellow');
  const normal = all.filter(i => i.status === 'green' || !i.status);
  const changed = all.filter(i => isNewInsight(i.title, i.body));

  const hasIssues = needsAttention.length > 0 || worthNoting.length > 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Insights</h2>
        {changed.length > 0 && (
          <span style={{ background: '#2563eb', color: '#fff', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 10 }}>
            {changed.length} changed
          </span>
        )}
      </div>
      {data.overlap_period && (
        <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.8rem' }}>
          Based on {Math.round((new Date(data.overlap_period.end) - new Date(data.overlap_period.start)) / 86400000)} days of overlapping data
        </p>
      )}

      {!hasIssues && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>✓</div>
          <strong style={{ color: '#166534' }}>Everything looks good</strong>
          <p style={{ color: '#15803d', fontSize: '0.82rem', margin: '0.25rem 0 0' }}>
            All metrics are within normal ranges. Your devices are well aligned.
          </p>
        </div>
      )}

      {needsAttention.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.8rem', marginBottom: '0.4rem', color: '#dc2626' }}>NEEDS ATTENTION</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {needsAttention.map((insight, i) => (
              <CompactInsight key={i} insight={insight} isNew={isNewInsight(insight.title, insight.body)} onSeen={handleSeen} />
            ))}
          </div>
        </div>
      )}

      {worthNoting.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.8rem', marginBottom: '0.4rem', color: '#ca8a04' }}>WORTH NOTING</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {worthNoting.map((insight, i) => (
              <CompactInsight key={i} insight={insight} isNew={isNewInsight(insight.title, insight.body)} onSeen={handleSeen} />
            ))}
          </div>
        </div>
      )}

      {normal.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          {hasIssues ? (
            <button onClick={() => setShowAll(!showAll)}
              style={{ fontSize: '0.8rem', color: '#64748b', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
              {showAll ? '▼' : '▶'} {normal.length} metrics in normal range
            </button>
          ) : (
            <button onClick={() => setShowAll(!showAll)}
              style={{ fontSize: '0.8rem', color: '#64748b', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginTop: '0.5rem' }}>
              {showAll ? '▼ Hide details' : '▶ See all details'}
            </button>
          )}
          {showAll && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
              {normal.map((insight, i) => (
                <CompactInsight key={i} insight={insight} isNew={isNewInsight(insight.title, insight.body)} onSeen={handleSeen} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
