import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

function hours(ms) {
  if (ms == null) return null;
  return (ms / 3_600_000).toFixed(1);
}

function deltaColor(pct) {
  if (pct == null) return 'warn';
  if (Math.abs(pct) < 5) return 'good';
  if (Math.abs(pct) < 15) return 'warn';
  return 'bad';
}

function zoneColor(zone) {
  if (!zone) return '';
  const z = zone.toLowerCase();
  if (z === 'green') return 'color-green';
  if (z === 'yellow') return 'color-amber';
  return 'color-red';
}

function gaugeColor(score) {
  if (score == null) return 'var(--amber)';
  if (score >= 67) return 'var(--green)';
  if (score >= 34) return 'var(--amber)';
  return 'var(--red)';
}

function SkeletonLoader() {
  return (
    <div className="grid two-col">
      <div className="skeleton skeleton-card" />
      <div className="skeleton skeleton-card" />
      <div className="skeleton skeleton-card" />
      <div className="skeleton skeleton-card" />
    </div>
  );
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
  if (!data) return <SkeletonLoader />;

  const score = data.recovery.score;

  return (
    <section>
      <h2>Today's Readiness</h2>

      <article className="card readiness-hero">
        <div className="readiness-gauge" style={{ color: gaugeColor(score) }}>
          <span className="score">{score ?? '—'}</span>
          <span className="label">Recovery</span>
        </div>
        <span className={`readiness-zone ${zoneColor(data.recovery.zone)}`}>
          {data.recovery.zone || 'Unknown'} zone
        </span>
      </article>

      <div className="grid two-col">
        <article className="card">
          <h3>Heart Rate Variability</h3>
          <div className="source-metrics">
            {data.hrv.apple_watch?.value != null && (
              <div className="source-row">
                <span className="source-label">Apple Watch (SDNN)</span>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0' }}>
                  {data.hrv.apple_watch.value} <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>ms</span>
                </p>
                <span className={`delta-badge ${deltaColor(data.hrv.apple_watch.delta_pct)}`}>
                  {data.hrv.apple_watch.delta_pct != null
                    ? `${data.hrv.apple_watch.delta_pct > 0 ? '\u2191' : '\u2193'} ${Math.abs(data.hrv.apple_watch.delta_pct).toFixed(1)}% vs 90d`
                    : 'No baseline'}
                </span>
              </div>
            )}
            {data.hrv.whoop?.value != null && (
              <div className="source-row">
                <span className="source-label">WHOOP (RMSSD)</span>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0' }}>
                  {data.hrv.whoop.value} <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>ms</span>
                </p>
                <span className={`delta-badge ${deltaColor(data.hrv.whoop.delta_pct)}`}>
                  {data.hrv.whoop.delta_pct != null
                    ? `${data.hrv.whoop.delta_pct > 0 ? '\u2191' : '\u2193'} ${Math.abs(data.hrv.whoop.delta_pct).toFixed(1)}% vs 90d`
                    : 'No baseline'}
                </span>
              </div>
            )}
            {data.hrv.apple_watch?.value == null && data.hrv.whoop?.value == null && (
              <p style={{ color: '#64748b' }}>No HRV data today</p>
            )}
          </div>
        </article>

        <article className="card">
          <h3>Resting Heart Rate</h3>
          <div className="source-metrics">
            {data.resting_hr.apple_watch?.value != null && (
              <div className="source-row">
                <span className="source-label">Apple Watch</span>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0' }}>
                  {data.resting_hr.apple_watch.value} <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>bpm</span>
                </p>
                <span className={`delta-badge ${deltaColor(data.resting_hr.apple_watch.delta_pct)}`}>
                  {data.resting_hr.apple_watch.delta_pct != null
                    ? `${data.resting_hr.apple_watch.delta_pct > 0 ? '\u2191' : '\u2193'} ${Math.abs(data.resting_hr.apple_watch.delta_pct).toFixed(1)}% vs 30d`
                    : 'No baseline'}
                </span>
              </div>
            )}
            {data.resting_hr.whoop?.value != null && (
              <div className="source-row">
                <span className="source-label">WHOOP</span>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0' }}>
                  {data.resting_hr.whoop.value} <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>bpm</span>
                </p>
                <span className={`delta-badge ${deltaColor(data.resting_hr.whoop.delta_pct)}`}>
                  {data.resting_hr.whoop.delta_pct != null
                    ? `${data.resting_hr.whoop.delta_pct > 0 ? '\u2191' : '\u2193'} ${Math.abs(data.resting_hr.whoop.delta_pct).toFixed(1)}% vs 30d`
                    : 'No baseline'}
                </span>
              </div>
            )}
            {data.resting_hr.apple_watch?.value == null && data.resting_hr.whoop?.value == null && (
              <p style={{ color: '#64748b' }}>No RHR data today</p>
            )}
          </div>
        </article>

        <article className="card">
          <h3>Last Night's Sleep</h3>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0' }}>
            {hours(data.sleep.actual_ms) ?? '—'}h
          </p>
          <p style={{ margin: '0.5rem 0 0.25rem', color: '#64748b', fontSize: '0.85rem' }}>
            Need: {hours(data.sleep.whoop_sleep_need_ms) ?? '—'}h &middot; Avg: {hours(data.sleep.apple_long_term_avg_ms) ?? '—'}h
          </p>
          {data.sleep.whoop_sleep_performance_pct != null && (
            <span className={`delta-badge ${data.sleep.whoop_sleep_performance_pct >= 85 ? 'good' : data.sleep.whoop_sleep_performance_pct >= 70 ? 'warn' : 'bad'}`}>
              {data.sleep.whoop_sleep_performance_pct}% sleep score
            </span>
          )}
        </article>

        <article className="card">
          <h3>Yesterday's Training</h3>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0' }}>
            {data.training_yesterday.whoop_strain != null ? Number(data.training_yesterday.whoop_strain).toFixed(1) : '—'}{' '}
            <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>strain</span>
          </p>
          {data.training_yesterday.apple_workout_type && (
            <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>
              {data.training_yesterday.apple_workout_type} &middot; {hours(data.training_yesterday.apple_workout_duration_ms) ?? '—'}h
            </p>
          )}
        </article>
      </div>

      <article className="card recommendation-card">
        <h3>Your Plan Today</h3>
        <p className="recommendation">{data.recommendation}</p>
      </article>
    </section>
  );
}
