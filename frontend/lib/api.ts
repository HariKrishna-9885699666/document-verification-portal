/**
 * DVP Frontend API Client
 *
 * Provides a typed interface for all backend API calls.
 * Automatically attaches the JWT token from localStorage to every request.
 *
 * Usage:
 *   import { api } from '@/lib/api';
 *   const docs = await api.documents.list();
 */

const API_BASE = '/api';

/**
 * Base request function with JWT auth and error handling.
 *
 * @param path    - API endpoint path (e.g., '/auth/login')
 * @param options - Fetch options (method, body, headers)
 * @returns Parsed JSON response
 * @throws Error with server message on non-OK responses
 */
async function request(path: string, options: RequestInit = {}) {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Request failed');
  }

  return res.json();
}

/**
 * Upload a file using multipart/form-data.
 * Does NOT set Content-Type (browser sets it with boundary).
 */
async function uploadFile(path: string, file: File, documentType: string) {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Request failed');
  }

  return res.json();
}

/**
 * Typed API methods organized by domain.
 */
export const api = {
  /** Authentication endpoints (no auth required) */
  auth: {
    register: (data: { name: string; email: string; password: string }) =>
      request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

    login: (data: { email: string; password: string }) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  },

  /** Document management endpoints (auth required) */
  documents: {
    upload: (file: File, documentType: string) =>
      uploadFile('/documents/upload', file, documentType),

    requestUploadUrl: (documentType: string) =>
      request('/documents/upload-url', {
        method: 'POST',
        body: JSON.stringify({ documentType }),
      }),

    confirmUpload: (id: string) =>
      request(`/documents/${id}/confirm-upload`, { method: 'POST' }),

    list: () => request('/documents'),

    get: (id: string) => request(`/documents/${id}`),

    getStatus: (id: string) => request(`/documents/${id}/status`),
  },

  /** Admin review endpoints (ADMIN/SUPER_ADMIN only) */
  admin: {
    getPending: () => request('/admin/documents/pending'),

    approve: (id: string, remarks?: string) =>
      request(`/admin/documents/${id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ remarks }),
      }),

    reject: (id: string, remarks?: string) =>
      request(`/admin/documents/${id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ remarks }),
      }),
  },
};
