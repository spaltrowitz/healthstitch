import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

const IMPACT_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
const STATUS_COLORS = { low: '#ef4444', below_avg: '#f59e0b', high: '#ef4444', moderate: '#f59e0b', above_avg: '#22c55e', normal: '#22c55e' };
const ZONE_STYLES = {
  red: { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' },
  yellow: { background: '#fefce8', border: '1px solid #fde68a', color: '#854d0e' },
  green: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }
};

function SleepStageBar({ label, apple, whoop, maxMin }) {
  const scale = maxMin > 0 ? 100 / maxMin : 0;
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ background: '#e2e8f0', borderRadius: 4, height: 14, overflow: 'hidden' }}>
            {apple != null && <div style={{ background: '#2563eb', height: '100%', width: `${apple * scale}%`, borderRadius: 4 }} />}
          </div>
        </div>
        <span style={{ fontSize: '0.75rem', width: 42, textAlign: 'right', color: '#2563eb' }}>{apple != null ? `${apple}m` : '--'}</span>
        <span style={{ fontSize: '0.75rem', width: 42, textAlign: 'right', color: '#16a34a' }}>{whoop != null ? `${whoop}m` : '--'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ background: '#e2e8f0', borderRadius: 4, height: 14, overflow: 'hidden', direction: 'rtl' }}>
            {whoop != null && <div style={{ background: '#16a34a', height: '100%', width: `${whoop * scale}%`, borderRadius: 4 }} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function FactorRow({ factor }) {
  return (
    <div style={{ padding: '0.75rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
        <strong style={{ fontSize: '0.9rem' }}>{factor.metric}</strong>
        <span style={{
          fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
          padding: '0.15rem 0.5rem', borderRadius: 12,
          background: IMPACT_COLORS[factor.impact] + '18',
          color: IMPACT_COLORS[factor.impact]
        }}>
          {factor.impact} impact
        </span>
      </div>
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
        {factor.apple_value && (
          <span>⌚ <strong style={{ color: '#2563eb' }}>{factor.apple_value}</strong></span>
        )}
        {factor.whoop_value && (
          <span>🟢 <strong style={{ color: '#16a34a' }}>{factor.whoop_value}</strong></span>
        )}
        {factor.avg_7d && (
          <span style={{ color: '#64748b' }}>7d avg: {factor.avg_7d}</span>
        )}
        {factor.baseline_90d && (
          <span style={{ color: '#64748b' }}>90d baseline: {factor.baseline_90d}</span>
        )}
        {factor.baseline_30d && (
          <span style={{ color: '#64748b' }}>30d baseline: {factor.baseline_30d}</span>
        )}
      </div>
      <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>{factor.explanation}</p>
    </div>
  );
}

export default function ScoreExplainer({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    setData(null);
    apiRequest(`/dashboard/score-explainer?date=${date}`, { token })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token, date]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Analyzing your scores…</p>;

  const apple = data.sleep?.apple_watch;
  const whoop = data.sleep?.whoop;
  const allMins = [
    apple?.deep_min, apple?.rem_min, apple?.light_min, apple?.awake_min,
    whoop?.deep_min, whoop?.rem_min, whoop?.light_min, whoop?.awake_min
  ].filter(v => v != null);
  const maxMin = Math.max(...allMins, 1);

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Score Explainer</h2>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          style={{ padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid #cbd5e1' }} />
      </div>

      {/* Summary banner */}
      <div className="card" style={{ background: '#f8fafc', borderLeft: '4px solid #2563eb', marginBottom: '1rem' }}>
        <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.6 }}>{data.summary}</p>
      </div>

      <div className="grid two-col">
        {/* Recovery & Sleep Scores */}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Scores</h3>

          {data.scores.whoop_recovery && (
            <div style={{ ...ZONE_STYLES[data.scores.whoop_recovery.zone], borderRadius: 10, padding: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>🟢 WHOOP Recovery</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.scores.whoop_recovery.score}%</span>
              </div>
              <p style={{ fontSize: '0.8rem', margin: '0.35rem 0 0', opacity: 0.8 }}>{data.scores.whoop_recovery.primary_driver}</p>
            </div>
          )}

          {data.scores.whoop_sleep && (
            <div style={{ background: '#f1f5f9', borderRadius: 10, padding: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>🟢 WHOOP Sleep</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.scores.whoop_sleep.score}%</span>
              </div>
              <p style={{ fontSize: '0.8rem', margin: '0.35rem 0 0', color: '#475569' }}>{data.scores.whoop_sleep.primary_driver}</p>
            </div>
          )}

          {!data.scores.whoop_recovery && !data.scores.whoop_sleep && (
            <p style={{ color: '#94a3b8' }}>No WHOOP scores available for this date.</p>
          )}

          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.5rem 0 0' }}>
            Apple Watch does not produce a single recovery or readiness score. HealthStitch compares the underlying metrics instead.
          </p>
        </div>

        {/* Sleep Comparison */}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Sleep Breakdown</h3>

          {(apple || whoop) ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
                <span style={{ color: '#2563eb' }}>⌚ Apple {apple ? `${apple.total_hours}h` : '--'}</span>
                <span style={{ color: '#16a34a' }}>🟢 WHOOP {whoop ? `${whoop.total_hours}h` : '--'}</span>
              </div>

              <SleepStageBar label="Deep (SWS)" apple={apple?.deep_min} whoop={whoop?.deep_min} maxMin={maxMin} />
              <SleepStageBar label="REM" apple={apple?.rem_min} whoop={whoop?.rem_min} maxMin={maxMin} />
              <SleepStageBar label="Light / Core" apple={apple?.light_min} whoop={whoop?.light_min} maxMin={maxMin} />
              <SleepStageBar label="Awake" apple={apple?.awake_min} whoop={whoop?.awake_min} maxMin={maxMin} />

              {whoop?.need_hours && (
                <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#f8fafc', borderRadius: 8, fontSize: '0.85rem' }}>
                  <strong>Sleep Need:</strong> {whoop.need_hours}h
                  {whoop.total_hours > whoop.need_hours
                    ? <span style={{ color: '#16a34a' }}> — you slept {(whoop.total_hours - whoop.need_hours).toFixed(1)}h more than needed ✓</span>
                    : <span style={{ color: '#f59e0b' }}> — you needed {(whoop.need_hours - whoop.total_hours).toFixed(1)}h more sleep</span>
                  }
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.25rem 0 0' }}>
                    Apple Watch does not calculate sleep need. This is a WHOOP-only feature based on strain, sleep debt, and baseline.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: '#94a3b8' }}>No sleep data available for this date.</p>
          )}
        </div>
      </div>

      {/* Factor Breakdown */}
      <h3 style={{ marginTop: '1.5rem' }}>Factor Breakdown</h3>
      <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '-0.25rem 0 0.75rem' }}>
        What's driving your scores today — side-by-side from each device.
      </p>
      {data.factors.map((f, i) => <FactorRow key={i} factor={f} />)}

      {data.factors.length === 0 && (
        <p style={{ color: '#94a3b8' }}>No metrics available for this date.</p>
      )}
    </section>
  );
}
