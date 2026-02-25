/**
 * Backend base URL from environment.
 * All API and asset URLs should use this (or api baseURL for relative /api calls).
 */
export function getBackendBaseUrl(): string {
  const u = import.meta.env.VITE_API_URL;
  if (u && typeof u === 'string') return u.replace(/\/+$/, '');
  if (import.meta.env.DEV) return 'http://localhost:3000';
  return '';
}

/** Backend base URL with trailing slash for concatenating paths (e.g. logo URLs). */
export function getBackendBaseUrlWithSlash(): string {
  const base = getBackendBaseUrl();
  return base ? `${base}/` : '';
}
