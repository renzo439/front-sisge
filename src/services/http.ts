export const apiUrl = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
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
    throw new ApiError(data.message ?? 'La solicitud no pudo completarse', response.status)
  }
  return data as T
}

export function message(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado'
}
