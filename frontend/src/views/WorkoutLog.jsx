import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
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

function sourceBadge(source) {
  if (source === 'apple_watch') return <span style={{ background: '#dbeafe', color: '#2563eb', padding: '0.1rem 0.4rem', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600 }}>⌚ Apple</span>;
  if (source === 'whoop') return <span style={{ background: '#dcfce7', color: '#7c3aed', padding: '0.1rem 0.4rem', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600 }}>⌚ WHOOP</span>;
  return <span>{source}</span>;
}

function sportName(raw) {
  return raw
    .replace(/^HKWorkoutActivityType/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
}

function CollapsibleSection({ title, subtitle, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="card" style={{ marginBottom: '0.75rem' }}>
      <div onClick={() => setOpen(!open)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.85rem' }}>{title}</h3>
          {subtitle && <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>{subtitle}</p>}
        </div>
        <span style={{ fontSize: '1rem', color: '#94a3b8', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </div>
      {open && <div style={{ marginTop: '0.75rem' }}>{children}</div>}
    </div>
  );
}

export default function WorkoutLog({ token }) {
  const [source, setSource] = useState('both');
  const [sport, setSport] = useState('all');
  const [from, setFrom] = useState(daysAgo(90));
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loadView, setLoadView] = useState('weekly');

  useEffect(() => {
    apiRequest(`/dashboard/workouts?source=${source}&sport=${sport}&from=${from}&to=${to}`, { token })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [source, sport, from, to, token]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Loading workouts...</p>;

  const sportTypes = [...new Set(data.workouts.map(w => sportName(w.sport_type)))].sort();

  return (
    <section>
      <h2>Workouts</h2>
      <div className="controls-inline">
        <div className="selector-row">
          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Source</label>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="both">Both devices</option>
            <option value="apple_watch">⌚ Apple Watch</option>
            <option value="whoop">⌚ WHOOP</option>
          </select>
        </div>
        <div className="selector-row">
          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Sport</label>
          <select value={sport} onChange={(e) => setSport(e.target.value)}>
            <option value="all">All sports</option>
            {sportTypes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="selector-row">
          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="selector-row">
          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>Training Load</h3>
          <div style={{ display: 'flex', gap: '0.25rem', background: '#e2e8f0', borderRadius: 8, padding: '0.15rem' }}>
            <button onClick={() => setLoadView('weekly')}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderRadius: 6, border: 'none',
                background: loadView === 'weekly' ? '#fff' : 'transparent',
                fontWeight: loadView === 'weekly' ? 600 : 400,
                boxShadow: loadView === 'weekly' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer' }}>Weekly</button>
            <button onClick={() => setLoadView('monthly')}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderRadius: 6, border: 'none',
                background: loadView === 'monthly' ? '#fff' : 'transparent',
                fontWeight: loadView === 'monthly' ? 600 : 400,
                boxShadow: loadView === 'monthly' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer' }}>Monthly</button>
          </div>
        </div>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 0.5rem' }}>
          Based on WHOOP strain. Apple Watch workouts without strain use calories as a proxy.
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={loadView === 'weekly' ? data.weekly_load : data.monthly_load}>
            <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: '0.8rem', borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(v) => typeof v === 'number' ? v.toFixed(2) : v} />
            <Bar dataKey="load" fill="#2563eb" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <CollapsibleSection
        title={`Workout History (${data.workouts.length})`}
        defaultOpen={false}
      >
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Source</th>
                <th>Sport</th>
                <th>Duration</th>
                <th>Avg HR</th>
                <th>Max HR</th>
                <th>Strain</th>
                <th>Calories</th>
              </tr>
            </thead>
            <tbody>
              {data.workouts.map((workout, idx) => (
                <tr key={`${workout.date}-${idx}`}>
                  <td>{workout.date}</td>
                  <td>{sourceBadge(workout.source)}</td>
                  <td>{sportName(workout.sport_type)}</td>
                  <td>{(workout.duration_ms / 60000).toFixed(0)} min</td>
                  <td>{workout.avg_hr ?? <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                  <td>{workout.max_hr ?? <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                  <td>{workout.strain != null ? workout.strain.toFixed(1) : <span style={{ color: '#cbd5e1' }}>—</span>}
                    {workout.strain == null && workout.source === 'apple_watch' && <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}> Apple N/A</span>}
                  </td>
                  <td>{workout.calories != null ? Number(workout.calories).toFixed(0) : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>
    </section>
  );
}
