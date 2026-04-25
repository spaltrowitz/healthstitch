import { useState } from 'react';

const CONF = {
  high: { dot: '#22c55e', label: 'High' },
  medium: { dot: '#f59e0b', label: 'Medium' },
  low: { dot: '#ef4444', label: 'Low' },
  'n/a': { dot: '#94a3b8', label: '—' }
};

const METRICS = [
  { metric: 'Resting HR', listenTo: 'Average both', gap: '2-5 bpm', conf: 'high',
    detail: 'Both are accurate but measure at different times. WHOOP captures your lowest HR during slow-wave sleep. Apple Watch averages across the full night. If both trend together, the signal is strong.' },
  { metric: 'Sleep Duration', listenTo: 'WHOOP', gap: '15-30 min', conf: 'high',
    detail: 'Apple tends to count time lying still as sleep. WHOOP uses HR + HRV to detect actual sleep onset, which is stricter and closer to true sleep time.' },
  { metric: 'HRV', listenTo: 'WHOOP (recovery)', gap: 'Different scales', conf: 'medium',
    detail: 'Apple uses SDNN (overall variability), WHOOP uses RMSSD (beat-to-beat, better for recovery). Never compare absolute numbers — compare whether both trend the same direction.' },
  { metric: 'Sleep Stages', listenTo: 'Trends only', gap: '20-40 min/stage', conf: 'low',
    detail: 'Wrist-based stage detection is 60-70% accurate vs clinical polysomnography for both devices. Look at 7-day averages, not single nights.' },
  { metric: 'Workout HR', listenTo: 'Apple (max), WHOOP (avg)', gap: '3-8 bpm', conf: 'medium',
    detail: 'Apple catches HR peaks better. WHOOP gives more stable averages. Both can be noisy during strength training due to wrist movement.' },
  { metric: 'Calories', listenTo: 'Relative only', gap: '~2x', conf: 'low',
    detail: 'Apple reports total calories (active + basal). WHOOP reports active only. Neither is accurate in absolute terms — use for day-to-day comparison only.' },
  { metric: 'SpO2', listenTo: 'WHOOP', gap: '1-3%', conf: 'medium',
    detail: 'WHOOP measures continuously during sleep. Apple takes spot readings. Both flag the same issues — if one shows low SpO2, check strap fit on the other.' },
  { metric: 'Recovery Score', listenTo: 'WHOOP (only source)', gap: 'N/A', conf: 'n/a',
    detail: 'Apple Watch has no recovery score. WHOOP combines HRV, RHR, SpO2, skin temp, and respiratory rate. Can be skewed by medication affecting SpO2.' },
  { metric: 'Strain', listenTo: 'WHOOP (only source)', gap: 'N/A', conf: 'n/a',
    detail: 'Apple tracks active calories and exercise minutes but has no strain equivalent. HealthStitch uses active energy as a proxy when comparing.' }
];

export default function DeviceReference() {
  const [expanded, setExpanded] = useState(null);

  return (
    <section>
      <h2>Device Reference</h2>
      <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1rem' }}>
        How Apple Watch and WHOOP measure differently. These patterns are consistent across all users.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.7rem' }}>
        {Object.entries(CONF).filter(([k]) => k !== 'n/a').map(([key, val]) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: val.dot }} />
            {val.label} confidence
          </span>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Listen to</th>
              <th>Typical gap</th>
              <th style={{ textAlign: 'center' }}>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m, i) => (
              <>
                <tr key={i} onClick={() => setExpanded(expanded === i ? null : i)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{m.metric}</td>
                  <td style={{ color: '#2563eb', fontWeight: 500 }}>{m.listenTo}</td>
                  <td>{m.gap}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: CONF[m.conf].dot, display: 'inline-block' }} />
                  </td>
                </tr>
                {expanded === i && (
                  <tr key={`${i}-detail`}>
                    <td colSpan={4} style={{ background: '#f8fafc', fontSize: '0.82rem', color: '#475569', lineHeight: 1.6 }}>
                      {m.detail}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.5 }}>
        Based on clinical studies comparing wrist-worn optical sensors to gold-standard measurements.
        Individual results vary based on device placement, skin tone, fitness level, and medications.
      </p>
    </section>
  );
}
