const API_BASE =
  import.meta.env.VITE_API_BASE ??
  import.meta.env.NEXT_PUBLIC_BACKEND_URL ??
  ''

export function apiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${normalized}`
}
