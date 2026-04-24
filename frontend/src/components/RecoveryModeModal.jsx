import { useState } from 'react';
import { apiRequest } from '../api/client';

const REASONS = ['Surgery', 'Illness', 'Injury', 'Pregnancy', 'Travel', 'Other'];

export default function RecoveryModeModal({ token, onClose, onStarted }) {
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleStart() {
    if (!reason) { setError('Please select a reason'); return; }
    setSubmitting(true);
    setError('');
    try {
      const data = await apiRequest('/recovery/start', {
        method: 'POST', token,
        body: { reason, start_date: startDate, notes: notes || null }
      });
      onStarted(data.recovery);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', maxWidth: 420, width: '90%' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Start Recovery Mode</h3>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
          Pauses baseline comparisons and adjusts recommendations while you recover.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: '0.25rem' }}>
              <option value="">Select a reason…</option>
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Start date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: '0.25rem' }} />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g., ACL surgery, expected 6-week recovery"
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: '0.25rem', resize: 'vertical' }} />
          </div>
        </div>

        {error && <p className="error" style={{ marginTop: '0.5rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleStart} disabled={submitting}
            style={{ background: '#2563eb', color: '#fff', borderColor: '#2563eb' }}>
            {submitting ? 'Starting…' : 'Start Recovery Mode'}
          </button>
        </div>
      </div>
    </div>
  );
}
