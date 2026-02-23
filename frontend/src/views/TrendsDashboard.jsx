import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  ComposedChart,
  Area
} from 'recharts';
import { apiRequest } from '../api/client';
import DateRangeSelector from '../components/DateRangeSelector';
import SourceToggle from '../components/SourceToggle';

function mergeByDate(rows, keyMap) {
  const map = new Map();
  for (const row of rows) {
    const date = row.date;
    if (!map.has(date)) map.set(date, { date });
    map.set(date, { ...map.get(date), ...keyMap(row) });
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export default function TrendsDashboard({ token }) {
  const [range, setRange] = useState('30');
  const [source, setSource] = useState('both');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest(`/dashboard/trends?range=${range}&source=${source}`, { token })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [range, source, token]);

  const hrvData = useMemo(() => {
    if (!data) return [];
    return mergeByDate(data.hrv, (row) => ({
      [`${row.source}_${row.metric_type}`]: row.value
    }));
  }, [data]);

  const restingData = useMemo(() => {
    if (!data) return [];
    return mergeByDate(data.resting_hr, (row) => ({ [`${row.source}_resting_hr`]: row.value }));
  }, [data]);

  const sleepData = useMemo(() => {
    if (!data) return [];
    return mergeByDate(data.sleep, (row) => ({
      [`${row.source}_sleep`]: row.total_duration_ms / 3_600_000,
      whoop_sleep_need: row.source === 'whoop' && row.sleep_need_ms ? row.sleep_need_ms / 3_600_000 : undefined
    }));
  }, [data]);

  const strainData = useMemo(() => {
    if (!data) return [];
    return mergeByDate(
      [...data.strain.whoop.map((d) => ({ ...d, type: 'whoop' })), ...data.strain.apple_load.map((d) => ({ ...d, type: 'apple' }))],
      (row) => (row.type === 'whoop' ? { whoop_strain: row.whoop_strain } : { apple_active_energy: row.apple_active_energy })
    );
  }, [data]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Loading trends...</p>;

  return (
    <section>
      <h2>Trends Dashboard</h2>
      <div className="controls-inline">
        <DateRangeSelector value={range} onChange={setRange} />
        <SourceToggle value={source} onChange={setSource} />
      </div>

      <div className="chart-card">
        <h3>HRV over time (Apple SDNN vs WHOOP RMSSD)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={hrvData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="apple_watch_hrv_sdnn" stroke="#2563eb" dot={false} name="Apple SDNN" />
            <Line type="monotone" dataKey="whoop_hrv_rmssd" stroke="#16a34a" dot={false} name="WHOOP RMSSD" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Resting HR over time</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={restingData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="apple_watch_resting_hr" stroke="#2563eb" dot={false} name="Apple Watch" />
            <Line type="monotone" dataKey="whoop_resting_hr" stroke="#16a34a" dot={false} name="WHOOP" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Sleep duration vs WHOOP sleep need</h3>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={sleepData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="apple_watch_sleep" fill="#2563eb" name="Apple sleep (h)" />
            <Bar dataKey="whoop_sleep" fill="#16a34a" name="WHOOP sleep (h)" />
            <Area dataKey="whoop_sleep_need" fill="#fbbf24" stroke="#f59e0b" name="WHOOP sleep need (h)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Sleep stages (WHOOP)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.sleep_stages}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="slow_wave_ms" stackId="sleep" fill="#3b82f6" name="Slow Wave" />
            <Bar dataKey="rem_ms" stackId="sleep" fill="#8b5cf6" name="REM" />
            <Bar dataKey="light_ms" stackId="sleep" fill="#60a5fa" name="Light" />
            <Bar dataKey="awake_ms" stackId="sleep" fill="#f97316" name="Awake" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Daily strain + workout load</h3>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={strainData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="apple_active_energy" fill="#2563eb" name="Apple active energy" />
            <Line type="monotone" dataKey="whoop_strain" stroke="#16a34a" dot={false} name="WHOOP strain" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Rolling 7-day average training load</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.strain.rolling_7d_load}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#ef4444" dot={false} name="7d avg load" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
