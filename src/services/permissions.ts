import type { AuthMe } from './authService'

export function hasPermission(me: AuthMe | null | undefined, code: string, organizacionId?: string | number): boolean {
  if (!me) return false
  if (me.global) return true
  if (me.globalPermissions.includes(code)) return true
  if (organizacionId !== undefined && organizacionId !== null && organizacionId !== '') {
    const perms = me.organizationPermissions[String(organizacionId)] ?? []
    return perms.includes(code)
  }
  return Object.values(me.organizationPermissions).some(perms => perms.includes(code))
}

export function canAccessReemplazos(me: AuthMe | null | undefined): boolean {
  if (!me) return false
  if (me.global) return true
  return hasPermission(me, 'REEMPLAZANTES_VER')
}

export function reemplazosOrganizationIds(me: AuthMe | null | undefined): string[] {
  if (!me || me.global) return []
  return Object.entries(me.organizationPermissions)
    .filter(([, perms]) => perms.includes('REEMPLAZANTES_VER'))
    .map(([id]) => id)
}
