export const apiUrl = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly details?: unknown) {
    super(message)
  }
}

export async function api<T = unknown>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('sisge-session-invalid'))
    throw new ApiError(data.message ?? 'La solicitud no pudo completarse', response.status, data.details)
  }
  return data as T
}

export function message(error: unknown) {
  if (error instanceof ApiError) {
    if (Array.isArray(error.details) && error.details.length) {
      const details = error.details
        .map((item) => {
          if (!item || typeof item !== 'object') return ''
          const detail = item as { field?: unknown; message?: unknown }
          const text = typeof detail.message === 'string' ? detail.message : ''
          return text
        })
        .filter(Boolean)
      if (details.length) return `${error.message}: ${details.join('. ')}`
    }
    return error.message
  }
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado'
}
