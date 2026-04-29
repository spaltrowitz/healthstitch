import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, LineChart, Line, XAxis, YAxis, Tooltip,
  BarChart, Bar, Legend, ComposedChart, Area, ReferenceArea, CartesianGrid
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

function shortDate(d) {
  if (!d) return d;
  return d.replace(/^20(\d{2})-/, '$1-');
}

function Section({ title, subtitle, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="chart-card" style={{ marginBottom: '0.75rem' }}>
      <div onClick={() => setOpen(!open)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0 }}>{title}</h3>
          {subtitle && <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.15rem 0 0' }}>{subtitle}</p>}
        </div>
        <span style={{ color: '#94a3b8', transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
      </div>
      {open && <div style={{ marginTop: '0.75rem' }}>{children}</div>}
    </div>
  );
}

const TOOLTIP = { contentStyle: { fontSize: '0.8rem', borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } };
const AXIS = { tick: { fontSize: 10, fill: '#94a3b8' }, axisLine: false, tickLine: false };

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
    apiRequest(url, { token }).then(setData).catch((err) => setError(err.message));
  }, [range, source, customFrom, customTo, token]);

  useEffect(() => {
    let fromStr, toStr;
    if (customFrom && customTo) { fromStr = customFrom; toStr = customTo; }
    else {
      const days = range === 'all' ? 3650 : Number(range);
      const from = new Date(); from.setDate(from.getDate() - days);
      fromStr = from.toISOString().slice(0, 10); toStr = new Date().toISOString().slice(0, 10);
    }
    apiRequest(`/dashboard/device-comparison?metric=${compMetric}&from=${fromStr}&to=${toStr}`, { token })
      .then(setCompData).catch(() => {});
  }, [compMetric, range, customFrom, customTo, token]);

  const hrvData = useMemo(() => data ? mergeByDate(data.hrv, (r) => ({ [`${r.source}_${r.metric_type}`]: Math.round(r.value * 10) / 10 })) : [], [data]);
  const restingData = useMemo(() => data ? mergeByDate(data.resting_hr, (r) => ({ [`${r.source}_rhr`]: Math.round(r.value) })) : [], [data]);
  const sleepData = useMemo(() => data ? mergeByDate(data.sleep, (r) => ({
    [`${r.source}_sleep`]: +(r.total_duration_ms / 3600000).toFixed(1),
    ...(r.source === 'whoop' && r.sleep_need_ms ? { whoop_need: +(r.sleep_need_ms / 3600000).toFixed(1) } : {})
  })) : [], [data]);
  const sleepStageData = useMemo(() => data?.sleep_stages ? data.sleep_stages.map(r => ({
    date: r.date,
    deep: r.slow_wave_ms ? +(r.slow_wave_ms / 3600000).toFixed(2) : 0,
    rem: r.rem_ms ? +(r.rem_ms / 3600000).toFixed(2) : 0,
    light: r.light_ms ? +(r.light_ms / 3600000).toFixed(2) : 0,
    awake: r.awake_ms ? +(r.awake_ms / 3600000).toFixed(2) : 0
  })) : [], [data]);
  const strainData = useMemo(() => data ? mergeByDate(
    [...data.strain.whoop.map(d => ({ ...d, type: 'w' })), ...data.strain.apple_load.map(d => ({ ...d, type: 'a' }))],
    (r) => r.type === 'w' ? { strain: r.whoop_strain } : { active_cal: r.apple_active_energy }
  ) : [], [data]);

  // Compute baseline ranges for shading
  const hrvBaseline = useMemo(() => {
    if (!hrvData.length) return null;
    const vals = hrvData.map(d => d.whoop_hrv_rmssd || d.apple_watch_hrv_sdnn).filter(Boolean);
    if (vals.length < 3) return null;
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length);
    return { low: Math.round(avg - std), high: Math.round(avg + std) };
  }, [hrvData]);

  const rhrBaseline = useMemo(() => {
    if (!restingData.length) return null;
    const vals = restingData.map(d => d.whoop_rhr || d.apple_watch_rhr).filter(Boolean);
    if (vals.length < 3) return null;
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length);
    return { low: Math.round(avg - std), high: Math.round(avg + std) };
  }, [restingData]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Loading trends...</p>;

  return (
    <section>
      <h2>Deep Dive</h2>
      <div className="controls-inline">
        <DateRangeSelector value={range} onChange={(v) => { setCustomFrom(null); setCustomTo(null); setRange(v); }}
          onCustomRange={(from, to) => { setCustomFrom(from); setCustomTo(to); }} />
        <SourceToggle value={source} onChange={setSource} />
      </div>

      <Section title="Heart Rate Variability" subtitle="Higher = better recovery. Shaded band = your normal range." defaultOpen={true}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={hrvData}>
            <defs>
              <linearGradient id="gApple" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient>
              <linearGradient id="gWhoop" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16a34a" stopOpacity={0.15}/><stop offset="95%" stopColor="#16a34a" stopOpacity={0}/></linearGradient>
            </defs>
            <XAxis dataKey="date" {...AXIS} tickFormatter={shortDate} />
            <YAxis {...AXIS} width={35} domain={[hrvBaseline ? hrvBaseline.low - 10 : 'dataMin - 10', 'dataMax + 10']} />
            {hrvBaseline && <ReferenceArea y1={hrvBaseline.low} y2={hrvBaseline.high} fill="#8b5cf6" fillOpacity={0.06} />}
            <Tooltip {...TOOLTIP} />
            <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '0.5rem' }} />
            <Area type="monotone" dataKey="apple_watch_hrv_sdnn" stroke="#2563eb" fill="url(#gApple)" strokeWidth={2.5} dot={false} name="Apple SDNN" />
            <Area type="monotone" dataKey="whoop_hrv_rmssd" stroke="#16a34a" fill="url(#gWhoop)" strokeWidth={2.5} dot={false} name="WHOOP RMSSD" />
          </AreaChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Resting Heart Rate" subtitle="Lower = better fitness. Shaded band = your normal range.">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={restingData}>
            <defs>
              <linearGradient id="gAppleR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.12}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient>
              <linearGradient id="gWhoopR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16a34a" stopOpacity={0.12}/><stop offset="95%" stopColor="#16a34a" stopOpacity={0}/></linearGradient>
            </defs>
            <XAxis dataKey="date" {...AXIS} tickFormatter={shortDate} />
            <YAxis {...AXIS} width={35} domain={[rhrBaseline ? rhrBaseline.low - 5 : 'dataMin - 5', 'dataMax + 5']} />
            {rhrBaseline && <ReferenceArea y1={rhrBaseline.low} y2={rhrBaseline.high} fill="#ef4444" fillOpacity={0.05} />}
            <Tooltip {...TOOLTIP} />
            <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '0.5rem' }} />
            <Area type="monotone" dataKey="apple_watch_rhr" stroke="#2563eb" fill="url(#gAppleR)" strokeWidth={2.5} dot={false} name="Apple Watch" />
            <Area type="monotone" dataKey="whoop_rhr" stroke="#16a34a" fill="url(#gWhoopR)" strokeWidth={2.5} dot={false} name="WHOOP" />
          </AreaChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Sleep Duration" subtitle="Bars = actual sleep. Dashed line = WHOOP's recommended sleep need.">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={sleepData}>
            <XAxis dataKey="date" {...AXIS} tickFormatter={shortDate} />
            <YAxis {...AXIS} width={30} domain={[0, 'dataMax + 1']} unit="h" />
            <Tooltip {...TOOLTIP} formatter={(v) => `${v}h`} />
            <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '0.5rem' }} />
            <Bar dataKey="apple_watch_sleep" fill="#2563eb" name="Apple" radius={[6,6,0,0]} opacity={0.8} />
            <Bar dataKey="whoop_sleep" fill="#16a34a" name="WHOOP" radius={[6,6,0,0]} opacity={0.8} />
            <Line type="monotone" dataKey="whoop_need" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Sleep need" />
          </ComposedChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Sleep Stages" subtitle="WHOOP only. Deep sleep repairs body, REM consolidates memory. Values in hours." defaultOpen={false}>
        <ResponsiveContainer width="100%" height={220}>
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
      </Section>

      <Section title="Training Load" subtitle="WHOOP strain (0-21 scale) and Apple active calories on separate axes." defaultOpen={false}>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={strainData}>
            <XAxis dataKey="date" {...AXIS} tickFormatter={shortDate} />
            <YAxis yAxisId="strain" {...AXIS} width={30} domain={[0, 21]} />
            <YAxis yAxisId="cal" orientation="right" {...AXIS} width={40} />
            <Tooltip {...TOOLTIP} />
            <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '0.5rem' }} />
            <Bar yAxisId="cal" dataKey="active_cal" fill="#2563eb" name="Apple cal" radius={[6,6,0,0]} opacity={0.5} />
            <Area yAxisId="strain" type="monotone" dataKey="strain" stroke="#16a34a" fill="#16a34a" fillOpacity={0.1} strokeWidth={2.5} dot={false} name="WHOOP strain" />
          </ComposedChart>
        </ResponsiveContainer>
      </Section>

      <Section title="7-Day Rolling Load" subtitle="Combined training load trend. A drop during recovery is expected." defaultOpen={false}>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data.strain.rolling_7d_load}>
            <defs>
              <linearGradient id="gLoad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
            </defs>
            <XAxis dataKey="date" {...AXIS} tickFormatter={shortDate} />
            <YAxis {...AXIS} width={35} />
            <Tooltip {...TOOLTIP} />
            <Area type="monotone" dataKey="value" stroke="#ef4444" fill="url(#gLoad)" strokeWidth={2.5} dot={false} name="7d avg" />
          </AreaChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Device Comparison" subtitle="Side-by-side metric comparison with delta line." defaultOpen={false}>
        <div className="controls-inline" style={{ marginBottom: '0.5rem' }}>
          <div className="selector-row">
            <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Metric</label>
            <select value={compMetric} onChange={(e) => setCompMetric(e.target.value)}>
              <option value="sleep_duration">Sleep Duration</option>
              <option value="resting_hr">Resting Heart Rate</option>
            </select>
          </div>
        </div>
        {compData && compData.rows.length > 0 && (
          <>
            {compData.average_delta != null && (
              <div style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: 8, marginBottom: '0.5rem', fontSize: '0.82rem' }}>
                <strong>Avg difference:</strong>{' '}
                {compMetric === 'sleep_duration'
                  ? `${Math.abs(compData.average_delta / 3600000).toFixed(1)}h — ${compData.average_delta > 0 ? 'WHOOP higher' : 'Apple higher'}`
                  : `${Math.abs(compData.average_delta).toFixed(1)} bpm — ${compData.average_delta > 0 ? 'WHOOP higher' : 'Apple higher'}`}
              </div>
            )}
            <ResponsiveContainer width="100%" height={200}>
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
                <Line type="monotone" dataKey="whoop" stroke="#16a34a" dot={false} strokeWidth={2} name="WHOOP" />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </Section>
    </section>
  );
}
