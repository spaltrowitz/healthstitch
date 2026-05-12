export default function HealthStitchLogo({ className = '' }) {
  return (
    <span className={`brand-lockup ${className}`.trim()}>
      <img className="brand-mark" src="/healthstitch-logo.svg" alt="" aria-hidden="true" />
      <span>HealthStitch</span>
    </span>
  );
}
