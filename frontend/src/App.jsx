import { useEffect, useState } from 'react';
import { apiRequest } from './api/client';
import DailyBriefing from './views/DailyBriefing';
import TrendsDashboard from './views/TrendsDashboard';
import WorkoutLog from './views/WorkoutLog';
import DataInsights from './views/DataInsights';
import DataUpload from './views/DataUpload';
import DeviceReference from './views/DeviceReference';
import RecoveryModeModal from './components/RecoveryModeModal';

const TABS = [
  { id: 'briefing', label: 'Today' },
  { id: 'trends', label: 'Trends' },
  { id: 'reference', label: 'Reference' }
];

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('health_token') || '');
  const [userEmail, setUserEmail] = useState(localStorage.getItem('health_email') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('briefing');
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
      setUserEmail(response.user?.email || email);
      localStorage.setItem('health_email', response.user?.email || email);
    } catch (error) {
      setAuthError(error.message);
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
    setUserEmail('');
    setRecoveryStatus(null);
    localStorage.removeItem('health_token');
    localStorage.removeItem('health_email');
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
        <h1 onClick={() => setActiveTab('briefing')} style={{ cursor: 'pointer' }}>HealthStitch</h1>
        <button onClick={() => setActiveTab('settings')}
          style={{ background: 'transparent', border: 'none', fontSize: '1.3rem', cursor: 'pointer', padding: '0.25rem', opacity: activeTab === 'settings' ? 1 : 0.5 }}
          title="Settings">⚙</button>
      </header>

      {recoveryStatus?.active && (
        <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8, padding: '0.6rem 1rem', margin: '0.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🩺</span>
            <span style={{ fontSize: '0.85rem' }}>
              <strong>Recovery Mode</strong> — {recoveryStatus.active.reason} (Day {recoveryStatus.active.day_number}).
              Baselines paused.
            </span>
          </div>
          <button onClick={endRecoveryMode} style={{ background: '#fff', borderColor: '#f59e0b', fontSize: '0.8rem', padding: '0.3rem 0.65rem', whiteSpace: 'nowrap' }}>End</button>
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

      {activeTab === 'briefing' && <DailyBriefing token={token} />}
      {activeTab === 'trends' && (
        <>
          <TrendsDashboard token={token} />
          <WorkoutLog token={token} />
        </>
      )}
      {activeTab === 'reference' && <DeviceReference />}
      {activeTab === 'settings' && (
        <section>
          <h2>Settings</h2>

          {/* Recovery Mode */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: '0 0 0.5rem' }}>Recovery Mode</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.75rem' }}>
              Pause baseline comparisons during injury, surgery, illness, or any abnormal period.
              Your data is still tracked but excluded from baseline calculations.
            </p>
            {recoveryStatus?.active ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fefce8', padding: '0.65rem', borderRadius: 10 }}>
                <div>
                  <strong style={{ color: '#92400e' }}>Active</strong>
                  <span style={{ color: '#a16207', marginLeft: '0.5rem' }}>
                    {recoveryStatus.active.reason} — Day {recoveryStatus.active.day_number} (since {recoveryStatus.active.start_date})
                  </span>
                </div>
                <button onClick={endRecoveryMode} style={{ fontSize: '0.8rem' }}>End Recovery</button>
              </div>
            ) : (
              <button onClick={() => setShowRecoveryModal(true)}
                style={{ background: '#2563eb', color: '#fff', borderColor: '#2563eb' }}>
                Start Recovery Mode
              </button>
            )}
            {recoveryStatus?.history?.length > 1 && (
              <details style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
                <summary style={{ cursor: 'pointer' }}>History ({recoveryStatus.history.length} periods)</summary>
                <div style={{ marginTop: '0.5rem' }}>
                  {recoveryStatus.history.map((rp, i) => (
                    <div key={i} style={{ padding: '0.3rem 0', borderBottom: '1px solid #f1f5f9' }}>
                      {rp.reason} — {rp.start_date} to {rp.end_date || 'ongoing'}
                      {rp.notes && <span style={{ color: '#94a3b8' }}> · {rp.notes}</span>}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* Data Upload */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: '0 0 0.5rem' }}>Data Import</h3>
            <DataUpload token={token} />
          </div>

          {/* Account */}
          <div className="card">
            <h3 style={{ margin: '0 0 0.5rem' }}>Account</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.75rem' }}>
              Logged in as <strong>{userEmail}</strong>
            </p>
            <button onClick={logout} style={{ color: '#dc2626', borderColor: '#fecaca' }}>Logout</button>
          </div>
        </section>
      )}

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
