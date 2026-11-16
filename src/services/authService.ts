import { api, apiUrl } from './http'

type LoginResponse = { accessToken: string }

export type AuthMe = {
  id: number
  email: string
  global: boolean
  globalPermissions: string[]
  organizationPermissions: Record<string, string[]>
}

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

export async function getMe(token: string): Promise<AuthMe> {
  const data = await api<AuthMe>(token, '/api/v1/auth/me')
  return {
    id: data.id,
    email: data.email ?? '',
    global: Boolean(data.global),
    globalPermissions: Array.isArray(data.globalPermissions) ? data.globalPermissions : [],
    organizationPermissions: data.organizationPermissions && typeof data.organizationPermissions === 'object'
      ? data.organizationPermissions
      : {},
  }
}
