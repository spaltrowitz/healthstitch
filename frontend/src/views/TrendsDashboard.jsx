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

const CHART_DESCRIPTIONS = {
  hrv: 'Higher HRV = better recovery. Apple uses SDNN, WHOOP uses RMSSD — different calculations, so the numbers won\'t match, but trends should move together.',
  rhr: 'Lower resting HR generally means better cardiovascular fitness. A spike can indicate stress, illness, or poor sleep.',
  sleep: 'Bars show actual sleep from each device. The yellow line is WHOOP\'s recommended sleep need based on your strain and sleep debt.',
  stages: 'Deep sleep repairs your body, REM consolidates memory. Aim for 15-20% deep and 20-25% REM.',
  strain: 'WHOOP strain (0-21) vs Apple active calories. Both measure daily exertion differently.',
  load: 'A rising trend means you\'re training more. A sudden drop (like post-surgery) is normal during recovery.',
  comparison: 'The delta line shows the difference between devices. Consistent offsets are normal; large swings may indicate one device had a poor reading.'
};

export default function TrendsDashboard({ token }) {
  const [range, setRange] = useState('30');
  const [source, setSource] = useState('both');
  const [data, setData] = useState(null);
  const [compMetric, setCompMetric] = useState('sleep_duration');
  const [compData, setCompData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest(`/dashboard/trends?range=${range}&source=${source}`, { token })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [range, source, token]);

  useEffect(() => {
    const days = range === 'all' ? 3650 : Number(range);
    const from = new Date();
    from.setDate(from.getDate() - days);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = new Date().toISOString().slice(0, 10);
    apiRequest(`/dashboard/device-comparison?metric=${compMetric}&from=${fromStr}&to=${toStr}`, { token })
      .then(setCompData)
      .catch(() => {});
  }, [compMetric, range, token]);

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
      <h2>Trends</h2>
      <div className="controls-inline">
        <DateRangeSelector value={range} onChange={setRange} />
        <SourceToggle value={source} onChange={setSource} />
      </div>

      <div className="chart-card">
        <h3>Heart Rate Variability</h3>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '-0.25rem 0 0.5rem' }}>{CHART_DESCRIPTIONS.hrv}</p>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={hrvData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
            <Tooltip contentStyle={{ fontSize: '0.8rem', borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
            <Line type="monotone" dataKey="apple_watch_hrv_sdnn" stroke="#2563eb" dot={false} strokeWidth={2} name="Apple SDNN" />
            <Line type="monotone" dataKey="whoop_hrv_rmssd" stroke="#16a34a" dot={false} strokeWidth={2} name="WHOOP RMSSD" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Resting Heart Rate</h3>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '-0.25rem 0 0.5rem' }}>{CHART_DESCRIPTIONS.rhr}</p>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={restingData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
            <Tooltip contentStyle={{ fontSize: '0.8rem', borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
            <Line type="monotone" dataKey="apple_watch_resting_hr" stroke="#2563eb" dot={false} strokeWidth={2} name="Apple Watch" />
            <Line type="monotone" dataKey="whoop_resting_hr" stroke="#16a34a" dot={false} strokeWidth={2} name="WHOOP" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Sleep Duration vs Need</h3>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '-0.25rem 0 0.5rem' }}>{CHART_DESCRIPTIONS.sleep}</p>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={sleepData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
            <Tooltip contentStyle={{ fontSize: '0.8rem', borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
            <Bar dataKey="apple_watch_sleep" fill="#2563eb" name="Apple (h)" radius={[4,4,0,0]} />
            <Bar dataKey="whoop_sleep" fill="#16a34a" name="WHOOP (h)" radius={[4,4,0,0]} />
            <Area dataKey="whoop_sleep_need" fill="#fbbf2433" stroke="#f59e0b" strokeWidth={2} name="Sleep need (h)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Sleep Stages (WHOOP)</h3>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '-0.25rem 0 0.5rem' }}>{CHART_DESCRIPTIONS.stages}</p>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data.sleep_stages}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
            <Tooltip contentStyle={{ fontSize: '0.8rem', borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
            <Bar dataKey="slow_wave_ms" stackId="sleep" fill="#3b82f6" name="Deep" radius={[0,0,0,0]} />
            <Bar dataKey="rem_ms" stackId="sleep" fill="#8b5cf6" name="REM" />
            <Bar dataKey="light_ms" stackId="sleep" fill="#93c5fd" name="Light" />
            <Bar dataKey="awake_ms" stackId="sleep" fill="#fdba74" name="Awake" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Daily Strain & Active Energy</h3>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '-0.25rem 0 0.5rem' }}>{CHART_DESCRIPTIONS.strain}</p>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={strainData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
            <Tooltip contentStyle={{ fontSize: '0.8rem', borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
            <Bar dataKey="apple_active_energy" fill="#2563eb" name="Apple active cal" radius={[4,4,0,0]} />
            <Line type="monotone" dataKey="whoop_strain" stroke="#16a34a" dot={false} strokeWidth={2} name="WHOOP strain" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>7-Day Training Load</h3>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '-0.25rem 0 0.5rem' }}>{CHART_DESCRIPTIONS.load}</p>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data.strain.rolling_7d_load}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
            <Tooltip contentStyle={{ fontSize: '0.8rem', borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <Line type="monotone" dataKey="value" stroke="#ef4444" dot={false} strokeWidth={2.5} name="7d avg load" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Device Comparison */}
      <h3 style={{ marginTop: '1.5rem' }}>Device Comparison</h3>
      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '-0.25rem 0 0.75rem' }}>{CHART_DESCRIPTIONS.comparison}</p>
      <div className="controls-inline">
        <div className="selector-row">
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Compare metric</label>
          <select value={compMetric} onChange={(e) => setCompMetric(e.target.value)}>
            <option value="sleep_duration">Sleep Duration</option>
            <option value="resting_hr">Resting Heart Rate</option>
          </select>
        </div>
      </div>

      {compData && compData.rows.length > 0 && (
        <>
          {compData.average_delta != null && (
            <div className="card" style={{ background: '#f8fafc' }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                <strong>Average difference:</strong>{' '}
                {compMetric === 'sleep_duration'
                  ? `${Math.abs(compData.average_delta / 3600000).toFixed(1)}h — ${compData.average_delta > 0 ? 'WHOOP records more' : 'Apple Watch records more'}`
                  : `${Math.abs(compData.average_delta).toFixed(1)} bpm — ${compData.average_delta > 0 ? 'WHOOP reads higher' : 'Apple Watch reads higher'}`
                }
              </p>
            </div>
          )}
          <div className="chart-card">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={compData.rows.map(r => ({
                ...r,
                apple: compMetric === 'sleep_duration' && r.apple_watch_value ? r.apple_watch_value / 3600000 : r.apple_watch_value,
                whoop: compMetric === 'sleep_duration' && r.whoop_value ? r.whoop_value / 3600000 : r.whoop_value,
                delta: compMetric === 'sleep_duration' && r.delta ? r.delta / 3600000 : r.delta
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="apple" stroke="#2563eb" dot={false} name="⌚ Apple Watch" />
                <Line type="monotone" dataKey="whoop" stroke="#16a34a" dot={false} name="⌚ WHOOP" />
                <Line type="monotone" dataKey="delta" stroke="#ef4444" dot={false} name="Δ Delta" strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
