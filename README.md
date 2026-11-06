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

## Migración de personal

La migración actualiza el padrón oficial mediante una importación controlada: los datos no se incorporan al padrón hasta que una persona autorizada revise y apruebe cada fila.

### Permisos necesarios

| Acción | Permiso |
| --- | --- |
| Crear una importación | `PERSONAL_IMPORTAR` |
| Revisar y guardar una fila | `PERSONAL_REVISAR` |
| Aprobar una importación | `PERSONAL_APROBAR` |

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
2. Indique el ID de la organización.
3. Seleccione **Importar personal** y adjunte el archivo `.xlsx`.
4. Presione **Importar y revisar**. El sistema envía el archivo como `multipart/form-data` al endpoint:

   ```text
   POST /api/v1/organizaciones/{organizacionId}/personal/importaciones
   ```

5. Al finalizar la carga se abre el detalle de la importación. Revise las filas y los errores informados por la API.
6. Con permiso `PERSONAL_REVISAR`, seleccione **Revisar** en cada fila, corrija los datos necesarios y guarde. Guardar una fila la marca explícitamente como revisada, incluso cuando no tenía errores.
7. Use **Recargar** para consultar nuevamente el detalle de la importación:

   ```text
   GET /api/v1/personal/importaciones/{importId}
   ```

Los cambios de una fila se envían a:

```text
PUT /api/v1/personal/importaciones/{importId}/filas/{rowId}
```

La respuesta reemplaza el detalle mostrado, por lo que se reflejan inmediatamente los estados de revisión y errores devueltos por la API.

### Aprobar la migración

El botón **Aprobar importación** se habilita solo cuando:

- todas las filas fueron revisadas explícitamente;
- ninguna fila tiene errores;
- el usuario posee `PERSONAL_APROBAR`.

La aprobación se realiza con:

```text
POST /api/v1/personal/importaciones/{importId}/aprobar
```

Luego de aprobar, la importación queda en estado `APROBADA`, se bloquean la edición y la aprobación posterior, y se actualiza el padrón oficial. El padrón puede consultarse desde Legajos filtrando por organización y buscando por DNI, CUIL, nombre o apellido.
