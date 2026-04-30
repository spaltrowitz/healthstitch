import { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../api/client';

function formatAge(isoString) {
  if (!isoString) return null;
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function freshnessClass(isoString) {
  if (!isoString) return 'freshness-stale';
  const mins = (Date.now() - new Date(isoString).getTime()) / 60000;
  if (mins < 30) return 'freshness-fresh';
  if (mins <= 120) return 'freshness-aging';
  return 'freshness-stale';
}

async function fetchStatus(path, token) {
  try {
    return await apiRequest(path, { token });
  } catch {
    return null;
  }
}

export default function SyncStatus({ token }) {
  const [whoop, setWhoop] = useState(undefined);
  const [apple, setApple] = useState(undefined);

  const refresh = useCallback(async () => {
    const [w, a] = await Promise.all([
      fetchStatus('/whoop/sync-status', token),
      fetchStatus('/apple/sync-status', token)
    ]);
    setWhoop(w);
    setApple(a);
  }, [token]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60000);
    return () => clearInterval(id);
  }, [refresh]);

  function renderSource(label, data) {
    if (data === undefined) return null;
    if (data === null) return <span className="sync-source freshness-muted">{label}: —</span>;
    if (data.status === 'error') {
      return (
        <span className="sync-source freshness-stale">
          {label}: Sync error
          <button className="sync-retry" onClick={refresh}>Retry</button>
        </span>
      );
    }
    if (!data.last_sync_at) {
      return <span className="sync-source freshness-muted">{label}: Not connected</span>;
    }
    const age = formatAge(data.last_sync_at);
    const cls = freshnessClass(data.last_sync_at);
    return <span className={`sync-source ${cls}`}>{label}: synced {age}</span>;
  }

  if (whoop === undefined && apple === undefined) return null;

  return (
    <div className="sync-status-bar">
      {renderSource('WHOOP', whoop)}
      {whoop !== undefined && apple !== undefined && <span className="sync-divider">·</span>}
      {renderSource('Apple Watch', apple)}
    </div>
  );
}
