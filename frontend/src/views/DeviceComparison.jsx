import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { apiRequest } from '../api/client';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function computeAgreement(rows) {
  if (!rows || rows.length === 0) return null;
  const valid = rows.filter((r) => r.apple_watch_value != null && r.whoop_value != null);
  if (valid.length === 0) return null;
  const agreeing = valid.filter((r) => {
    const avg = (Math.abs(r.apple_watch_value) + Math.abs(r.whoop_value)) / 2;
    if (avg === 0) return true;
    return Math.abs(r.delta) / avg <= 0.15;
  });
  return Math.round((agreeing.length / valid.length) * 100);
}

export default function DeviceComparison({ token }) {
  const [metric, setMetric] = useState('sleep_duration');
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    apiRequest(`/dashboard/device-comparison?metric=${metric}&from=${from}&to=${to}`, { token })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [metric, from, to, token]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.rows.map((row) => ({
      ...row,
      apple_watch_value: metric === 'sleep_duration' && row.apple_watch_value != null ? row.apple_watch_value / 3_600_000 : row.apple_watch_value,
      whoop_value: metric === 'sleep_duration' && row.whoop_value != null ? row.whoop_value / 3_600_000 : row.whoop_value,
      delta: metric === 'sleep_duration' && row.delta != null ? row.delta / 3_600_000 : row.delta
    }));
  }, [data, metric]);

  const agreement = useMemo(() => computeAgreement(chartData), [chartData]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return (
    <section>
      <h2>Apple Watch vs WHOOP</h2>
      <div className="grid two-col">
        <div className="skeleton skeleton-card" style={{ height: 100 }} />
        <div className="skeleton skeleton-card" style={{ height: 100 }} />
      </div>
      <div className="skeleton skeleton-card" style={{ height: 300 }} />
    </section>
  );

  const unit = metric === 'sleep_duration' ? 'h' : 'bpm';

  return (
    <section>
      <h2>Apple Watch vs WHOOP</h2>

      <div className="controls-inline">
        <div className="selector-row">
          <label>Metric</label>
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="sleep_duration">Sleep duration</option>
            <option value="resting_hr">Resting HR</option>
          </select>
        </div>
        <div className="selector-row">
          <label>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="selector-row">
          <label>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="grid two-col" style={{ marginBottom: '1rem' }}>
        <article className="card stat-card">
          <span className="stat-icon">📊</span>
          <div>
            <div className="stat-value">
              {data.average_delta == null ? '--' : Math.abs(data.average_delta).toFixed(2)}
              <span style={{ fontSize: '0.85rem', fontWeight: 400 }}> {unit}</span>
            </div>
            <div className="stat-label">Average difference</div>
          </div>
        </article>
        {agreement != null && (
          <article className="card stat-card">
            <span className="stat-icon">🤝</span>
            <div>
              <div className="stat-value">{agreement}%</div>
              <div className="stat-label">Device agreement (within 15%)</div>
            </div>
          </article>
        )}
      </div>

      <div className="chart-card">
        <h3>Side-by-side comparison</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="apple_watch_value" stroke="#2563eb" strokeWidth={2} dot={false} name="Apple Watch" />
            <Line type="monotone" dataKey="whoop_value" stroke="#16a34a" strokeWidth={2} dot={false} name="WHOOP" />
            <Line type="monotone" dataKey="delta" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Delta" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <button className="toggle-btn" onClick={() => setShowRaw(!showRaw)}>
        {showRaw ? '▲ Hide' : '▼ Show'} raw data ({chartData.length} rows)
      </button>

      {showRaw && (
        <table style={{ marginTop: '0.75rem' }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Apple Watch</th>
              <th>WHOOP</th>
              <th>Delta</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row) => (
              <tr key={row.date}>
                <td>{row.date}</td>
                <td>{row.apple_watch_value == null ? '—' : row.apple_watch_value.toFixed(2)}</td>
                <td>{row.whoop_value == null ? '—' : row.whoop_value.toFixed(2)}</td>
                <td>{row.delta == null ? '—' : row.delta.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
