export function apiUrl(path, baseUrl = import.meta.env?.VITE_API_BASE_URL || '') {
  const base = baseUrl.trim().replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}