const trimTrailingSlash = (value = '') => value.replace(/\/+$/, '');

const resolveBaseUrl = (value, fallback = '') => {
  const trimmed = trimTrailingSlash(value || '');
  return trimmed || fallback;
};

export const API_BASE_URL = resolveBaseUrl(import.meta.env.VITE_API_BASE_URL, '');
export const PYTHON_API_BASE_URL = resolveBaseUrl(import.meta.env.VITE_PYTHON_API_BASE_URL, '/python');
export const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
