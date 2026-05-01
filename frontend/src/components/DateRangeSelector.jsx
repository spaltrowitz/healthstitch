import { useState } from 'react';

export default function DateRangeSelector({ value, onChange, onCustomRange }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState(new Date().toISOString().slice(0, 10));
  const ranges = ['7', '30', '90', '180', 'all', 'custom'];

  function handleChange(val) {
    if (val === 'custom') {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      onChange(val);
    }
  }

  function applyCustom() {
    if (customFrom && customTo && onCustomRange) {
      onCustomRange(customFrom, customTo);
    }
  }

  return (
    <div className="selector-row">
      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Date range</label>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={showCustom ? 'custom' : value} onChange={(e) => handleChange(e.target.value)}>
          {ranges.map((range) => (
            <option key={range} value={range}>
              {range === 'all' ? 'All Time' : range === 'custom' ? 'Custom…' : `${range} days`}
            </option>
          ))}
        </select>
        {showCustom && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              style={{ fontSize: '0.8rem' }} />
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>to</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              max={new Date().toISOString().slice(0, 10)} style={{ fontSize: '0.8rem' }} />
            <button onClick={applyCustom} disabled={!customFrom}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', background: '#2563eb', color: '#fff', borderColor: '#2563eb' }}>
              Apply
            </button>
          </>
        )}
      </div>
    </div>
  );
}
