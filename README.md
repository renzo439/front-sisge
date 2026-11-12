# SISGE Frontend

Interfaz web de SISGE para la gestión de Recursos Humanos. Mantiene React, Vite, TypeScript ya existente en el repositorio y autenticación JWT contra la API de SisGe.

## Desarrollo

- Node.js 20 o superior.
- API SISGE disponible en el mismo origen o definida mediante `VITE_API_URL`.

```bash
npm install
npm run dev
npm test
npm run build
```

## Arquitectura

El shell de la aplicación está compuesto por `Application`, `Sidebar`, `Breadcrumb` y `PageHeader` en `src/App.tsx`. La navegación usa rutas del navegador sin agregar dependencias:

| Área | Rutas |
| --- | --- |
| Dashboard | `/dashboard` |
| Personal | `/personal`, `/personal/legajos`, `/personal/legajos/:id` |
| Reemplazos | `/reemplazos`, `/reemplazos/nueva-carga`, `/reemplazos/importaciones`, `/reemplazos/importaciones/:id`, `/reemplazos/pendientes`, `/reemplazos/migrar-historico`, `/reemplazos/historico` |
| Auditoría | `/auditoria/relevamiento`, `/auditoria/importaciones`, `/auditoria/importaciones/:id`, `/auditoria/validacion`, `/auditoria/diferencias`, `/auditoria/historial` |
| Administración | `/administracion/*` |
| Configuración | `/configuracion/perfil`, `/configuracion/preferencias` |

`src/PersonalSurvey.tsx` contiene el flujo de importación, revisión, aprobación y consolidación de relevamientos. `src/services/http.ts` centraliza solicitudes autenticadas, errores HTTP y la invalidación de sesión por `401`. `src/services/authService.ts` centraliza el login.

## Endpoints utilizados

| Área | Endpoint |
| --- | --- |
| Autenticación | `POST /api/v1/auth/login` |
| Organizaciones | `GET /api/v1/organizaciones` |
| Personal | `GET /api/v1/personas` |
| Carga de reemplazos | `POST /api/v1/organizaciones/{organizacionId}/importaciones/upload` |
| Reemplazos | `GET /api/v1/importaciones`, `GET /api/v1/importaciones/{id}`, `PUT /api/v1/importaciones/{id}/reemplazantes/{registroId}`, `POST /api/v1/importaciones/{id}/enviar-revision` |
| Revisión de reemplazos | `GET /api/v1/admin/importaciones`, `POST /api/v1/admin/importaciones/{id}/observar`, `/rechazar`, `/aprobar`, `/cerrar` |
| Migración de histórico | `POST /api/v1/admin/importaciones/migrar-historico-consolidado`, `PUT /api/v1/admin/importaciones/{id}/organizacion` |
| Histórico | `GET /api/v1/reemplazantes` con filtros opcionales `organizacionId`, `importacionId`, `reemplazante`, `titular`, `cuil`, `dni`, `hospital`, `udeo`, `lugarTrabajo`, `fechaCarga`, `page` y `size` |
| Auditoría | `POST /api/v1/organizaciones/{organizacionId}/personal/importaciones`, `GET /api/v1/personal/importaciones/{id}`, `PUT /api/v1/personal/importaciones/{importacionId}/filas/{filaId}`, `POST /api/v1/personal/importaciones/{id}/aprobar` |
| Usuarios | `POST /api/v1/organizaciones/{organizacionId}/usuarios`, `GET /api/v1/organizaciones/{organizacionId}/usuarios`, `GET /api/v1/organizaciones/{organizacionId}/usuarios/{usuarioId}`, `PUT /api/v1/organizaciones/{organizacionId}/usuarios/{usuarioId}/rol`, `GET /api/v1/admin/usuarios`, `GET /api/v1/admin/usuarios/{usuarioId}`, `PUT /api/v1/admin/usuarios/{usuarioId}/rol-global` |
| Roles | `GET /api/v1/roles`, `GET /api/v1/roles/{id}`, `POST /api/v1/roles`, `PUT /api/v1/roles/{id}`, `DELETE /api/v1/roles/{id}` |
| Permisos | `GET /api/v1/permisos`, `GET /api/v1/permisos/{id}`, `POST /api/v1/permisos`, `PUT /api/v1/permisos/{id}`, `DELETE /api/v1/permisos/{id}` |
| Organizaciones (admin) | `GET /api/v1/admin/organizaciones`, `GET /api/v1/admin/organizaciones/{id}`, `POST /api/v1/admin/organizaciones`, `PUT /api/v1/admin/organizaciones/{id}`, `DELETE /api/v1/admin/organizaciones/{id}` |

## Funcionalidades preparadas

- Dashboard y tarjetas de gestión sin métricas inventadas.
- Detalle de legajo y pestañas visibles sin datos simulados.
- Alta de usuarios por organización y edición de rol de membresía/rol global en `/administracion/usuarios`, ABM de roles y permisos en `/administracion/roles-y-permisos`, ABM del catálogo de permisos en `/administracion/permisos` (requiere `PERMISOS_GESTIONAR`) y ABM de organizaciones en `/administracion/organizaciones` (requiere `ORGANIZACIONES_GESTIONAR`); el selector de permisos del formulario de roles se carga desde `GET /api/v1/permisos`. El resto de Administración, configuración, validación, diferencias e historial de auditoría mantiene estado explícito de dependencia de backend.
- Histórico de reemplazantes en `/reemplazos/historico` con filtros por organización, reemplazante, DNI, CUIL, titular, hospital, UDEO, importación y fecha de carga, paginación del lado del servidor y estados de error 400/403/500. Los usuarios globales pueden consultar todas las organizaciones; los usuarios de hospital quedan fijados a la organización de la sesión.
- Migración de histórico consolidado en `/reemplazos/migrar-historico`; las importaciones sin organización muestran la acción “Asociar organización”, que permite elegir una organización y ejecutar `PUT /api/v1/admin/importaciones/{id}/organizacion` conservando Hospital y UDEO originales.
- Selector de organización por nombre; el ID se usa solo internamente.

## Endpoints necesarios para completar las vistas

- `GET /api/v1/personas/{id}` para el detalle real de legajo.
- Endpoints de alta, edición y baja lógica de personas.
- Catálogos de dependencias, sectores, categorías, agrupamientos y tipos de licencia.
- Métricas para dashboard y relevamientos.
- Servicio de validación, diferencias e historial de auditoría.
- Si se desea un historial de importaciones de personal, un `GET /api/v1/personal/importaciones` paginado.

Las acciones de Administración no ejecutan solicitudes hasta que sus APIs estén disponibles.
