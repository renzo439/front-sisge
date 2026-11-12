import { FormEvent, useEffect, useState } from 'react'
import { ApiError } from './services/http'

type Request = <T>(token: string, path: string, init?: RequestInit) => Promise<T>
type Can = (permission: string) => boolean
type Organization = { id: number; nombre: string; udeo?: string | null }

type MigrationSummary = {
  id: number
  organizacionId: number | null
  organizacionNombre: string | null
  hospitalNombre: string | null
  udeo: string | null
  archivoOrigen: string | null
  estado: string
  cantidadFilas: number
  cantidadFilasConError: number
}

function migrationError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'No tenés permiso para migrar el histórico de reemplazantes.'
    if (error.status === 409) return error.message || 'El archivo contiene filas con errores que impiden la migración.'
    if (error.status === 400) return error.message || 'El archivo o los datos enviados no son válidos.'
    if (error.status === 404) return 'No se encontró el recurso solicitado.'
    return error.message || 'No fue posible migrar el histórico.'
  }
  return 'No fue posible migrar el histórico.'
}

function organizationsError(error: unknown) {
  if (error instanceof ApiError && error.status === 403) return 'No tenés permiso para consultar las organizaciones.'
  return 'No fue posible cargar las organizaciones.'
}

function associationError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'No tenés permiso para asociar organizaciones a importaciones.'
    if (error.status === 404) return 'La importación o la organización seleccionada ya no existe.'
    if (error.status === 409) return 'La importación ya tiene una organización asociada.'
    if (error.status === 400) return error.message || 'Los datos enviados no son válidos.'
    return error.message || 'No fue posible asociar la organización.'
  }
  return 'No fue posible asociar la organización.'
}

function organizationLabel(row: MigrationSummary) {
  if (!row.organizacionId) return 'Sin organización'
  return row.organizacionNombre || `Organización #${row.organizacionId}`
}

function mergeAssociatedRow(row: MigrationSummary, updated: Partial<MigrationSummary> | null, organization: Organization | undefined): MigrationSummary {
  const serverRow = updated && updated.id === row.id ? updated : null
  return {
    ...row,
    ...(serverRow ?? {}),
    hospitalNombre: row.hospitalNombre,
    udeo: row.udeo,
    organizacionId: serverRow?.organizacionId ?? organization?.id ?? row.organizacionId,
    organizacionNombre: serverRow?.organizacionNombre ?? organization?.nombre ?? row.organizacionNombre,
  }
}

export default function Migration({ token, can, request }: {
  token: string; can: Can; request: Request
}) {
  if (!can('IMPORTACIONES_APROBAR') || !can('IMPORTACIONES_CERRAR')) {
    return <section className="card pending-feature"><h2>Acceso restringido</h2><p>Se requieren los permisos globales IMPORTACIONES_APROBAR e IMPORTACIONES_CERRAR para migrar el histórico.</p></section>
  }
  return <MigrationManager token={token} request={request} />
}

function MigrationManager({ token, request }: { token: string; request: Request }) {
  const [file, setFile] = useState<File | null>(null)
  const [results, setResults] = useState<MigrationSummary[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [associating, setAssociating] = useState<MigrationSummary | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [organizationId, setOrganizationId] = useState('')
  const [loadingOrganizations, setLoadingOrganizations] = useState(false)
  const [associationFailure, setAssociationFailure] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  async function migrate(event: FormEvent) {
    event.preventDefault()
    if (!file) {
      setError('Seleccioná un archivo .xlsx para migrar.')
      return
    }
    setLoading(true); setError(''); setToast('')
    try {
      const form = new FormData()
      form.append('file', file)
      const migrated = await request<MigrationSummary[]>(token, '/api/v1/admin/importaciones/migrar-historico-consolidado', { method: 'POST', body: form })
      setResults(migrated)
      setToast(migrated.length ? `Se migraron ${migrated.length} importaciones históricas.` : 'La migración no generó importaciones.')
    } catch (exception) {
      setError(migrationError(exception))
    } finally {
      setLoading(false)
    }
  }

  async function openAssociation(row: MigrationSummary) {
    setAssociating(row)
    setOrganizationId('')
    setAssociationFailure('')
    setOrganizations([])
    setLoadingOrganizations(true)
    try {
      setOrganizations(await request<Organization[]>(token, '/api/v1/admin/organizaciones'))
    } catch (exception) {
      setAssociationFailure(organizationsError(exception))
    } finally {
      setLoadingOrganizations(false)
    }
  }

  async function associate() {
    if (!associating) return
    if (!organizationId) {
      setAssociationFailure('Seleccioná una organización.')
      return
    }
    const target = associating
    setSaving(true); setAssociationFailure('')
    try {
      const updated = await request<Partial<MigrationSummary> | null>(token, `/api/v1/admin/importaciones/${target.id}/organizacion`, {
        method: 'PUT',
        body: JSON.stringify({ organizacionId: Number(organizationId) }),
      })
      const organization = organizations.find(item => String(item.id) === organizationId)
      setResults(current => current?.map(row => row.id === target.id ? mergeAssociatedRow(row, updated, organization) : row) ?? null)
      setAssociating(null)
      setToast('Organización asociada correctamente.')
    } catch (exception) {
      setAssociationFailure(associationError(exception))
    } finally {
      setSaving(false)
    }
  }

  return <div className="stack">
    <section className="card">
      <div className="card-heading"><div><h2>Migrar histórico consolidado</h2><p>Importe un archivo Excel histórico. Las importaciones sin organización podrán asociarse después.</p></div></div>
      <form className="upload-form" onSubmit={migrate}>
        <label className="file-input">Archivo Excel<input type="file" aria-label="Archivo Excel" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><span>{file ? file.name : 'Seleccionar archivo .xlsx'}</span></label>
        <button className="primary" disabled={loading}>{loading ? <><span className="spinner" />Migrando…</> : 'Migrar archivo'}</button>
      </form>
      {error && <div className="alert error"><span>{error}</span></div>}
    </section>

    <section className="card table-card">
      <div className="card-heading"><div><h2>Resultado de la migración</h2><p>Asocie una organización a las importaciones que no la tengan informada.</p></div></div>
      {loading && <p className="empty">Procesando migración…</p>}
      {!loading && !results && <p className="empty">Seleccioná un archivo y presioná Migrar archivo para ver el resultado.</p>}
      {!loading && results && (results.length
        ? <div className="scroll-table"><table>
            <thead><tr><th>ID</th><th>Archivo</th><th>Organización</th><th>Hospital</th><th>UDEO</th><th>Estado</th><th>Filas</th><th>Acciones</th></tr></thead>
            <tbody>{results.map(row => <tr key={row.id}>
              <td>#{row.id}</td>
              <td>{row.archivoOrigen || '—'}</td>
              <td>{organizationLabel(row)}</td>
              <td>{row.hospitalNombre || '—'}</td>
              <td>{row.udeo || '—'}</td>
              <td>{row.estado}</td>
              <td>{row.cantidadFilas}{row.cantidadFilasConError ? ` (${row.cantidadFilasConError} con errores)` : ''}</td>
              <td className="row-actions">{row.organizacionId ? <span className="muted">Organización asociada</span> : <button className="link-button" onClick={() => void openAssociation(row)}>Asociar organización</button>}</td>
            </tr>)}</tbody>
          </table></div>
        : <p className="empty">La migración no generó importaciones.</p>)}
    </section>

    {associating && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true">
      <div className="card-heading"><div><h2>Asociar organización</h2><p>Importación #{associating.id} · {associating.archivoOrigen || 'archivo sin nombre'}</p></div><button className="close" type="button" onClick={() => setAssociating(null)} disabled={saving}>×</button></div>
      <p className="muted">Hospital original: <strong>{associating.hospitalNombre || '—'}</strong> · UDEO: <strong>{associating.udeo || '—'}</strong></p>
      {associationFailure && <div className="alert error"><span>{associationFailure}</span></div>}
      {loadingOrganizations
        ? <p className="empty">Cargando organizaciones…</p>
        : <div className="form-grid"><label>Organización<select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} disabled={saving} required><option value="">Seleccionar organización</option>{organizations.map(item => <option key={item.id} value={item.id}>{item.nombre}{item.udeo ? ` · ${item.udeo}` : ''}</option>)}</select></label></div>}
      {!loadingOrganizations && !organizations.length && <p className="field-note">No hay organizaciones disponibles para asociar.</p>}
      <div className="action-group"><button className="secondary" type="button" onClick={() => setAssociating(null)} disabled={saving}>Cancelar</button><button className="primary" disabled={saving || loadingOrganizations || !organizationId} onClick={() => void associate()}>{saving ? <><span className="spinner" />Asociando…</> : 'Asociar'}</button></div>
    </section></div>}

    {toast && <div className="toast" role="status">{toast}</div>}
  </div>
}
