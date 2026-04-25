import { useState } from 'react';

const DEVICE_PAIRS = {
  'apple-whoop': {
    label: 'Apple Watch + WHOOP',
    metrics: [
      {
        metric: 'Resting Heart Rate',
        listenTo: 'Average of both',
        confidence: 'high',
        explanation: 'Both are accurate but measure at different times. WHOOP captures your lowest HR during slow-wave sleep (your physiological "true" RHR). Apple Watch averages across the full night, which is more representative of daily readiness.',
        typicalDelta: '2-5 bpm',
        direction: 'WHOOP typically reads slightly higher because it isolates the deepest sleep window.',
        tip: 'If both trend in the same direction, the signal is strong regardless of the absolute difference.'
      },
      {
        metric: 'Heart Rate Variability (HRV)',
        listenTo: 'WHOOP for recovery decisions',
        confidence: 'medium',
        explanation: 'Apple uses SDNN (total variability), WHOOP uses RMSSD (beat-to-beat changes). RMSSD measured during slow-wave sleep is the clinical standard for assessing autonomic recovery. Apple\'s SDNN is useful for long-term trend tracking.',
        typicalDelta: '10-20 ms (different scales)',
        direction: 'SDNN is always numerically higher than RMSSD for the same person. This is math, not measurement error.',
        tip: 'Never compare the absolute numbers. Compare whether both are trending up or down — that agreement is the real signal.'
      },
      {
        metric: 'Sleep Duration',
        listenTo: 'WHOOP',
        confidence: 'high',
        explanation: 'Apple Watch uses accelerometer + HR to detect sleep and tends to count time lying still as sleep. WHOOP uses HR + HRV patterns to detect actual sleep onset, which is stricter and more accurate.',
        typicalDelta: '15-30 minutes',
        direction: 'Apple Watch almost always reports longer sleep than WHOOP.',
        tip: 'If Apple says 8.5h and WHOOP says 8h, your actual sleep is probably closer to WHOOP\'s number.'
      },
      {
        metric: 'Sleep Stages',
        listenTo: 'Use for trends only',
        confidence: 'low',
        explanation: 'Wrist-based sleep stage detection is 60-70% accurate compared to polysomnography (the clinical gold standard) for both devices. Neither is reliable for absolute stage times on any given night.',
        typicalDelta: '20-40 minutes per stage',
        direction: 'Varies — both devices can over- or under-count any stage on any night.',
        tip: 'Look at 7-day or 30-day averages for stage percentages, not individual nights. A single night\'s deep sleep number is essentially a rough estimate.'
      },
      {
        metric: 'Workout Heart Rate',
        listenTo: 'Apple for max HR, WHOOP for avg HR',
        confidence: 'medium',
        explanation: 'Apple Watch\'s optical sensor is optimized for peak detection during movement. WHOOP samples continuously and provides more stable averages. Both can be affected by wrist movement during strength training.',
        typicalDelta: '3-8 bpm for avg, 2-5 bpm for max',
        direction: 'Apple Watch typically reads slightly higher for both avg and max, especially during strength training (arm movement creates sensor noise).',
        tip: 'For the most accurate workout HR, a chest strap beats both wrist devices. For comparing across workouts, pick one device and stick with it.'
      },
      {
        metric: 'Calories',
        listenTo: 'Neither is "accurate"',
        confidence: 'low',
        explanation: 'WHOOP reports only active calories (exercise-specific burn). Apple reports total calories (active + basal metabolic rate during the workout). Neither device can measure true caloric expenditure — that requires a metabolic cart.',
        typicalDelta: '1.5-2.5x (Apple reports ~2x more)',
        direction: 'Apple always reports significantly higher because it includes basal metabolism.',
        tip: 'Use calorie numbers for relative tracking (did I burn more today vs yesterday?) not absolute accuracy. The ratio between devices will be consistent.'
      },
      {
        metric: 'Blood Oxygen (SpO2)',
        listenTo: 'WHOOP',
        confidence: 'medium',
        explanation: 'WHOOP measures SpO2 continuously during sleep when readings are most stable. Apple Watch takes spot measurements. Both use similar optical sensor technology but WHOOP\'s sleep-time measurement window produces more reliable readings.',
        typicalDelta: '1-3%',
        direction: 'Usually close. Large deviations often indicate sensor fit issues rather than actual SpO2 differences.',
        tip: 'SpO2 below 90% on either device is worth paying attention to. If only one device shows it, check the strap/band fit on the other.'
      },
      {
        metric: 'Recovery / Readiness',
        listenTo: 'WHOOP (only source)',
        confidence: 'n/a',
        explanation: 'Apple Watch does not calculate a recovery or readiness score. WHOOP\'s recovery score combines HRV, RHR, SpO2, skin temp, and respiratory rate into a single 0-100% metric. HealthStitch provides this context that Apple lacks.',
        typicalDelta: 'N/A — Apple has no equivalent',
        direction: 'N/A',
        tip: 'WHOOP recovery is most useful when SpO2 and other vitals are normal. If you\'re on medication affecting SpO2, the score may be artificially low.'
      },
      {
        metric: 'Strain / Activity Load',
        listenTo: 'WHOOP (only source)',
        confidence: 'n/a',
        explanation: 'Apple Watch tracks active calories and exercise minutes but has no equivalent to WHOOP\'s strain score (0-21 scale based on cardiovascular load). HealthStitch uses Apple\'s active energy as a proxy when comparing training load across devices.',
        typicalDelta: 'N/A — different scales',
        direction: 'N/A',
        tip: 'Strain is relative to your own baseline, not comparable between people. A strain of 15 for a beginner is very different from a strain of 15 for an elite athlete.'
      }
    ]
  }
};

const CONFIDENCE_STYLES = {
  high: { bg: '#f0fdf4', color: '#16a34a', label: 'High confidence' },
  medium: { bg: '#fefce8', color: '#ca8a04', label: 'Moderate confidence' },
  low: { bg: '#fef2f2', color: '#dc2626', label: 'Low confidence' },
  'n/a': { bg: '#f1f5f9', color: '#64748b', label: 'Single source' }
};

function MetricReference({ item }) {
  const [expanded, setExpanded] = useState(false);
  const conf = CONFIDENCE_STYLES[item.confidence];

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{ padding: '0.85rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', marginBottom: '0.5rem', transition: 'box-shadow 0.15s' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong style={{ fontSize: '0.9rem' }}>{item.metric}</strong>
          <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: 10, background: conf.bg, color: conf.color, fontWeight: 600 }}>{conf.label}</span>
        </div>
        <span style={{ color: '#94a3b8', transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
      </div>
      <div style={{ fontSize: '0.82rem', color: '#2563eb', fontWeight: 600, marginTop: '0.25rem' }}>
        Listen to: {item.listenTo}
      </div>

      {expanded && (
        <div style={{ marginTop: '0.65rem', fontSize: '0.82rem', lineHeight: 1.6, borderTop: '1px solid #f1f5f9', paddingTop: '0.65rem' }}>
          <p style={{ margin: '0 0 0.5rem', color: '#334155' }}>{item.explanation}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ background: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: 8 }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>TYPICAL DELTA</div>
              <div style={{ fontWeight: 600 }}>{item.typicalDelta}</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: 8 }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>DIRECTION</div>
              <div>{item.direction}</div>
            </div>
          </div>
          <div style={{ background: '#eff6ff', padding: '0.5rem 0.65rem', borderRadius: 8, color: '#1e40af', fontSize: '0.8rem' }}>
            <strong>Tip:</strong> {item.tip}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DeviceReference() {
  const pair = DEVICE_PAIRS['apple-whoop'];

  return (
    <section>
      <h2>Device Reference</h2>
      <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem', lineHeight: 1.5 }}>
        Universal truths about how Apple Watch and WHOOP measure differently.
        These patterns are consistent across all users — the magnitude varies but the direction doesn't.
      </p>

      {pair.metrics.map((item, i) => (
        <MetricReference key={i} item={item} />
      ))}

      <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: 12, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>
        <strong>Sources:</strong> Based on published clinical studies comparing wrist-worn optical sensors to gold-standard measurements
        (polysomnography for sleep, chest-strap ECG for HR/HRV, metabolic cart for calories).
        Individual results vary based on device placement, skin tone, fitness level, and medications.
      </div>
    </section>
  );
}
