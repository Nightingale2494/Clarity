// Centralized API client for Clarity.
import { getApiUrl } from '../config';

export const AUTH_TOKEN_KEY = 'clarity_auth';

export const getToken = () => localStorage.getItem(AUTH_TOKEN_KEY) || '';
export const setToken = (t) => localStorage.setItem(AUTH_TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(AUTH_TOKEN_KEY);

export class QuotaError extends Error {
  constructor(detail) {
    super('quota_exceeded');
    this.name = 'QuotaError';
    this.minutesRequired = detail?.minutes_required;
    this.minutesRemaining = detail?.minutes_remaining;
    this.partialMinutes = Number(detail?.partial_minutes) || 0;
    this.code = detail?.error || 'quota_exceeded';
  }
}

export const QUOTA_WALL_EVENT = 'clarity:quota-wall';
export function openQuotaWall() {}

// Drop-in fetch wrapper.
export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  return fetch(getApiUrl(path), { ...options, headers });
}

export class ApiError extends Error {
  constructor(status, detail, raw) {
    super(`${status}: ${raw}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

// Convenience JSON helper.
export async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = '';
    try {
      const d = JSON.parse(text).detail;
      if (typeof d === 'string') detail = d;
    } catch (_) { /* not JSON */ }
    throw new ApiError(res.status, detail, text);
  }
  return res.json();
}
