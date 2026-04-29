export default function SourceToggle({ value, onChange }) {
  return (
    <div className="selector-row">
      <label>Devices</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="both">Both devices</option>
        <option value="apple_watch">Apple Watch</option>
        <option value="whoop">WHOOP</option>
      </select>
    </div>
  );
}
