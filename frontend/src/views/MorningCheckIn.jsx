import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

function hours(ms) {
  if (ms == null) return '--';
  return (ms / 3_600_000).toFixed(1);
}

function pct(value) {
  if (value == null) return '--';
  return `${value.toFixed(1)}%`;
}

export default function MorningCheckIn({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/dashboard/morning-checkin', { token })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Loading morning check-in...</p>;

  const inRecovery = data.recovery_mode?.active;
  const deltaStyle = inRecovery ? { color: '#94a3b8' } : {};

  return (
    <section>
      <h2>Morning Check-In</h2>
      <div className="grid two-col">
        <article className="card">
          <h3>Unified Readiness</h3>
          <p>WHOOP Recovery: <strong>{data.recovery.score ?? '--'}%</strong> ({data.recovery.zone || 'n/a'})</p>
          <p>HRV vs Apple 90d baseline: <strong>{data.hrv.value ?? '--'}</strong> <span style={deltaStyle}>({data.hrv.suppressed ? 'paused' : pct(data.hrv.delta_pct_vs_baseline)})</span></p>
          <p>Resting HR vs Apple 30d baseline: <strong>{data.resting_hr.value ?? '--'}</strong> <span style={deltaStyle}>({data.resting_hr.suppressed ? 'paused' : pct(data.resting_hr.delta_pct_vs_baseline)})</span></p>
        </article>

        <article className="card">
          <h3>Last Night Sleep</h3>
          <p>Actual sleep: <strong>{hours(data.sleep.actual_ms)}h</strong></p>
          <p>WHOOP sleep need: <strong>{hours(data.sleep.whoop_sleep_need_ms)}h</strong></p>
          <p>Apple long-term avg: <strong>{hours(data.sleep.apple_long_term_avg_ms)}h</strong></p>
          <p>WHOOP sleep performance: <strong>{data.sleep.whoop_sleep_performance_pct ?? '--'}%</strong></p>
        </article>

        <article className="card">
          <h3>Yesterday Training</h3>
          <p>WHOOP Strain: <strong>{data.training_yesterday.whoop_strain ?? '--'}</strong></p>
          <p>Apple workout: <strong>{data.training_yesterday.apple_workout_type || 'None'}</strong></p>
          <p>Duration: <strong>{hours(data.training_yesterday.apple_workout_duration_ms)}h</strong></p>
        </article>

        <article className="card" style={inRecovery ? { borderLeft: '4px solid #f59e0b' } : {}}>
          <h3>{inRecovery ? '🩺 Recovery Guidance' : 'Recommendation'}</h3>
          <p className="recommendation">{data.recommendation}</p>
          {inRecovery && (
            <p style={{ fontSize: '0.85rem', color: '#92400e', marginTop: '0.5rem' }}>
              Day {data.recovery_mode.day_number} of recovery ({data.recovery_mode.reason})
            </p>
          )}
        </article>
      </div>
    </section>
  );
}
