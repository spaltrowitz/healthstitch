export default function ColorLegend({ showStatus = true }) {
  return (
    <div style={{
      display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.7rem', color: '#64748b',
      padding: '0.4rem 0.6rem', marginBottom: '0.75rem',
      background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0'
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: '#2563eb' }} /> Apple Watch
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: '#e97319' }} /> WHOOP
      </span>
      {showStatus && (
        <>
          <span style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '0.75rem' }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} /> Normal
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} /> Monitor
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} /> Attention
          </span>
        </>
      )}
    </div>
  );
}
