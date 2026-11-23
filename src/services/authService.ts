import { api, apiUrl } from './http'

type LoginResponse = { accessToken: string }

export type OrganizationSummary = { id: number; nombre: string; udeo: string }

export type Me = {
  id: number
  nombre: string
  apellido: string
  username: string
  email: string
  rolGlobal: string | null
  global: boolean
  permissions: string[]
  organizacionId: number | null
  organizacion: OrganizationSummary | null
  organizaciones: OrganizationSummary[]
  globalPermissions: string[]
  organizationPermissions: Record<string, string[]>
}

export type AuthMe = Me

function asOrganization(value: unknown): OrganizationSummary | null {
  if (!value || typeof value !== 'object') return null
  const o = value as { id?: unknown; nombre?: unknown; udeo?: unknown }
  if (typeof o.id !== 'number') return null
  return { id: o.id, nombre: typeof o.nombre === 'string' ? o.nombre : '', udeo: typeof o.udeo === 'string' ? o.udeo : '' }
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

export async function getMe(token: string): Promise<Me> {
  const data = await api<Me>(token, '/api/v1/auth/me')
  const organizaciones = Array.isArray(data.organizaciones) ? data.organizaciones.map(asOrganization).filter((o): o is OrganizationSummary => Boolean(o)) : []
  const organizacion = asOrganization(data.organizacion)
  return {
    id: data.id,
    nombre: data.nombre ?? '',
    apellido: data.apellido ?? '',
    username: data.username ?? '',
    email: data.email ?? '',
    rolGlobal: data.rolGlobal ?? null,
    global: Boolean(data.global),
    permissions: Array.isArray(data.permissions) ? data.permissions.filter((p): p is string => typeof p === 'string') : [],
    organizacionId: typeof data.organizacionId === 'number' ? data.organizacionId : null,
    organizacion,
    organizaciones,
    globalPermissions: Array.isArray(data.globalPermissions) ? data.globalPermissions : [],
    organizationPermissions: data.organizationPermissions && typeof data.organizationPermissions === 'object' ? data.organizationPermissions : {},
  }
}
