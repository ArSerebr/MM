// Vercel injects NEXT_PUBLIC_BACKEND_URL=/api (routePrefix).
// Docker/local: base is empty, we prepend /api ourselves.
const API_BASE =
  import.meta.env.VITE_API_BASE ??
  import.meta.env.NEXT_PUBLIC_BACKEND_URL ??
  ''

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  if (API_BASE) return `${API_BASE}${p}`
  return `/api${p}`
}
