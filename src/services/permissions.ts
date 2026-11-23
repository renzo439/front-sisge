import type { Me } from './authService'

export const MODULE_PERMISSIONS = {
  dashboard: ['DASHBOARD_VER'],
  personal: ['LEGAJOS_VER', 'PERSONAL_VER', 'PERSONAL_IMPORTAR', 'PERSONAL_REVISAR', 'PERSONAL_VALIDAR', 'PERSONAL_APROBAR', 'PERSONAL_CONSOLIDAR'],
  auditoria: ['AUDITORIA_VER'],
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

export function hasPermission(me: Me | null | undefined, code: string): boolean {
  if (!me) return false
  return me.permissions.includes(code)
}

export function hasAnyPermission(me: Me | null | undefined, codes: readonly string[]): boolean {
  return codes.some(code => hasPermission(me, code))
}

export function canAccessReemplazos(me: Me | null | undefined): boolean {
  return hasPermission(me, 'REEMPLAZANTES_VER') || hasAnyPermission(me, ['REEMPLAZOS_NUEVA_CARGA', 'REEMPLAZOS_IMPORTACIONES', 'REEMPLAZOS_PENDIENTE_REVISION', 'IMPORTACIONES_APROBAR', 'IMPORTACIONES_CERRAR'])
}

export function canAccessReemplazosRoute(me: Me | null | undefined, path: string): boolean {
  if (path === '/reemplazos') return canAccessReemplazos(me)
  if (path.startsWith('/reemplazos/importaciones/')) return hasPermission(me, 'REEMPLAZOS_IMPORTACIONES')
  const required = REEMPLAZOS_ROUTE_PERMISSIONS[path as keyof typeof REEMPLAZOS_ROUTE_PERMISSIONS]
  if (required) return required.every(code => hasPermission(me, code))
  return hasPermission(me, 'REEMPLAZANTES_VER')
}

export function canAccessPersonal(me: Me | null | undefined): boolean { return hasPermission(me, 'LEGAJOS_VER') || hasPermission(me, 'PERSONAL_VER') }
export function canAccessAuditoria(me: Me | null | undefined): boolean { return hasPermission(me, 'AUDITORIA_VER') }
export function canAccessAdministracion(me: Me | null | undefined): boolean { return hasAnyPermission(me, MODULE_PERMISSIONS.administracion) }
export function canAccessDashboard(me: Me | null | undefined): boolean { return hasPermission(me, 'DASHBOARD_VER') || me?.global === true }
export function canAccessConfiguracion(_me: Me | null | undefined): boolean { return true }

export function getDefaultPath(me: Me | null | undefined): string {
  if (hasPermission(me, 'DASHBOARD_VER')) return '/dashboard'
  if (canAccessReemplazos(me)) return hasPermission(me, 'REEMPLAZANTES_VER') ? '/reemplazos/historico' : '/reemplazos'
  if (canAccessPersonal(me)) return '/personal/legajos'
  if (canAccessAuditoria(me)) return '/auditoria/relevamiento'
  if (canAccessAdministracion(me)) return '/administracion/usuarios'
  return '/configuracion/perfil'
}
