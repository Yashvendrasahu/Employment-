import { StorageBucketName, validateFileUpload } from '../lib/validations/index.ts';

let memoryToken: string | null = null;

try {
  memoryToken = sessionStorage.getItem('memployment_session_token');
} catch {
  memoryToken = null;
}

export function setAuthToken(token: string | null) {
  memoryToken = token;
  try {
    if (token) {
      sessionStorage.setItem('memployment_session_token', token);
    } else {
      sessionStorage.removeItem('memployment_session_token');
    }
  } catch {
    // Ignore storage quota or sandbox errors
  }
}

export function getAuthToken(): string | null {
  return memoryToken;
}

export function getAuthorizedFileUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('/api/storage/resumes/') || rawUrl.startsWith('/api/storage/verification-documents/')) {
    const token = getAuthToken();
    if (token) {
      const sep = rawUrl.includes('?') ? '&' : '?';
      return `${rawUrl}${sep}token=${encodeURIComponent(token)}`;
    }
  }
  return rawUrl;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export async function uploadFileToStorage(
  bucket: StorageBucketName,
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ url: string; fileName: string; size: number }> {
  const validation = validateFileUpload(bucket, file.type, file.size);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  if (onProgress) onProgress(20);

  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.readAsDataURL(file);
  });

  if (onProgress) onProgress(65);

  const result = await apiRequest<{ url: string; fileName: string; size: number }>(
    '/api/storage/upload',
    {
      method: 'POST',
      body: JSON.stringify({
        bucket,
        fileName: file.name,
        mimeType: file.type,
        base64Data,
      }),
    }
  );

  if (onProgress) onProgress(100);
  return result;
}
