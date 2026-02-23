export default function SourceToggle({ value, onChange }) {
  return (
    <div className="selector-row">
      <label>Source</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="both">Both overlaid</option>
        <option value="apple_watch">Apple Watch only</option>
        <option value="whoop">WHOOP only</option>
      </select>
    </div>
  );
}
