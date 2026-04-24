import { useState } from 'react';
import { apiUpload } from '../api/client';

function UploadZone({ title, description, instructions, accept, endpoint, token }) {
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

  const statusText = progress
    ? progress.phase === 'uploading'
      ? `Uploading… ${progress.percent}%`
      : 'Parsing data — this may take a minute for large files…'
    : 'Upload';

  return (
    <div className="card">
      <h3>{title}</h3>
      <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.5rem 0' }}>{description}</p>

      <div style={{ background: '#f1f5f9', border: '2px dashed #cbd5e1', borderRadius: 8, padding: '1.5rem', textAlign: 'center', marginBottom: '0.75rem' }}>
        <input
          type="file"
          accept={accept}
          disabled={uploading}
          onChange={(e) => { setFile(e.target.files[0]); setResult(null); setError(''); }}
          style={{ marginBottom: '0.5rem' }}
        />
        {file && <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>}
      </div>

      <button onClick={handleUpload} disabled={!file || uploading}>
        {statusText}
      </button>

      {progress && (
        <div style={{ marginTop: '0.5rem' }}>
          <div style={{ background: '#e2e8f0', borderRadius: 4, height: 8, overflow: 'hidden' }}>
            <div style={{
              background: progress.phase === 'parsing' ? '#f59e0b' : '#2563eb',
              height: '100%',
              width: progress.phase === 'parsing' ? '100%' : `${progress.percent}%`,
              transition: 'width 0.3s',
              animation: progress.phase === 'parsing' ? 'pulse 1.5s infinite' : 'none'
            }} />
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
            {progress.phase === 'parsing' ? '⏳ Server is parsing your file…' : `${progress.percent}% uploaded`}
          </p>
        </div>
      )}

      {result && (
        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
          <strong style={{ color: '#16a34a' }}>✓ Import complete</strong>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
            {result.metrics != null && <li>{result.metrics} metric records</li>}
            {result.sleeps != null && <li>{result.sleeps} sleep sessions</li>}
            {result.workouts != null && <li>{result.workouts} workouts</li>}
          </ul>
        </div>
      )}

      {error && <p className="error" style={{ marginTop: '0.5rem' }}>{error}</p>}

      <details style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#475569' }}>
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
        Upload your health data exports to populate the dashboard. Re-uploads are safe — duplicate records are automatically skipped.
      </p>

      <div className="grid two-col">
        <UploadZone
          title="Apple Health Export"
          description="Upload your Apple Health export (ZIP or XML). Only Apple Watch data is imported."
          accept=".zip,.xml"
          endpoint="/upload/apple-health"
          token={token}
          instructions={
            <>
              <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
                <li>Open the <strong>Health</strong> app on your iPhone</li>
                <li>Tap your profile picture (top right)</li>
                <li>Scroll down and tap <strong>Export All Health Data</strong></li>
                <li>Wait for the export to complete, then save or AirDrop the ZIP file</li>
                <li>Upload the ZIP here</li>
              </ol>
              <p style={{ marginTop: '0.5rem' }}><em>Note: Large exports (500MB+) may take a few minutes to parse.</em></p>
            </>
          }
        />

        <UploadZone
          title="WHOOP Data Export"
          description="Upload your WHOOP data export (ZIP or individual CSV files)."
          accept=".zip,.csv"
          endpoint="/upload/whoop"
          token={token}
          instructions={
            <>
              <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
                <li>Open the <strong>WHOOP</strong> app</li>
                <li>Go to <strong>More → App Settings → Data Export</strong></li>
                <li>Tap <strong>Create Export</strong></li>
                <li>Check your email for the download link (may take up to 30 minutes)</li>
                <li>Download the ZIP and upload it here</li>
              </ol>
            </>
          }
        />
      </div>
    </div>
  );
}
