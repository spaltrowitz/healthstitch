import { useEffect, useState } from 'react';
import { apiRequest } from './api/client';
import SyncStatus from './components/SyncStatus';
import MorningCheckIn from './views/MorningCheckIn';
import TrendsDashboard from './views/TrendsDashboard';
import DeviceComparison from './views/DeviceComparison';
import WorkoutLog from './views/WorkoutLog';

const TABS = [
  { id: 'morning', label: '\u{1F305} Readiness' },
  { id: 'trends', label: '\u{1F4C8} Trends' },
  { id: 'comparison', label: '\u2696\uFE0F Compare' },
  { id: 'workouts', label: '\u{1F3CB}\uFE0F Workouts' }
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
        <h1>HealthStitch</h1>
        <p>Sign in to bring your WHOOP and Apple Health data together.</p>
        <input placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="button-row">
          <button onClick={() => login('login')}>Sign In</button>
          <button onClick={() => login('register')}>Create Account</button>
        </div>
        {authError && <p className="error">{authError}</p>}
      </main>
    );
  }

  return (
    <main className="container">
      <header className="header-row">
        <h1>HealthStitch</h1>
        <div className="button-row">
          <button onClick={connectWhoop}>Link WHOOP</button>
          <button onClick={syncWhoop}>Pull Latest</button>
          <button onClick={logout}>Sign Out</button>
        </div>
      </header>

      <SyncStatus token={token} />

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
