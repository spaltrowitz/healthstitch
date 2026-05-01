export default function SourceToggle({ value, onChange }) {
  return (
    <div className="selector-row">
      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Source</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="both">All devices</option>
        <option value="apple_watch">Apple Watch only</option>
        <option value="whoop">WHOOP only</option>
      </select>
    </div>
  );
}
