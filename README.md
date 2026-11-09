# SISGE Frontend

Interfaz web para la gestión de reemplazantes y la actualización del padrón de personal.

## Requisitos

- Node.js 20 o superior.
- API SISGE disponible. Configure `VITE_API_URL` con su URL si no se sirve desde el mismo origen.

```bash
npm install
npm run dev
```

Para generar una compilación de producción:

```bash
npm run build
```

## Relevamiento de Personal

El módulo **Relevamiento de Personal** reúne el listado, carga, revisión, validación, aprobación y consolidación de importaciones. Se accede desde la navegación lateral en **Legajos**. La pantalla conserva el contexto mediante breadcrumbs y muestra siempre el nombre de la organización cuando lo informa la API.

La carga no actualiza el padrón oficial: cada fila se revisa, se valida la importación, se aprueba y, solo entonces, un usuario administrativo puede consolidarla.

### Permisos necesarios

| Acción | Permiso |
| --- | --- |
| Crear una importación | `PERSONAL_IMPORTAR` |
| Revisar y guardar una fila | `PERSONAL_REVISAR` |
| Validar una importación | `PERSONAL_VALIDAR` o administración |
| Aprobar una importación | `PERSONAL_APROBAR` |
| Consolidar una importación | `PERSONAL_CONSOLIDAR` o administración |

El acceso a **Legajos** está disponible para usuarios autenticados. Las acciones anteriores se muestran únicamente cuando el token incluye el permiso correspondiente.

### Preparar el archivo

1. Prepare un archivo Excel con extensión `.xlsx`.
2. Cargue los datos en la primera hoja, incluyendo los encabezados de las columnas.
3. Incluya, como mínimo, los datos obligatorios para cada persona:
   - `DNI`
   - `Nombres`
   - `Apellido`
   - `Organizacion` u `Organización`
   - `Fecha Inicio`
4. Puede incluir además: `CUIL`, `Sexo`, `Fecha Nacimiento`, `Sector`, `Escalafon` o `Escalafón`, `Categoria` o `Categoría`, `Situacion Revista` o `Situación Revista`, `Agrupamiento`, `Funcion` o `Función`, `Antiguedad` y `Afectado`.
5. Use fechas válidas. Durante la revisión, las fechas se guardan en formato `YYYY-MM-DD`; el CUIL, si se informa, debe tener 11 dígitos.

### Importar y revisar

1. Inicie sesión y abra **Legajos**.
2. Seleccione **Nueva importación**, elija la organización por nombre y adjunte el archivo `.xlsx`.
3. Presione **Cargar Excel**. El sistema valida extensión y archivo vacío, y envía el archivo como `multipart/form-data` al endpoint:

   ```text
   POST /api/v1/organizaciones/{organizacionId}/personal/importaciones
   ```

4. Al finalizar la carga se abre el detalle de la importación. La grilla pagina de a 50 filas, admite filtros por texto, sector, estado y errores, y permite consultar los valores originales del Excel.
5. Con permiso `PERSONAL_REVISAR`, seleccione **Revisar** en cada fila, corrija los datos necesarios y guarde. Guardar una fila la marca explícitamente como revisada, incluso cuando no tenía errores.

   ```text
   GET /api/v1/personal/importaciones/{importId}
   ```

Los cambios de una fila se envían a:

```text
PUT /api/v1/personal/importaciones/{importId}/filas/{rowId}
```

La respuesta reemplaza el detalle mostrado, por lo que se reflejan inmediatamente los estados de revisión y errores devueltos por la API.

### Validar, aprobar y consolidar

**Validar importación** consulta:

```text
POST /api/v1/admin/personal/importaciones/{importId}/validar
```

El resumen muestra personas y designaciones nuevas o existentes, maestros inexistentes, filas y adicionales inválidos y posibles duplicados. Los errores bloqueantes impiden aprobar o consolidar.

El botón **Aprobar importación** se habilita solo cuando:

- todas las filas fueron revisadas explícitamente;
- ninguna fila tiene errores;
- el usuario posee `PERSONAL_APROBAR`.

La aprobación se realiza con:

```text
POST /api/v1/personal/importaciones/{importId}/aprobar
```

Luego de aprobar, la importación queda en estado `APROBADA` y se bloquea la edición. Con permiso administrativo se habilita **Consolidar**, previa confirmación reforzada:

```text
POST /api/v1/admin/personal/importaciones/{importId}/consolidar
```

La consolidación crea o actualiza personas, designaciones y adicionales del padrón. La interfaz muestra la respuesta final del backend.

### Contratos de backend requeridos

Los endpoints provistos cubren detalle, carga, edición y acciones, pero para completar el listado y los selectores por nombre el frontend necesita:

- `GET /api/v1/personal/importaciones?size=100`, con importaciones y `organizacionNombre`.
- `organizacionNombre` dentro de `GET /api/v1/personal/importaciones/{importacionId}` cuando el detalle no lo incluya.

El selector de organización consume `GET /api/v1/organizaciones`, que devuelve únicamente las organizaciones habilitadas para `PERSONAL_IMPORTAR` del usuario autenticado.

## Pruebas

```bash
npm test
```

Las pruebas focalizadas cubren carga, filtros, edición, respuestas de error y las acciones de validación, aprobación y consolidación.
