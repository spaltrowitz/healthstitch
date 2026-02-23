import { useEffect, useState } from 'react';
import { apiRequest } from './api/client';
import MorningCheckIn from './views/MorningCheckIn';
import TrendsDashboard from './views/TrendsDashboard';
import DeviceComparison from './views/DeviceComparison';
import WorkoutLog from './views/WorkoutLog';

const TABS = [
  { id: 'morning', label: 'Morning Check-In' },
  { id: 'trends', label: 'Trends Dashboard' },
  { id: 'comparison', label: 'Device Comparison' },
  { id: 'workouts', label: 'Workout Log' }
];

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('health_token') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('morning');
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    localStorage.setItem('health_token', token);
  }, [token]);

  async function login(mode) {
    try {
      setAuthError('');
      const response = await apiRequest(`/auth/${mode}`, {
        method: 'POST',
        body: { email, password }
      });
      setToken(response.token);
    } catch (error) {
      setAuthError(error.message);
    }
  }

  async function connectWhoop() {
    try {
      const response = await apiRequest('/whoop/connect', { token });
      window.location.href = response.auth_url;
    } catch (error) {
      setSyncMessage(error.message);
    }
  }

  async function syncWhoop() {
    try {
      const response = await apiRequest('/whoop/sync', { method: 'POST', token, body: {} });
      setSyncMessage(`WHOOP sync complete: ${JSON.stringify(response.counts)}`);
    } catch (error) {
      setSyncMessage(error.message);
    }
  }

  function logout() {
    setToken('');
    localStorage.removeItem('health_token');
  }

  if (!token) {
    return (
      <main className="container auth-container">
        <h1>Unified Health Dashboard</h1>
        <p>Login or register to connect WHOOP and ingest Apple Health data.</p>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="button-row">
          <button onClick={() => login('login')}>Login</button>
          <button onClick={() => login('register')}>Register</button>
        </div>
        {authError && <p className="error">{authError}</p>}
      </main>
    );
  }

  return (
    <main className="container">
      <header className="header-row">
        <h1>Unified Health Dashboard</h1>
        <div className="button-row">
          <button onClick={connectWhoop}>Connect WHOOP</button>
          <button onClick={syncWhoop}>Sync WHOOP</button>
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      {syncMessage && <p>{syncMessage}</p>}

      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'morning' && <MorningCheckIn token={token} />}
      {activeTab === 'trends' && <TrendsDashboard token={token} />}
      {activeTab === 'comparison' && <DeviceComparison token={token} />}
      {activeTab === 'workouts' && <WorkoutLog token={token} />}
    </main>
  );
}
