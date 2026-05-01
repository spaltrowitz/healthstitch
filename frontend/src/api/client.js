import { API_BASE } from '../config';

export async function apiRequest(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(payload.error || 'Request failed');
  }

  return response.json();
}

export async function apiUpload(path, file, token, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress({ phase: 'uploading', percent: Math.round((e.loaded / e.total) * 100) });
      });
      xhr.upload.addEventListener('load', () => {
        onProgress({ phase: 'parsing', percent: 100 });
      });
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        const payload = JSON.parse(xhr.responseText || '{}');
        reject(new Error(payload.error || 'Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed'));

    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
}
