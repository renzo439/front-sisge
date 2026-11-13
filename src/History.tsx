import { FormEvent, useState } from 'react'
import { ApiError } from './services/http'

type Request = <T>(token: string, path: string, init?: RequestInit) => Promise<T>
type Can = (permission: string) => boolean
type Organization = { id: number; nombre: string; udeo?: string }

type HistoryRow = {
  id: number; organizacionId: number | null; hospitalNombre: string | null; udeo: string | null
  importacionId: number | null; archivoOrigen: string | null; filaOrigen: number | null
  reemplazante: string | null; cuil: string | null; dni: string | null
  categoriaReemplazante: string | null; instrumentoLegal: string | null
  periodoDesde: string | null; periodoHasta: string | null; aPagar: number | null; aDeuda: number | null
  titular: string | null; categoriaTitular: string | null; licenciaDesde: string | null; licenciaHasta: string | null
  cantidadDias: number | null; tipoLicenciaExcel: string | null; agrupamiento: string | null
  funcionTitular: string | null; tipoLicencia: string | null; observaciones: string | null
  lugarTrabajo: string | null; fechaCierre: string | null
}
type Page<T> = { content: T[]; totalElements: number; totalPages: number; number: number; last: boolean }

type FilterKey = 'organizacionId' | 'importacionId' | 'reemplazante' | 'titular' | 'cuil' | 'dni' | 'hospital' | 'udeo' | 'fechaCarga'
type Filters = Record<FilterKey, string>

const PAGE_SIZE = 20
const emptyFilters: Filters = {
  organizacionId: '', importacionId: '', reemplazante: '', titular: '', cuil: '', dni: '', hospital: '', udeo: '', fechaCarga: '',
}

function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(value)) : '—' }
function formatPeriod(from?: string | null, to?: string | null) { return !from && !to ? '—' : `${formatDate(from)} — ${formatDate(to)}` }
function hospital(row: HistoryRow) { return row.hospitalNombre || 'Sin organización' }

function errorText(error: unknown, hasOrganization: boolean) {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'No tenés permiso para consultar el histórico de reemplazantes (REEMPLAZANTES_VER).'
    if (error.status === 400) return hasOrganization ? (error.message || 'Los filtros indicados no son válidos.') : 'Seleccioná una organización para consultar el histórico.'
    if (error.status === 500) return 'Ocurrió un error en el servidor al consultar el histórico. Intentá nuevamente.'
    return error.message || 'No fue posible consultar el histórico de reemplazantes.'
  }
  return 'No fue posible consultar el histórico de reemplazantes.'
}

export default function History({ token, can, request, onError, organizations, global, organizationId }: {
  token: string; can: Can; request: Request; onError: (message: string) => void
  organizations: Organization[]; global: boolean; organizationId: string
}) {
  if (!can('REEMPLAZANTES_VER')) {
    return <section className="card pending-feature"><h2>Acceso restringido</h2><p>Se requiere el permiso REEMPLAZANTES_VER para consultar el histórico de reemplazantes.</p></section>
  }
  return <HistoryManager token={token} request={request} onError={onError} organizations={organizations} global={global} organizationId={organizationId} />
}

function HistoryManager({ token, request, onError, organizations, global, organizationId }: {
  token: string; request: Request; onError: (message: string) => void
  organizations: Organization[]; global: boolean; organizationId: string
}) {
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [rows, setRows] = useState<Page<HistoryRow> | null>(null)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fixedOrganizationId = global ? '' : organizationId
  const fixedOrganization = organizations.find(item => String(item.id) === fixedOrganizationId)

  function update<K extends FilterKey>(key: K, value: Filters[K]) {
    setFilters(current => ({ ...current, [key]: value }))
    setPage(0)
  }

  async function loadPage(targetPage: number, nextFilters: Filters = filters) {
    const targetOrganizationId = global ? nextFilters.organizacionId : fixedOrganizationId
    if (!global && !targetOrganizationId) {
      setRows(null)
      setError('No se pudo determinar la organización de la sesión. Volvé a iniciar sesión o contactá al administrador.')
      return
    }
    setLoading(true); setError(''); onError('')
    const params = new URLSearchParams()
    if (targetOrganizationId) params.set('organizacionId', targetOrganizationId)
    const filterKeys = ['importacionId', 'reemplazante', 'titular', 'cuil', 'dni', 'hospital', 'udeo', 'fechaCarga'] as const
    filterKeys.forEach(key => {
      const value = nextFilters[key].trim()
      if (value) params.set(key, value)
    })
    params.set('page', String(targetPage))
    params.set('size', String(PAGE_SIZE))
    try {
      const result = await request<Page<HistoryRow>>(token, `/api/v1/reemplazantes?${params.toString()}`)
      setRows(result)
      setPage(targetPage)
    } catch (exception) {
      setRows(null)
      setError(errorText(exception, Boolean(targetOrganizationId)))
    } finally { setLoading(false) }
  }

  function submit(event: FormEvent) { event.preventDefault(); void loadPage(0) }
  function clear() {
    setFilters(emptyFilters)
    setPage(0)
    void loadPage(0, emptyFilters)
  }

  return <div className="stack">
    <section className="card filter-card"><form className="history-filters" onSubmit={submit}>
      {global && <label>Organización<select value={filters.organizacionId} onChange={(event) => update('organizacionId', event.target.value)}><option value="">Todas las organizaciones</option>{organizations.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>}
      <label>Reemplazante<input value={filters.reemplazante} onChange={(event) => update('reemplazante', event.target.value)} placeholder="Nombre parcial" /></label>
      <label>DNI<input value={filters.dni} onChange={(event) => update('dni', event.target.value)} placeholder="Con o sin puntos" /></label>
      <label>CUIL<input value={filters.cuil} onChange={(event) => update('cuil', event.target.value)} placeholder="Exacto" /></label>
      <label>Titular<input value={filters.titular} onChange={(event) => update('titular', event.target.value)} placeholder="Nombre parcial" /></label>
      <label>Hospital<input value={filters.hospital} onChange={(event) => update('hospital', event.target.value)} placeholder="Nombre parcial" /></label>
      <label>UDEO<input value={filters.udeo} onChange={(event) => update('udeo', event.target.value)} placeholder="Código exacto" /></label>
      <label>Importación<input type="number" min="1" value={filters.importacionId} onChange={(event) => update('importacionId', event.target.value)} placeholder="ID" /></label>
      <label>Fecha de carga<input type="date" value={filters.fechaCarga} onChange={(event) => update('fechaCarga', event.target.value)} /></label>
      <div className="history-actions"><button className="primary" disabled={loading}>{loading ? <><span className="spinner" />Buscando…</> : 'Buscar'}</button><button className="secondary" type="button" disabled={loading} onClick={clear}>Limpiar filtros</button></div>
    </form></section>
    <section className="card table-card"><div className="card-heading"><div><h2>Histórico de reemplazantes</h2><p>{global ? 'Consulte los reemplazos históricos de todas las organizaciones o filtrá por una.' : `Consulte los reemplazos históricos de ${fixedOrganization?.nombre ?? 'la organización de la sesión'}.`}</p></div>{!global && <span className="muted">Organización: {fixedOrganization?.nombre ?? (fixedOrganizationId ? `#${fixedOrganizationId}` : 'no determinada')}</span>}</div>
      {error && <div className="alert error"><span>{error}</span></div>}
      {loading && <p className="empty">Cargando registros…</p>}
      {!loading && rows && (rows.content.length ? <div className="scroll-table"><table><thead><tr><th>Reemplazante</th><th>CUIL</th><th>Titular</th><th>Hospital</th><th>UDEO</th><th>Período</th></tr></thead><tbody>{rows.content.map(row => <tr key={row.id}><td>{row.reemplazante || '—'}</td><td>{row.cuil || '—'}</td><td>{row.titular || '—'}</td><td>{hospital(row)}</td><td>{row.udeo || '—'}</td><td>{formatPeriod(row.periodoDesde, row.periodoHasta)}</td></tr>)}</tbody></table></div> : <p className="empty">No hay registros históricos para los filtros seleccionados.</p>)}
      {!loading && !rows && !error && <p className="empty">Aplicá los filtros y presioná Buscar para consultar el histórico.</p>}
      {!loading && rows && rows.totalPages > 1 && <div className="pagination"><button className="secondary" disabled={page <= 0} onClick={() => void loadPage(page - 1)}>Anterior</button><span>Página {page + 1} de {rows.totalPages} · {rows.totalElements} registros</span><button className="secondary" disabled={rows.last} onClick={() => void loadPage(page + 1)}>Siguiente</button></div>}
    </section>
  </div>
}
