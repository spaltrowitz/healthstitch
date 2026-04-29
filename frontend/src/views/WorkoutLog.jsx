import { useEffect, useMemo, useState } from 'react';
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

export default function WorkoutLog({ token }) {
  const [source, setSource] = useState('both');
  const [sport, setSport] = useState('all');
  const [from, setFrom] = useState(daysAgo(90));
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest(`/dashboard/workouts?source=${source}&sport=${sport}&from=${from}&to=${to}`, { token })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [source, sport, from, to, token]);

  const sportTypes = useMemo(() => {
    if (!data) return [];
    const types = new Set(data.workouts.map((w) => w.sport_type).filter(Boolean));
    return ['all', ...Array.from(types).sort()];
  }, [data]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return (
    <section>
      <h2>Your Workouts</h2>
      <div className="charts-grid">
        <div className="skeleton skeleton-card" style={{ height: 240 }} />
        <div className="skeleton skeleton-card" style={{ height: 240 }} />
      </div>
    </section>
  );

  return (
    <section>
      <h2>Your Workouts</h2>
      <div className="controls-inline">
        <div className="selector-row">
          <label>Source</label>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="both">Both</option>
            <option value="apple_watch">Apple Watch</option>
            <option value="whoop">WHOOP</option>
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

      <div className="selector-row" style={{ marginBottom: '1.25rem' }}>
        <label>Sport</label>
        <div className="sport-pills">
          {sportTypes.map((s) => (
            <button
              key={s}
              className={`sport-pill ${sport === s ? 'active' : ''}`}
              onClick={() => setSport(s)}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Weekly load</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.weekly_load}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="load" fill="#2563eb" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Monthly load</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.monthly_load}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="load" fill="#16a34a" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {data.workouts.length > 0 && (
        <table style={{ marginTop: '1rem' }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Source</th>
              <th>Sport</th>
              <th>Duration</th>
              <th>Avg / Max HR</th>
              <th>Strain</th>
              <th>Calories</th>
            </tr>
          </thead>
          <tbody>
            {data.workouts.map((workout, idx) => (
              <tr key={`${workout.date}-${idx}`}>
                <td>{workout.date}</td>
                <td>
                  <span className={`delta-badge ${workout.source === 'whoop' ? 'good' : 'warn'}`} style={{ fontSize: '0.7rem' }}>
                    {workout.source === 'whoop' ? 'WHOOP' : 'Apple'}
                  </span>
                </td>
                <td style={{ fontWeight: 500 }}>{workout.sport_type}</td>
                <td>{(workout.duration_ms / 60000).toFixed(0)} min</td>
                <td>{workout.avg_hr != null || workout.max_hr != null ? `${workout.avg_hr ?? '-'} / ${workout.max_hr ?? '-'}` : ''}</td>
                <td>{workout.strain ?? ''}</td>
                <td>{workout.calories != null ? Number(workout.calories).toFixed(0) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
