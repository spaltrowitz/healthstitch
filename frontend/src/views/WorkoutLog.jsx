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

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Loading workouts...</p>;

  return (
    <section>
      <h2>Workout Log</h2>
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
          <label>Sport</label>
          <input value={sport} onChange={(e) => setSport(e.target.value)} placeholder="all or exact sport" />
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

      <div className="chart-card">
        <h3>Weekly training load</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.weekly_load}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="load" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Monthly training load</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.monthly_load}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="load" fill="#16a34a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Source</th>
            <th>Sport</th>
            <th>Duration (min)</th>
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
              <td>{workout.source}</td>
              <td>{workout.sport_type}</td>
              <td>{(workout.duration_ms / 60000).toFixed(1)}</td>
              <td>{workout.avg_hr ?? '--'}</td>
              <td>{workout.max_hr ?? '--'}</td>
              <td>{workout.strain ?? '--'}</td>
              <td>{workout.calories == null ? '--' : Number(workout.calories).toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
