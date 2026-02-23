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

export default function DeviceComparison({ token }) {
  const [metric, setMetric] = useState('sleep_duration');
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

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

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Loading comparison...</p>;

  return (
    <section>
      <h2>Device Comparison</h2>

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

      <p>Average delta: <strong>{data.average_delta == null ? '--' : data.average_delta.toFixed(2)}</strong></p>

      <div className="chart-card">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="apple_watch_value" stroke="#2563eb" dot={false} name="Apple Watch" />
            <Line type="monotone" dataKey="whoop_value" stroke="#16a34a" dot={false} name="WHOOP" />
            <Line type="monotone" dataKey="delta" stroke="#ef4444" dot={false} name="Delta" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <table>
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
              <td>{row.apple_watch_value == null ? '--' : row.apple_watch_value.toFixed(2)}</td>
              <td>{row.whoop_value == null ? '--' : row.whoop_value.toFixed(2)}</td>
              <td>{row.delta == null ? '--' : row.delta.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
