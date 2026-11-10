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
| Reemplazos | `/reemplazos`, `/reemplazos/nueva-carga`, `/reemplazos/importaciones`, `/reemplazos/importaciones/:id`, `/reemplazos/pendientes`, `/reemplazos/historico` |
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
| Histórico | `GET /api/v1/reemplazantes` |
| Auditoría | `POST /api/v1/organizaciones/{organizacionId}/personal/importaciones`, `GET /api/v1/personal/importaciones/{id}`, `PUT /api/v1/personal/importaciones/{importacionId}/filas/{filaId}`, `POST /api/v1/personal/importaciones/{id}/aprobar` |

## Funcionalidades preparadas

- Dashboard y tarjetas de gestión sin métricas inventadas.
- Detalle de legajo y pestañas visibles sin datos simulados.
- Administración, configuración, validación, diferencias e historial de auditoría con estado explícito de dependencia de backend.
- Selector de organización por nombre; el ID se usa solo internamente.

## Endpoints necesarios para completar las vistas

- `GET /api/v1/personas/{id}` para el detalle real de legajo.
- Endpoints de alta, edición y baja lógica de personas.
- Catálogos de dependencias, sectores, categorías, agrupamientos y tipos de licencia.
- Métricas para dashboard y relevamientos.
- Servicio de validación, diferencias e historial de auditoría.
- Si se desea un historial de importaciones de personal, un `GET /api/v1/personal/importaciones` paginado.

Las acciones de Administración no ejecutan solicitudes hasta que sus APIs estén disponibles.
