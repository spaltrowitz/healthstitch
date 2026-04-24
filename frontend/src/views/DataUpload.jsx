import { useState } from 'react';
import { apiUpload } from '../api/client';

function UploadZone({ title, icon, color, description, instructions, accept, endpoint, token }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError('');
    setResult(null);
    setProgress({ phase: 'uploading', percent: 0 });

    try {
      const data = await apiUpload(endpoint, file, token, setProgress);
      setResult(data.ingested);
      setFile(null);
      setProgress(null);
    } catch (err) {
      setError(err.message);
      setProgress(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '1.5rem' }}>{icon}</span>
        <h3 style={{ margin: 0, color }}>{title}</h3>
      </div>
      <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>{description}</p>

      <div style={{
        background: uploading ? '#f8fafc' : '#f1f5f9',
        border: `2px dashed ${file ? color : '#cbd5e1'}`,
        borderRadius: 10, padding: '1.25rem', textAlign: 'center', marginBottom: '0.75rem',
        transition: 'border-color 0.2s'
      }}>
        <input
          type="file"
          accept={accept}
          disabled={uploading}
          onChange={(e) => { setFile(e.target.files[0]); setResult(null); setError(''); }}
          style={{ fontSize: '0.85rem' }}
        />
        {file && (
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#475569' }}>
            📄 {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
          </p>
        )}
      </div>

      {progress && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ background: '#e2e8f0', borderRadius: 6, height: 10, overflow: 'hidden' }}>
            <div style={{
              background: progress.phase === 'parsing'
                ? `linear-gradient(90deg, ${color}, ${color}88, ${color})`
                : color,
              backgroundSize: progress.phase === 'parsing' ? '200% 100%' : 'auto',
              height: '100%',
              borderRadius: 6,
              width: progress.phase === 'parsing' ? '100%' : `${progress.percent}%`,
              transition: 'width 0.3s ease',
              animation: progress.phase === 'parsing' ? 'shimmer 1.5s infinite linear' : 'none'
            }} />
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem', textAlign: 'center' }}>
            {progress.phase === 'parsing'
              ? '⏳ Parsing your data — this may take a minute for large files…'
              : `Uploading… ${progress.percent}%`}
          </p>
        </div>
      )}

      {!progress && (
        <button onClick={handleUpload} disabled={!file || uploading}
          style={file && !uploading ? { background: color, color: '#fff', borderColor: color } : {}}>
          Upload
        </button>
      )}

      {result && (
        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
          <strong style={{ color: '#16a34a' }}>✓ Import complete</strong>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
            {result.metrics != null && result.metrics > 0 && (
              <span>📊 <strong>{result.metrics.toLocaleString()}</strong> metrics</span>
            )}
            {result.sleeps != null && result.sleeps > 0 && (
              <span>😴 <strong>{result.sleeps.toLocaleString()}</strong> sleeps</span>
            )}
            {result.workouts != null && result.workouts > 0 && (
              <span>🏋️ <strong>{result.workouts.toLocaleString()}</strong> workouts</span>
            )}
          </div>
        </div>
      )}

      {error && <p className="error" style={{ marginTop: '0.5rem' }}>{error}</p>}

      <details style={{ marginTop: 'auto', paddingTop: '0.75rem', fontSize: '0.8rem', color: '#475569' }}>
        <summary style={{ cursor: 'pointer' }}>How to export</summary>
        <div style={{ marginTop: '0.5rem', lineHeight: 1.6 }}>{instructions}</div>
      </details>
    </div>
  );
}

export default function DataUpload({ token }) {
  return (
    <div>
      <p style={{ color: '#64748b', marginBottom: '1rem' }}>
        Upload your health data exports to populate the dashboard. Re-uploads are safe — duplicates are automatically skipped.
      </p>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div className="grid two-col" style={{ alignItems: 'stretch' }}>
        <UploadZone
          title="Apple Health"
          icon="⌚"
          color="#e84393"
          description="Upload your Apple Health export (ZIP or XML). Only Apple Watch data is imported."
          accept=".zip,.xml"
          endpoint="/upload/apple-health"
          token={token}
          instructions={
            <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>Open the <strong>Health</strong> app on your iPhone</li>
              <li>Tap your profile picture (top right)</li>
              <li>Scroll down and tap <strong>Export All Health Data</strong></li>
              <li>Wait for the export, then save or AirDrop the ZIP</li>
              <li>Upload the ZIP here</li>
            </ol>
          }
        />

        <UploadZone
          title="WHOOP"
          icon="⌚"
          color="#16a34a"
          description="Upload your WHOOP data export (ZIP or individual CSV files)."
          accept=".zip,.csv"
          endpoint="/upload/whoop"
          token={token}
          instructions={
            <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>Open the <strong>WHOOP</strong> app</li>
              <li>Go to <strong>More → App Settings → Data Export</strong></li>
              <li>Tap <strong>Create Export</strong></li>
              <li>Check your email for the download link</li>
              <li>Download the ZIP and upload it here</li>
            </ol>
          }
        />
      </div>
    </div>
  );
}
