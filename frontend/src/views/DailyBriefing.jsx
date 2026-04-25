import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, YAxis, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar, XAxis
} from 'recharts';
import { apiRequest } from '../api/client';

const ZONE_COLORS = { red: '#ef4444', yellow: '#f59e0b', green: '#22c55e' };
const STAGE_COLORS = { deep: '#3b82f6', rem: '#8b5cf6', light: '#60a5fa', awake: '#f97316' };

function GaugeRing({ value, max, color, size = 120, label, sublabel, tooltip, rangeLabel, source }) {
  const pct = value != null ? Math.min(value / max, 1) : 0;
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  return (
    <div style={{ textAlign: 'center' }} title={tooltip}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={10} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div style={{ marginTop: -size/2 - 12, position: 'relative', height: size/2 + 12 }}>
        <div style={{ fontSize: size > 100 ? '1.6rem' : '1.2rem', fontWeight: 700, color, paddingTop: size > 100 ? 8 : 4 }}>
          {value ?? '--'}
        </div>
      </div>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginTop: 2, cursor: tooltip ? 'help' : 'default', borderBottom: tooltip ? '1px dotted #cbd5e1' : 'none', display: 'inline-block' }}>{label}</div>
      {source && <div style={{ fontSize: '0.6rem', color: source === 'WHOOP' ? '#16a34a' : '#2563eb', fontWeight: 600 }}>{source}</div>}
      {rangeLabel && <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{rangeLabel}</div>}
      {sublabel && !source && <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{sublabel}</div>}
    </div>
  );
}

function Sparkline({ data, dataKey, color, height = 44 }) {
  if (!data || data.length < 2) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#cbd5e1', fontSize: '0.7rem' }}>—</span></div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Tooltip contentStyle={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', borderRadius: 6 }}
          formatter={(v) => [typeof v === 'number' ? v.toFixed(1) : v]} />
        <Line type="monotone" dataKey={dataKey} stroke={color} dot={false} strokeWidth={2.5} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function SleepDonut({ apple, whoop, size = 140 }) {
  const stages = ['deep', 'rem', 'light', 'awake'];
  const labels = { deep: 'Deep', rem: 'REM', light: 'Light', awake: 'Awake' };

  function buildData(sleep) {
    if (!sleep) return [];
    return stages.map(s => ({
      name: labels[s],
      value: sleep[`${s}_min`] || 0,
      color: STAGE_COLORS[s]
    })).filter(d => d.value > 0);
  }

  const appleData = buildData(apple);
  const whoopData = buildData(whoop);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
      {appleData.length > 0 && (
        <div style={{ textAlign: 'center' }}>
          <ResponsiveContainer width={size} height={size}>
            <PieChart>
              <Pie data={appleData} cx="50%" cy="50%" innerRadius={size/2-28} outerRadius={size/2-8}
                dataKey="value" strokeWidth={0}>
                {appleData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v) => `${Math.floor(v/60)}h ${v%60}m`} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563eb', marginTop: -4 }}>⌚ Apple {apple?.total_hours}h</div>
        </div>
      )}
      {whoopData.length > 0 && (
        <div style={{ textAlign: 'center' }}>
          <ResponsiveContainer width={size} height={size}>
            <PieChart>
              <Pie data={whoopData} cx="50%" cy="50%" innerRadius={size/2-28} outerRadius={size/2-8}
                dataKey="value" strokeWidth={0}>
                {whoopData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v) => `${Math.floor(v/60)}h ${v%60}m`} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16a34a', marginTop: -4 }}>⌚ WHOOP {whoop?.total_hours}h</div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.25rem', fontSize: '0.7rem' }}>
        {stages.map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: STAGE_COLORS[s] }} />
            <span>{labels[s]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FactorBar({ label, value, maxValue, color, unit }) {
  const pct = value != null && maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.15rem' }}>
        <span style={{ color: '#64748b' }}>{label}</span>
        <strong style={{ color }}>{value != null ? `${value}${unit}` : '--'}</strong>
      </div>
      <div style={{ background: '#f1f5f9', borderRadius: 4, height: 8, overflow: 'hidden' }}>
        <div style={{ background: color, height: '100%', width: `${pct}%`, borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

export default function DailyBriefing({ token }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [scores, setScores] = useState(null);
  const [checkin, setCheckin] = useState(null);
  const [insights, setInsights] = useState(null);
  const [trends, setTrends] = useState(null);
  const [error, setError] = useState('');

  function shiftDate(days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    const today = new Date().toISOString().slice(0, 10);
    const newDate = d.toISOString().slice(0, 10);
    if (newDate <= today) setDate(newDate);
  }

  const isToday = date === new Date().toISOString().slice(0, 10);

  useEffect(() => {
    setScores(null);
    setCheckin(null);
    Promise.all([
      apiRequest(`/dashboard/score-explainer?date=${date}`, { token }),
      apiRequest(`/dashboard/morning-checkin?date=${date}`, { token }),
      apiRequest('/dashboard/insights', { token }),
      apiRequest('/dashboard/trends?range=7&source=both', { token })
    ]).then(([s, c, i, t]) => { setScores(s); setCheckin(c); setInsights(i); setTrends(t); })
      .catch((err) => setError(err.message));
  }, [token, date]);

  if (error) return <p className="error">{error}</p>;
  if (!scores || !checkin) return <p>Loading your daily briefing…</p>;

  const recovery = scores.scores?.whoop_recovery;
  const sleepScore = scores.scores?.whoop_sleep;
  const inRecovery = checkin.recovery_mode?.active;
  const apple = scores.sleep?.apple_watch;
  const whoop = scores.sleep?.whoop;

  const hrvData = trends?.hrv ? (() => {
    const map = new Map();
    for (const r of trends.hrv) {
      if (!map.has(r.date)) map.set(r.date, { date: r.date.slice(5) });
      const key = r.source === 'whoop' ? 'whoop' : 'apple';
      map.get(r.date)[key] = +r.value.toFixed(0);
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  })() : [];

  const rhrData = trends?.resting_hr ? (() => {
    const map = new Map();
    for (const r of trends.resting_hr) {
      if (!map.has(r.date)) map.set(r.date, { date: r.date.slice(5) });
      map.get(r.date)[r.source] = +r.value.toFixed(0);
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  })() : [];

  const sleepData = trends?.sleep ? (() => {
    const map = new Map();
    for (const r of trends.sleep) {
      if (!map.has(r.date)) map.set(r.date, { date: r.date.slice(5) });
      map.get(r.date)[r.source] = +(r.total_duration_ms / 3600000).toFixed(1);
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  })() : [];

  const allInsights = insights?.insights || [];
  const sleepInsights = allInsights.filter(i => i.title?.toLowerCase().includes('sleep') && i.type !== 'info');
  const hrvInsights = allInsights.filter(i => i.title?.toLowerCase().includes('hrv') || i.title?.toLowerCase().includes('heart rate variability'));
  const rhrInsights = allInsights.filter(i => i.title?.toLowerCase().includes('resting') || i.title?.toLowerCase().includes('heart rate:'));
  const usedTitles = new Set([...sleepInsights, ...hrvInsights, ...rhrInsights].map(i => i.title));
  const otherInsights = allInsights
    .filter(i => i.type !== 'info' && i.type !== 'comparison' && !i.title?.includes('Recovery Mode') && !usedTitles.has(i.title))
    .slice(0, 3);

  // Compute trend summaries
  function trendSummary(data, key1, key2, label, unit) {
    if (!data || data.length < 2) return null;
    const vals1 = data.map(d => d[key1]).filter(v => v != null);
    const vals2 = key2 ? data.map(d => d[key2]).filter(v => v != null) : [];
    const allVals = [...vals1, ...vals2];
    if (allVals.length < 2) return null;
    const avg = allVals.reduce((s, v) => s + v, 0) / allVals.length;
    const firstHalf = allVals.slice(0, Math.ceil(allVals.length / 2));
    const secondHalf = allVals.slice(Math.floor(allVals.length / 2));
    const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
    const pctChange = firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;
    const direction = pctChange > 5 ? 'up' : pctChange < -5 ? 'down' : 'stable';
    const agree = vals1.length > 0 && vals2.length > 0;
    return { avg: Math.round(avg * 10) / 10, pctChange, direction, agree, unit, label };
  }

  const hrvTrend = trendSummary(hrvData, 'apple', 'whoop', 'HRV', 'ms');
  const rhrTrend = trendSummary(rhrData, 'apple_watch', 'whoop', 'Resting HR', 'bpm');
  const sleepTrend = trendSummary(sleepData, 'apple_watch', 'whoop', 'Sleep', 'h');

  function trendText(t) {
    if (!t) return '';
    const arrow = t.direction === 'up' ? '↑' : t.direction === 'down' ? '↓' : '→';
    const dir = t.direction === 'stable' ? 'Stable' : `${t.direction === 'up' ? 'Up' : 'Down'} ${Math.abs(t.pctChange)}%`;
    const agree = t.agree ? ' · Devices aligned' : '';
    return `${arrow} ${dir} this week · Avg ${t.avg}${t.unit}${agree}`;
  }

  // Source labels for gauges
  const hrvSourceLabel = checkin.hrv?.source === 'whoop' ? 'WHOOP' : checkin.hrv?.source === 'apple_watch' ? 'Apple Watch' : null;
  const rhrSourceLabel = checkin.resting_hr?.source === 'whoop' ? 'WHOOP' : checkin.resting_hr?.source === 'apple_watch' ? 'Apple Watch' : null;
  const hrvBaseline = checkin.hrv?.baseline_90d_apple;
  const rhrBaseline = checkin.resting_hr?.baseline_30d_apple;

  return (
    <section>
      {/* Date navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button onClick={() => shiftDate(-1)} style={{ padding: '0.3rem 0.6rem', fontSize: '1rem' }}>←</button>
        <div style={{ textAlign: 'center' }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            style={{ border: 'none', fontSize: '1rem', fontWeight: 700, textAlign: 'center', background: 'transparent', cursor: 'pointer' }} />
          {isToday && <div style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600 }}>Today</div>}
        </div>
        <button onClick={() => shiftDate(1)} disabled={isToday}
          style={{ padding: '0.3rem 0.6rem', fontSize: '1rem', opacity: isToday ? 0.3 : 1 }}>→</button>
      </div>

      {/* Gauges row */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '0.5rem' }}>
          <GaugeRing
            value={recovery?.score} max={100}
            color={ZONE_COLORS[recovery?.zone] || '#94a3b8'}
            label="Recovery"
            source="WHOOP"
            tooltip="WHOOP Recovery: Combines HRV, resting HR, SpO2, skin temp, and respiratory rate measured during your deepest sleep. Green (67-100%) = ready to train. Yellow (34-66%) = moderate. Red (0-33%) = prioritize rest."
            rangeLabel={recovery?.zone === 'green' ? 'Green zone' : recovery?.zone === 'yellow' ? 'Yellow zone' : recovery?.zone === 'red' ? 'Red zone' : null}
          />
          <GaugeRing
            value={sleepScore?.score} max={100}
            color={sleepScore?.score >= 85 ? '#22c55e' : sleepScore?.score >= 70 ? '#f59e0b' : '#ef4444'}
            label="Sleep Score"
            source="WHOOP"
            tooltip="WHOOP Sleep Performance: Actual sleep time ÷ sleep need. 100% = you met your full sleep need. Below 70% = significant sleep debt."
            rangeLabel={whoop?.need_hours ? `Need: ${whoop.need_hours}h` : null}
          />
          <GaugeRing
            value={checkin.hrv?.value} max={120}
            color="#8b5cf6"
            label="HRV"
            source={hrvSourceLabel}
            tooltip={`Heart Rate Variability: The variation in time between heartbeats, measured in milliseconds. Higher = better recovered. This reading is from ${hrvSourceLabel || 'your device'} using ${checkin.hrv?.source === 'whoop' ? 'RMSSD (beat-to-beat changes, best for recovery)' : 'SDNN (overall variability, good for trends)'}.`}
            rangeLabel={hrvBaseline ? `90d avg: ${Math.round(hrvBaseline)}ms` : null}
          />
          <GaugeRing
            value={checkin.resting_hr?.value} max={100}
            color="#ef4444"
            label="Resting HR"
            source={rhrSourceLabel}
            tooltip={`Resting Heart Rate: Your lowest heart rate during sleep, in beats per minute. Lower is generally better and indicates good cardiovascular fitness. This reading is from ${rhrSourceLabel || 'your device'}. An elevated RHR can signal stress, illness, or poor recovery.`}
            rangeLabel={rhrBaseline ? `30d avg: ${Math.round(rhrBaseline)} bpm` : null}
          />
        </div>
      </div>

      {/* Key factors — visual bars */}
      {scores.factors?.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.8rem' }}>WHAT'S DRIVING YOUR SCORES</h3>
          {scores.factor_summary && (
            <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0 0 0.65rem', lineHeight: 1.5 }}>{scores.factor_summary}</p>
          )}
          {scores.factors.map((f, i) => {
            const val = f.whoop_value ? parseFloat(f.whoop_value) : (f.apple_value ? parseFloat(f.apple_value) : null);
            const maxVal = f.metric === 'Blood Oxygen (SpO2)' ? 100
              : f.metric.includes('Heart Rate Variability') ? 120
              : f.metric.includes('Resting') ? 100
              : f.metric.includes('Respiratory') ? 25
              : f.metric.includes('Strain') ? 21 : 100;
            const color = f.impact === 'high' ? '#ef4444' : f.impact === 'medium' ? '#f59e0b' : '#22c55e';
            return <FactorBar key={i} label={f.metric} value={val} maxValue={maxVal} color={color} unit={f.whoop_value?.replace(/[0-9.]/g, '') || ''} />;
          })}
        </div>
      )}

      {/* Sleep donuts */}
      {(apple || whoop) && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.8rem' }}>SLEEP STAGES</h3>
          <SleepDonut apple={apple} whoop={whoop} />
          {whoop?.need_hours && (
            <div style={{ textAlign: 'center', marginTop: '0.65rem', fontSize: '0.82rem' }}>
              <span style={{ color: '#64748b' }}>Sleep need: <strong>{whoop.need_hours}h</strong></span>
              {whoop.total_hours > whoop.need_hours
                ? <span style={{ color: '#16a34a', marginLeft: '0.5rem' }}>✓ {(whoop.total_hours - whoop.need_hours).toFixed(1)}h surplus</span>
                : <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>⚠ {(whoop.need_hours - whoop.total_hours).toFixed(1)}h short</span>
              }
            </div>
          )}
          {apple && whoop && Math.abs(apple.total_hours - whoop.total_hours) > 0.1 && (
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem', lineHeight: 1.4 }}>
              {Math.round(Math.abs(apple.total_hours - whoop.total_hours) * 60)} min difference —
              {apple.total_hours > whoop.total_hours
                ? ' Apple includes more time in bed. WHOOP uses HR to detect actual sleep onset, so it\'s stricter.'
                : ' WHOOP detected slightly more sleep.'}
            </p>
          )}
        </div>
      )}

      {/* 7-day trend summaries (charts are in Deep Dive) */}
      {(hrvTrend || rhrTrend || sleepTrend) && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.8rem' }}>7-DAY TRENDS</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {hrvTrend && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 500 }}
                  title="Heart Rate Variability: daily average from your device. Apple measures throughout the day, WHOOP measures during sleep.">
                  HRV <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>({hrvSourceLabel || 'avg'})</span>
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: hrvTrend.direction === 'up' ? '#16a34a' : hrvTrend.direction === 'down' ? '#ef4444' : '#64748b' }}>
                  {trendText(hrvTrend)}
                </span>
              </div>
            )}
            {rhrTrend && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 500 }}
                  title="Resting Heart Rate: your lowest HR during sleep. Lower is generally better.">
                  Resting HR
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: rhrTrend.direction === 'down' ? '#16a34a' : rhrTrend.direction === 'up' ? '#ef4444' : '#64748b' }}>
                  {trendText(rhrTrend)}
                </span>
              </div>
            )}
            {sleepTrend && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>Sleep</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>
                  {trendText(sleepTrend)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
