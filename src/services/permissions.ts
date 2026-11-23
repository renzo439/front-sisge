import type { AuthMe } from './authService'

export const MODULE_PERMISSIONS = {
  dashboard: ['DASHBOARD_VER'],
  personal: ['PERSONAL_VER', 'PERSONAL_IMPORTAR', 'PERSONAL_REVISAR', 'PERSONAL_VALIDAR', 'PERSONAL_APROBAR', 'PERSONAL_CONSOLIDAR'],
  auditoria: ['AUDITORIA_VER', 'PERSONAL_VER', 'PERSONAL_IMPORTAR', 'PERSONAL_REVISAR', 'PERSONAL_VALIDAR', 'PERSONAL_APROBAR', 'PERSONAL_CONSOLIDAR'],
  administracion: ['USUARIOS_GESTIONAR', 'PERMISOS_GESTIONAR', 'ORGANIZACIONES_GESTIONAR', 'ROLES_GESTIONAR'],
  reemplazos: ['REEMPLAZANTES_VER', 'REEMPLAZOS_NUEVA_CARGA', 'REEMPLAZOS_IMPORTACIONES', 'REEMPLAZOS_PENDIENTE_REVISION', 'IMPORTACIONES_APROBAR', 'IMPORTACIONES_CERRAR'],
} as const

export const REEMPLAZOS_ROUTE_PERMISSIONS = {
  '/reemplazos/nueva-carga': ['REEMPLAZOS_NUEVA_CARGA'],
  '/reemplazos/importaciones': ['REEMPLAZOS_IMPORTACIONES'],
  '/reemplazos/pendientes': ['REEMPLAZOS_PENDIENTE_REVISION'],
  '/reemplazos/migrar-historico': ['IMPORTACIONES_APROBAR', 'IMPORTACIONES_CERRAR'],
  '/reemplazos/historico': ['REEMPLAZANTES_VER'],
} as const

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

export function hasAnyPermission(me: AuthMe | null | undefined, codes: readonly string[], organizacionId?: string | number): boolean {
  return codes.some(code => hasPermission(me, code, organizacionId))
}

export function canAccessReemplazos(me: AuthMe | null | undefined): boolean {
  return hasAnyPermission(me, MODULE_PERMISSIONS.reemplazos)
}

export function canAccessReemplazosRoute(me: AuthMe | null | undefined, path: string): boolean {
  const required = REEMPLAZOS_ROUTE_PERMISSIONS[path as keyof typeof REEMPLAZOS_ROUTE_PERMISSIONS]
  if (required) return required.every(code => hasPermission(me, code))
  if (path === '/reemplazos') return canAccessReemplazos(me)
  return hasPermission(me, 'REEMPLAZANTES_VER')
}

export function canAccessPersonal(me: AuthMe | null | undefined): boolean {
  return hasAnyPermission(me, MODULE_PERMISSIONS.personal)
}

export function canAccessAuditoria(me: AuthMe | null | undefined): boolean {
  return hasAnyPermission(me, MODULE_PERMISSIONS.auditoria)
}

export function canAccessAdministracion(me: AuthMe | null | undefined): boolean {
  return hasAnyPermission(me, MODULE_PERMISSIONS.administracion)
}

export function canAccessDashboard(me: AuthMe | null | undefined): boolean {
  if (!me) return false
  if (me.global) return true
  if (hasAnyPermission(me, MODULE_PERMISSIONS.dashboard)) return true
  return canAccessPersonal(me) || canAccessAuditoria(me) || canAccessAdministracion(me)
}

export function canAccessConfiguracion(_me: AuthMe | null | undefined): boolean {
  return true
}

export function getDefaultPath(me: AuthMe | null | undefined): string {
  if (canAccessDashboard(me)) return '/dashboard'
  if (canAccessReemplazos(me)) return '/reemplazos/historico'
  if (canAccessPersonal(me)) return '/personal/legajos'
  if (canAccessAuditoria(me)) return '/auditoria/relevamiento'
  if (canAccessAdministracion(me)) return '/administracion/usuarios'
  return '/configuracion/perfil'
}

export function reemplazosOrganizationIds(me: AuthMe | null | undefined): string[] {
  if (!me || me.global) return []
  return Object.entries(me.organizationPermissions)
    .filter(([, perms]) => perms.includes('REEMPLAZANTES_VER'))
    .map(([id]) => id)
}
