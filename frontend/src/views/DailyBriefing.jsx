import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, YAxis, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar, XAxis
} from 'recharts';
import { apiRequest } from '../api/client';

const ZONE_COLORS = { red: '#ef4444', yellow: '#f59e0b', green: '#22c55e' };
const STAGE_COLORS = { deep: '#3b82f6', rem: '#8b5cf6', light: '#60a5fa', awake: '#f97316' };

function GaugeRing({ value, max, color, size = 120, label, sublabel }) {
  const pct = value != null ? Math.min(value / max, 1) : 0;
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  return (
    <div style={{ textAlign: 'center' }}>
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
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginTop: 2 }}>{label}</div>
      {sublabel && <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{sublabel}</div>}
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
  const [scores, setScores] = useState(null);
  const [checkin, setCheckin] = useState(null);
  const [insights, setInsights] = useState(null);
  const [trends, setTrends] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiRequest('/dashboard/score-explainer', { token }),
      apiRequest('/dashboard/morning-checkin', { token }),
      apiRequest('/dashboard/insights', { token }),
      apiRequest('/dashboard/trends?range=7&source=both', { token })
    ]).then(([s, c, i, t]) => { setScores(s); setCheckin(c); setInsights(i); setTrends(t); })
      .catch((err) => setError(err.message));
  }, [token]);

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

  const topInsights = (insights?.insights || [])
    .filter(i => i.type !== 'info' && i.type !== 'comparison')
    .slice(0, 3);

  return (
    <section>
      {/* Gauges row */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '0.5rem' }}>
          <GaugeRing
            value={recovery?.score} max={100}
            color={ZONE_COLORS[recovery?.zone] || '#94a3b8'}
            label="Recovery" sublabel="WHOOP"
          />
          <GaugeRing
            value={sleepScore?.score} max={100}
            color={sleepScore?.score >= 85 ? '#22c55e' : sleepScore?.score >= 70 ? '#f59e0b' : '#ef4444'}
            label="Sleep Score" sublabel="WHOOP"
          />
          <GaugeRing
            value={checkin.hrv?.value} max={120}
            color="#8b5cf6"
            label="HRV" sublabel={checkin.hrv?.source === 'whoop' ? 'RMSSD' : 'SDNN'}
          />
          <GaugeRing
            value={checkin.resting_hr?.value} max={100}
            color="#ef4444"
            label="Resting HR" sublabel="bpm"
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
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem', lineHeight: 1.4 }}>
              {Math.round(Math.abs(apple.total_hours - whoop.total_hours) * 60)} min difference —
              {apple.total_hours > whoop.total_hours
                ? ' Apple counts more time in bed as sleep. WHOOP is stricter about detecting actual sleep onset.'
                : ' WHOOP detected more sleep time, possibly including periods Apple missed.'}
            </p>
          )}
        </div>
      )}

      {/* 7-day mini charts */}
      {trends && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          <div className="card" style={{ padding: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.35rem' }}>HRV — 7 DAYS</div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={hrvData} barGap={1}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                <Tooltip contentStyle={{ fontSize: '0.75rem', borderRadius: 6 }} />
                <Bar dataKey="apple" fill="#2563eb" name="Apple SDNN" radius={[3,3,0,0]} barSize={12} />
                <Bar dataKey="whoop" fill="#16a34a" name="WHOOP RMSSD" radius={[3,3,0,0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card" style={{ padding: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.35rem' }}>RESTING HR — 7 DAYS</div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={rhrData} barGap={1}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis hide domain={['dataMin - 3', 'dataMax + 3']} />
                <Tooltip contentStyle={{ fontSize: '0.75rem', borderRadius: 6 }} />
                <Bar dataKey="apple_watch" fill="#2563eb" name="Apple" radius={[3,3,0,0]} barSize={12} />
                <Bar dataKey="whoop" fill="#16a34a" name="WHOOP" radius={[3,3,0,0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card" style={{ padding: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.35rem' }}>SLEEP — 7 DAYS</div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={sleepData} barGap={1}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis hide domain={[0, 'dataMax + 1']} />
                <Tooltip contentStyle={{ fontSize: '0.75rem', borderRadius: 6 }} formatter={(v) => `${v}h`} />
                <Bar dataKey="apple_watch" fill="#2563eb" name="Apple" radius={[3,3,0,0]} barSize={12} />
                <Bar dataKey="whoop" fill="#16a34a" name="WHOOP" radius={[3,3,0,0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top insights */}
      {topInsights.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>KEY INSIGHTS</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {topInsights.map((insight, i) => (
              <div key={i} style={{ padding: '0.55rem 0.75rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: '0.82rem', lineHeight: 1.4 }}>
                <strong>{insight.title}</strong>
                <span style={{ color: '#475569' }}> — {insight.body}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
