import { useState } from 'react';

const CONF = {
  high: { label: '90%' },
  medium: { label: '70%' },
  low: { label: '50%' },
  'n/a': { label: '—' }
};

const METRICS = [
  { metric: 'Resting HR', listenTo: 'Average both', gap: '2-5 bpm', conf: 'high',
    detail: 'Both are accurate but measure at different times. WHOOP captures your lowest HR during slow-wave sleep. Apple Watch averages across the full night. If both trend together, the signal is strong.' },
  { metric: 'Sleep Duration', listenTo: 'WHOOP', gap: '15-30 min', conf: 'high',
    detail: 'Apple tends to count time lying still as sleep. WHOOP uses HR + HRV to detect actual sleep onset, which is stricter and closer to true sleep time.' },
  { metric: 'HRV', listenTo: 'WHOOP for recovery', gap: 'Different scales', conf: 'medium',
    detail: 'Apple uses SDNN (overall variability), WHOOP uses RMSSD (beat-to-beat, better for recovery). Never compare absolute numbers — compare whether both trend the same direction.' },
  { metric: 'Sleep Stages', listenTo: 'Trends only', gap: '20-40 min/stage', conf: 'low',
    detail: 'Wrist-based stage detection is 60-70% accurate vs clinical polysomnography for all devices. Look at 7-day averages, not single nights.' },
  { metric: 'Workout HR', listenTo: 'Apple for max, WHOOP for avg', gap: '3-8 bpm', conf: 'medium',
    detail: 'Apple catches HR peaks better. WHOOP gives more stable averages. Both can be noisy during strength training due to wrist movement.' },
  { metric: 'Calories', listenTo: 'Relative only', gap: '~2x', conf: 'low',
    detail: 'Apple reports total calories (active + basal). WHOOP reports active only. Neither is accurate in absolute terms — use for day-to-day comparison only.' },
  { metric: 'SpO2', listenTo: 'WHOOP', gap: '1-3%', conf: 'medium',
    detail: 'WHOOP measures continuously during sleep. Apple takes spot readings. Both flag the same issues — if one shows low SpO2, check strap fit on the other.' },
  { metric: 'Recovery Score', listenTo: 'WHOOP', gap: 'N/A', conf: 'n/a',
    detail: 'Apple Watch has no recovery score. WHOOP combines HRV, RHR, SpO2, skin temp, and respiratory rate. Can be skewed by medication affecting SpO2.' },
  { metric: 'Strain', listenTo: 'WHOOP', gap: 'N/A', conf: 'n/a',
    detail: 'Apple tracks active calories and exercise minutes but has no strain equivalent. HealthStitch uses active energy as a proxy when comparing.' }
];

export default function DeviceReference() {
  const [expanded, setExpanded] = useState(null);

  return (
    <section>
      <h2>Device Reference</h2>
      <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.75rem' }}>
        How Apple Watch and WHOOP measure differently. Tap a row for details.
      </p>

      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.65rem 0.85rem', marginBottom: '1rem', fontSize: '0.8rem', lineHeight: 1.5 }}>
        <strong>How to read Confidence:</strong> This indicates how reliably a metric can be compared across devices.
        <strong>90%</strong> = devices measure similarly, small differences are noise.
        <strong>70%</strong> = useful comparison but different methods — focus on trends.
        <strong>50%</strong> = rough comparison only, don't rely on individual readings.
        <strong>—</strong> = only one device tracks this metric.
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
                  <td style={{ color: '#334155' }}>{m.listenTo}</td>
                  <td>{m.gap}</td>
                  <td style={{ textAlign: 'center', fontWeight: 500, color: '#475569' }}>{CONF[m.conf].label}</td>
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
        Confidence = how reliably this metric can be compared across devices, based on clinical studies.
        Calibrated for Apple Watch Series 7+ and WHOOP 4.0. Older hardware may differ.
      </p>
    </section>
  );
}
