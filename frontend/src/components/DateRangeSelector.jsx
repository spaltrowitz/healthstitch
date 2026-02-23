export default function DateRangeSelector({ value, onChange }) {
  const ranges = ['7', '30', '90', '180', 'all'];

  return (
    <div className="selector-row">
      <label>Date range</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {ranges.map((range) => (
          <option key={range} value={range}>
            {range === 'all' ? 'All Time' : `${range} days`}
          </option>
        ))}
      </select>
    </div>
  );
}
