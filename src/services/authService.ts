import { apiUrl } from './http'

type LoginResponse = { accessToken: string }

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.accessToken) throw new Error(data.message ?? 'No fue posible iniciar sesión')
  return data as LoginResponse
}
