const DEFAULT_API_BASE_URL = 'http://localhost:3000'

function readEnvValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function getApiBaseUrl() {
  const envValue = readEnvValue(import.meta.env?.VITE_API_BASE_URL)
  return envValue ? envValue.replace(/\/$/, '') : DEFAULT_API_BASE_URL
}

export function apiUrl(path = '') {
  const base = getApiBaseUrl()
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  return new URL(normalizedPath, normalizedBase).toString()
}