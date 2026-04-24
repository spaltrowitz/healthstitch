import { useEffect, useState } from 'react';
import { apiRequest } from './api/client';
import MorningCheckIn from './views/MorningCheckIn';
import TrendsDashboard from './views/TrendsDashboard';
import DeviceComparison from './views/DeviceComparison';
import WorkoutLog from './views/WorkoutLog';
import DataUpload from './views/DataUpload';
import DataInsights from './views/DataInsights';
import ScoreExplainer from './views/ScoreExplainer';
import RecoveryModeModal from './components/RecoveryModeModal';

const TABS = [
  { id: 'scores', label: 'Today' },
  { id: 'trends', label: 'Trends' },
  { id: 'workouts', label: 'Workouts' },
  { id: 'insights', label: 'Insights' },
  { id: 'upload', label: 'Upload' }
];

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('health_token') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('scores');
  const [syncMessage, setSyncMessage] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  useEffect(() => {
    if (!token) return;
    localStorage.setItem('health_token', token);
    apiRequest('/recovery/status', { token })
      .then(setRecoveryStatus)
      .catch(() => {});
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

  async function syncWhoop() {
    try {
      setSyncMessage('Syncing WHOOP…');
      const response = await apiRequest('/whoop/sync', { method: 'POST', token, body: {} });
      setSyncMessage(`WHOOP sync complete: ${JSON.stringify(response.counts)}`);
    } catch (error) {
      if (error.message.includes('not connected')) {
        try {
          const response = await apiRequest('/whoop/connect', { token });
          window.location.href = response.auth_url;
        } catch (connError) {
          setSyncMessage(connError.message);
        }
      } else {
        setSyncMessage(error.message);
      }
    }
  }

  async function endRecoveryMode() {
    try {
      await apiRequest('/recovery/end', { method: 'POST', token, body: {} });
      const status = await apiRequest('/recovery/status', { token });
      setRecoveryStatus(status);
    } catch (error) {
      setSyncMessage(error.message);
    }
  }

  function logout() {
    setToken('');
    setRecoveryStatus(null);
    localStorage.removeItem('health_token');
  }

  if (!token) {
    return (
      <main className="container auth-container">
        <h1>HealthStitch</h1>
        <p>Login or register to connect your health devices and see your data unified.</p>
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
        <h1>HealthStitch</h1>
        <div className="button-row">
          {recoveryStatus?.active
            ? <button onClick={endRecoveryMode} style={{ background: '#fef3c7', borderColor: '#f59e0b' }}>End Recovery Mode</button>
            : <button onClick={() => setShowRecoveryModal(true)}>🩺 Recovery Mode</button>
          }
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      {recoveryStatus?.active && (
        <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8, padding: '0.75rem 1rem', margin: '0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🩺</span>
          <span>
            <strong>Recovery Mode</strong> — {recoveryStatus.active.reason} (Day {recoveryStatus.active.day_number}, since {recoveryStatus.active.start_date}).
            Baseline comparisons paused.
          </span>
        </div>
      )}

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

      {activeTab === 'scores' && <ScoreExplainer token={token} />}
      {activeTab === 'trends' && <TrendsDashboard token={token} />}
      {activeTab === 'workouts' && <WorkoutLog token={token} />}
      {activeTab === 'insights' && <DataInsights token={token} />}
      {activeTab === 'upload' && <DataUpload token={token} />}

      {showRecoveryModal && (
        <RecoveryModeModal
          token={token}
          onClose={() => setShowRecoveryModal(false)}
          onStarted={(recovery) => {
            setRecoveryStatus({ active: recovery });
            setShowRecoveryModal(false);
          }}
        />
      )}
    </main>
  );
}
