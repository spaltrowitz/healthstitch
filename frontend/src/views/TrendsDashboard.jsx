import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, LineChart, Line, XAxis, YAxis, Tooltip,
  BarChart, Bar, Legend, ComposedChart, Area, ReferenceArea
} from 'recharts';
import { apiRequest } from '../api/client';
import DateRangeSelector from '../components/DateRangeSelector';
import SourceToggle from '../components/SourceToggle';

function mergeByDate(rows, keyMap) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.date)) map.set(row.date, { date: row.date });
    map.set(row.date, { ...map.get(row.date), ...keyMap(row) });
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function shortDate(d) { return d ? d.replace(/^20(\d{2})-/, '$1-') : d; }

const TOOLTIP = { contentStyle: { fontSize: '0.8rem', borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } };
const AXIS = { tick: { fontSize: 10, fill: '#94a3b8' }, axisLine: false, tickLine: false };

const METRICS = [
  { id: 'hrv', label: 'Heart Rate Variability' },
  { id: 'rhr', label: 'Resting Heart Rate' },
  { id: 'sleep', label: 'Sleep Duration' },
  { id: 'stages', label: 'Sleep Stages' },
  { id: 'strain', label: 'Training Load' },
  { id: 'comparison', label: 'Device Comparison' }
];

function calcRange(data, key1, key2) {
  const vals = data.map(d => d[key1] || d[key2]).filter(Boolean);
  if (vals.length < 3) return null;
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  const std = Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length);
  return { low: Math.round(avg - std), high: Math.round(avg + std) };
}

export default function TrendsDashboard({ token }) {
  const [range, setRange] = useState('30');
  const [source, setSource] = useState('both');
  const [metric, setMetric] = useState('hrv');
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
    apiRequest(url, { token }).then(setData).catch((err) => setError(err.message));
  }, [range, source, customFrom, customTo, token]);

  useEffect(() => {
    if (metric !== 'comparison') return;
    let fromStr, toStr;
    if (customFrom && customTo) { fromStr = customFrom; toStr = customTo; }
    else {
      const days = range === 'all' ? 3650 : Number(range);
      const from = new Date(); from.setDate(from.getDate() - days);
      fromStr = from.toISOString().slice(0, 10); toStr = new Date().toISOString().slice(0, 10);
    }
    apiRequest(`/dashboard/device-comparison?metric=${compMetric}&from=${fromStr}&to=${toStr}`, { token })
      .then(setCompData).catch(() => {});
  }, [compMetric, range, customFrom, customTo, metric, token]);

  const hrvData = useMemo(() => data ? mergeByDate(data.hrv, (r) => ({ [`${r.source}_${r.metric_type}`]: Math.round(r.value * 10) / 10 })) : [], [data]);
  const restingData = useMemo(() => data ? mergeByDate(data.resting_hr, (r) => ({ [`${r.source}_rhr`]: Math.round(r.value) })) : [], [data]);
  const sleepData = useMemo(() => data ? mergeByDate(data.sleep, (r) => ({
    [`${r.source}_sleep`]: +(r.total_duration_ms / 3600000).toFixed(1),
    ...(r.source === 'whoop' && r.sleep_need_ms ? { whoop_need: +(r.sleep_need_ms / 3600000).toFixed(1) } : {})
  })) : [], [data]);
  const sleepStageData = useMemo(() => data?.sleep_stages ? data.sleep_stages.map(r => ({
    date: r.date, deep: +(r.slow_wave_ms / 3600000 || 0).toFixed(2), rem: +(r.rem_ms / 3600000 || 0).toFixed(2),
    light: +(r.light_ms / 3600000 || 0).toFixed(2), awake: +(r.awake_ms / 3600000 || 0).toFixed(2)
  })) : [], [data]);
  const strainData = useMemo(() => data ? mergeByDate(
    [...data.strain.whoop.map(d => ({ ...d, type: 'w' })), ...data.strain.apple_load.map(d => ({ ...d, type: 'a' }))],
    (r) => r.type === 'w' ? { strain: r.whoop_strain } : { active_cal: r.apple_active_energy }
  ) : [], [data]);

  const hrvRange = useMemo(() => calcRange(hrvData, 'whoop_hrv_rmssd', 'apple_watch_hrv_sdnn'), [hrvData]);
  const rhrRange = useMemo(() => calcRange(restingData, 'whoop_rhr', 'apple_watch_rhr'), [restingData]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Loading trends...</p>;

  return (
    <section>
      <h2>Trends</h2>
      <div className="controls-inline">
        <div className="selector-row">
          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>View</label>
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <DateRangeSelector value={range} onChange={(v) => { setCustomFrom(null); setCustomTo(null); setRange(v); }}
          onCustomRange={(from, to) => { setCustomFrom(from); setCustomTo(to); }} />
        <SourceToggle value={source} onChange={setSource} />
      </div>

      <div className="chart-card">
        {metric === 'hrv' && (
          <>
            <h3>Heart Rate Variability</h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '-0.15rem 0 0.5rem' }}>Higher = better recovery. Shaded band = your normal range. Devices use different methods — compare trends, not numbers.</p>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={hrvData}>
                <defs>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient>
                  <linearGradient id="gW" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15}/><stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/></linearGradient>
                </defs>
                <XAxis dataKey="date" {...AXIS} tickFormatter={shortDate} />
                <YAxis {...AXIS} width={35} domain={[hrvRange ? hrvRange.low - 10 : 'dataMin - 10', 'dataMax + 10']} />
                {hrvRange && <ReferenceArea y1={hrvRange.low} y2={hrvRange.high} fill="#8b5cf6" fillOpacity={0.06} />}
                <Tooltip {...TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '0.5rem' }} />
                <Area type="monotone" dataKey="apple_watch_hrv_sdnn" stroke="#2563eb" fill="url(#gA)" strokeWidth={2.5} dot={false} name="Apple Watch" />
                <Area type="monotone" dataKey="whoop_hrv_rmssd" stroke="#7c3aed" fill="url(#gW)" strokeWidth={2.5} dot={false} name="WHOOP" />
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}

        {metric === 'rhr' && (
          <>
            <h3>Resting Heart Rate</h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '-0.15rem 0 0.5rem' }}>Lower = better fitness. Shaded band = your normal range.</p>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={restingData}>
                <defs>
                  <linearGradient id="gAR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.12}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient>
                  <linearGradient id="gWR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7c3aed" stopOpacity={0.12}/><stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/></linearGradient>
                </defs>
                <XAxis dataKey="date" {...AXIS} tickFormatter={shortDate} />
                <YAxis {...AXIS} width={35} domain={[rhrRange ? rhrRange.low - 5 : 'dataMin - 5', 'dataMax + 5']} />
                {rhrRange && <ReferenceArea y1={rhrRange.low} y2={rhrRange.high} fill="#ef4444" fillOpacity={0.05} />}
                <Tooltip {...TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '0.5rem' }} />
                <Area type="monotone" dataKey="apple_watch_rhr" stroke="#2563eb" fill="url(#gAR)" strokeWidth={2.5} dot={false} name="Apple Watch" />
                <Area type="monotone" dataKey="whoop_rhr" stroke="#7c3aed" fill="url(#gWR)" strokeWidth={2.5} dot={false} name="WHOOP" />
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}

        {metric === 'sleep' && (
          <>
            <h3>Sleep Duration</h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '-0.15rem 0 0.5rem' }}>Bars = actual sleep. Dashed line = WHOOP sleep need.</p>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={sleepData}>
                <XAxis dataKey="date" {...AXIS} tickFormatter={shortDate} />
                <YAxis {...AXIS} width={30} domain={[0, 'dataMax + 1']} unit="h" />
                <Tooltip {...TOOLTIP} formatter={(v) => `${v}h`} />
                <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '0.5rem' }} />
                <Bar dataKey="apple_watch_sleep" fill="#2563eb" name="Apple" radius={[6,6,0,0]} opacity={0.8} />
                <Bar dataKey="whoop_sleep" fill="#7c3aed" name="WHOOP" radius={[6,6,0,0]} opacity={0.8} />
                <Line type="monotone" dataKey="whoop_need" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Sleep need" />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}

        {metric === 'stages' && (
          <>
            <h3>Sleep Stages</h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '-0.15rem 0 0.5rem' }}>WHOOP only. Aim for 15-20% deep sleep and 20-25% REM.</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={sleepStageData}>
                <XAxis dataKey="date" {...AXIS} tickFormatter={shortDate} />
                <YAxis {...AXIS} width={30} unit="h" />
                <Tooltip {...TOOLTIP} formatter={(v) => `${v.toFixed(1)}h`} />
                <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '0.5rem' }} />
                <Bar dataKey="deep" stackId="s" fill="#3b82f6" name="Deep" />
                <Bar dataKey="rem" stackId="s" fill="#8b5cf6" name="REM" />
                <Bar dataKey="light" stackId="s" fill="#93c5fd" name="Light" />
                <Bar dataKey="awake" stackId="s" fill="#fdba74" name="Awake" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}

        {metric === 'strain' && (
          <>
            <h3>Training Load</h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '-0.15rem 0 0.5rem' }}>WHOOP strain (left axis, 0-21) vs Apple active calories (right axis).</p>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={strainData}>
                <XAxis dataKey="date" {...AXIS} tickFormatter={shortDate} />
                <YAxis yAxisId="strain" {...AXIS} width={30} domain={[0, 21]} />
                <YAxis yAxisId="cal" orientation="right" {...AXIS} width={40} />
                <Tooltip {...TOOLTIP} formatter={(v) => typeof v === 'number' ? v.toFixed(2) : v} />
                <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '0.5rem' }} />
                <Bar yAxisId="cal" dataKey="active_cal" fill="#2563eb" name="Apple cal" radius={[6,6,0,0]} opacity={0.5} />
                <Area yAxisId="strain" type="monotone" dataKey="strain" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.1} strokeWidth={2.5} dot={false} name="WHOOP strain" />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}

        {metric === 'comparison' && (
          <>
            <h3>Device Comparison</h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '-0.15rem 0 0.5rem' }}>Side-by-side metric comparison between devices.</p>
            <div style={{ marginBottom: '0.5rem' }}>
              <select value={compMetric} onChange={(e) => setCompMetric(e.target.value)} style={{ fontSize: '0.82rem' }}>
                <option value="sleep_duration">Sleep Duration</option>
                <option value="resting_hr">Resting Heart Rate</option>
              </select>
            </div>
            {compData?.rows?.length > 0 && (
              <>
                {compData.average_delta != null && (
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>
                    Avg difference: <strong>
                    {compMetric === 'sleep_duration'
                      ? `${Math.abs(compData.average_delta / 3600000).toFixed(1)}h`
                      : `${Math.abs(compData.average_delta).toFixed(1)} bpm`}
                    </strong> — {compData.average_delta > 0 ? 'WHOOP higher' : 'Apple higher'}
                  </p>
                )}
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={compData.rows.map(r => ({
                    date: r.date,
                    apple: compMetric === 'sleep_duration' && r.apple_watch_value ? +(r.apple_watch_value / 3600000).toFixed(1) : r.apple_watch_value ? +r.apple_watch_value.toFixed(1) : null,
                    whoop: compMetric === 'sleep_duration' && r.whoop_value ? +(r.whoop_value / 3600000).toFixed(1) : r.whoop_value ? +r.whoop_value.toFixed(1) : null
                  }))}>
                    <XAxis dataKey="date" {...AXIS} tickFormatter={shortDate} />
                    <YAxis {...AXIS} width={35} />
                    <Tooltip {...TOOLTIP} />
                    <Legend wrapperStyle={{ fontSize: '0.72rem' }} />
                    <Line type="monotone" dataKey="apple" stroke="#2563eb" dot={false} strokeWidth={2} name="Apple Watch" />
                    <Line type="monotone" dataKey="whoop" stroke="#7c3aed" dot={false} strokeWidth={2} name="WHOOP" />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
