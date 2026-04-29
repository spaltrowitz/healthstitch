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

function SkeletonCharts() {
  return (
    <section>
      <h2>Your Trends</h2>
      <div className="charts-grid">
        <div className="skeleton skeleton-card" style={{ height: 280 }} />
        <div className="skeleton skeleton-card" style={{ height: 280 }} />
        <div className="skeleton skeleton-card" style={{ height: 280 }} />
        <div className="skeleton skeleton-card" style={{ height: 280 }} />
      </div>
    </section>
  );
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
  if (!data) return <SkeletonCharts />;

  return (
    <section>
      <h2>Your Trends</h2>
      <div className="controls-inline">
        <DateRangeSelector value={range} onChange={setRange} />
        <SourceToggle value={source} onChange={setSource} />
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>How well are you recovering?</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={hrvData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="apple_watch_hrv_sdnn" stroke="#2563eb" strokeWidth={2} dot={false} name="Apple SDNN" />
              <Line type="monotone" dataKey="whoop_hrv_rmssd" stroke="#16a34a" strokeWidth={2} dot={false} name="WHOOP RMSSD" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Resting heart rate trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={restingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="apple_watch_resting_hr" stroke="#2563eb" strokeWidth={2} dot={false} name="Apple Watch" />
              <Line type="monotone" dataKey="whoop_resting_hr" stroke="#16a34a" strokeWidth={2} dot={false} name="WHOOP" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Are you sleeping enough?</h3>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={sleepData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="apple_watch_sleep" fill="#2563eb" name="Apple (hours)" radius={[3,3,0,0]} />
              <Bar dataKey="whoop_sleep" fill="#16a34a" name="WHOOP (hours)" radius={[3,3,0,0]} />
              <Area dataKey="whoop_sleep_need" fill="#fbbf24" fillOpacity={0.2} stroke="#f59e0b" name="Sleep need" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Sleep quality breakdown</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.sleep_stages}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="slow_wave_ms" stackId="sleep" fill="#3b82f6" name="Deep" />
              <Bar dataKey="rem_ms" stackId="sleep" fill="#8b5cf6" name="REM" />
              <Bar dataKey="light_ms" stackId="sleep" fill="#93c5fd" name="Light" />
              <Bar dataKey="awake_ms" stackId="sleep" fill="#fb923c" name="Awake" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="charts-grid" style={{ marginTop: '1rem' }}>
        <div className="chart-card">
          <h3>Daily training intensity</h3>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={strainData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="apple_active_energy" fill="#2563eb" name="Active energy (cal)" radius={[3,3,0,0]} />
              <Line type="monotone" dataKey="whoop_strain" stroke="#16a34a" strokeWidth={2} dot={false} name="Strain (WHOOP)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Training load trend (7d avg)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.strain.rolling_7d_load}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={false} name="7d avg load" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
