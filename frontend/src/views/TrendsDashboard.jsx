import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  ComposedChart,
  Area,
  CartesianGrid,
  ReferenceLine
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

function shortDate(d) {
  if (!d) return d;
  return d.replace(/^20(\d{2})-/, '$1-');
}

export default function TrendsDashboard({ token }) {
  const [range, setRange] = useState('30');
  const [source, setSource] = useState('both');
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo, setCustomTo] = useState(null);
  const [data, setData] = useState(null);
  const [compMetric, setCompMetric] = useState('sleep_duration');
  const [compData, setCompData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const url = customFrom && customTo
      ? `/dashboard/trends?from=${customFrom}&to=${customTo}&source=${source}`
      : `/dashboard/trends?range=${range}&source=${source}`;
    apiRequest(url, { token })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [range, source, customFrom, customTo, token]);

  useEffect(() => {
    let fromStr, toStr;
    if (customFrom && customTo) {
      fromStr = customFrom;
      toStr = customTo;
    } else {
      const days = range === 'all' ? 3650 : Number(range);
      const from = new Date();
      from.setDate(from.getDate() - days);
      fromStr = from.toISOString().slice(0, 10);
      toStr = new Date().toISOString().slice(0, 10);
    }
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
        <DateRangeSelector value={range} onChange={(v) => { setCustomFrom(null); setCustomTo(null); setRange(v); }}
          onCustomRange={(from, to) => { setCustomFrom(from); setCustomTo(to); }} />
        <SourceToggle value={source} onChange={setSource} />
      </div>

      <div className="chart-card">
        <h3>Heart Rate Variability</h3>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '-0.25rem 0 0.5rem' }}>{CHART_DESCRIPTIONS.hrv}</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={hrvData}>
            <defs>
              <linearGradient id="appleHrv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="whoopHrv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={shortDate} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={35} />
            <Tooltip contentStyle={{ fontSize: '0.8rem', borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
            <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '0.5rem' }} />
            <Area type="monotone" dataKey="apple_watch_hrv_sdnn" stroke="#2563eb" fill="url(#appleHrv)" strokeWidth={2.5} dot={false} name="Apple SDNN" />
            <Area type="monotone" dataKey="whoop_hrv_rmssd" stroke="#16a34a" fill="url(#whoopHrv)" strokeWidth={2.5} dot={false} name="WHOOP RMSSD" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Resting Heart Rate</h3>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '-0.25rem 0 0.5rem' }}>{CHART_DESCRIPTIONS.rhr}</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={restingData}>
            <defs>
              <linearGradient id="appleRhr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="whoopRhr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={shortDate} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={35} />
            <Tooltip contentStyle={{ fontSize: '0.8rem', borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
            <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '0.5rem' }} />
            <Area type="monotone" dataKey="apple_watch_resting_hr" stroke="#2563eb" fill="url(#appleRhr)" strokeWidth={2.5} dot={false} name="Apple Watch" />
            <Area type="monotone" dataKey="whoop_resting_hr" stroke="#16a34a" fill="url(#whoopRhr)" strokeWidth={2.5} dot={false} name="WHOOP" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Sleep Duration vs Need</h3>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '-0.25rem 0 0.5rem' }}>{CHART_DESCRIPTIONS.sleep}</p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={sleepData}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={shortDate} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={35} />
            <Tooltip contentStyle={{ fontSize: '0.8rem', borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
            <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '0.5rem' }} />
            <Bar dataKey="apple_watch_sleep" fill="#2563eb" name="Apple (h)" radius={[6,6,0,0]} opacity={0.8} />
            <Bar dataKey="whoop_sleep" fill="#16a34a" name="WHOOP (h)" radius={[6,6,0,0]} opacity={0.8} />
            <Line type="monotone" dataKey="whoop_sleep_need" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Sleep need (h)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Sleep Stages (WHOOP)</h3>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '-0.25rem 0 0.5rem' }}>{CHART_DESCRIPTIONS.stages}</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.sleep_stages}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={shortDate} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={35} />
            <Tooltip contentStyle={{ fontSize: '0.8rem', borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
            <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '0.5rem' }} />
            <Bar dataKey="slow_wave_ms" stackId="sleep" fill="#3b82f6" name="Deep" />
            <Bar dataKey="rem_ms" stackId="sleep" fill="#8b5cf6" name="REM" />
            <Bar dataKey="light_ms" stackId="sleep" fill="#93c5fd" name="Light" />
            <Bar dataKey="awake_ms" stackId="sleep" fill="#fdba74" name="Awake" radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Daily Strain & Active Energy</h3>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '-0.25rem 0 0.5rem' }}>{CHART_DESCRIPTIONS.strain}</p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={strainData}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={shortDate} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={35} />
            <Tooltip contentStyle={{ fontSize: '0.8rem', borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
            <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '0.5rem' }} />
            <Bar dataKey="apple_active_energy" fill="#2563eb" name="Apple active cal" radius={[6,6,0,0]} opacity={0.7} />
            <Line type="monotone" dataKey="whoop_strain" stroke="#16a34a" dot={false} strokeWidth={2.5} name="WHOOP strain" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>7-Day Training Load</h3>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '-0.25rem 0 0.5rem' }}>{CHART_DESCRIPTIONS.load}</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.strain.rolling_7d_load}>
            <defs>
              <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={shortDate} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={35} />
            <Tooltip contentStyle={{ fontSize: '0.8rem', borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
            <Area type="monotone" dataKey="value" stroke="#ef4444" fill="url(#loadGrad)" strokeWidth={2.5} dot={false} name="7d avg load" />
          </AreaChart>
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
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={shortDate} />
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
