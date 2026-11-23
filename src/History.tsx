import { FormEvent, useState } from 'react'
import { ApiError, apiUrl } from './services/http'

type Request = <T>(token: string, path: string, init?: RequestInit) => Promise<T>
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

type FilterKey = 'organizacionId' | 'reemplazante' | 'titular' | 'dni' | 'udeo' | 'periodoDesde' | 'periodoHasta'
type Filters = Record<FilterKey, string>

const PAGE_SIZE = 20
const emptyFilters: Filters = {
  organizacionId: '', reemplazante: '', titular: '', dni: '', udeo: '', periodoDesde: '', periodoHasta: '',
}

function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(value)) : '-' }
function formatPeriod(from?: string | null, to?: string | null) { return !from && !to ? '-' : `${formatDate(from)} - ${formatDate(to)}` }
function hospital(row: HistoryRow, organizations: Organization[]) {
  return row.hospitalNombre || organizations.find(item => item.id === row.organizacionId)?.nombre || 'Sin organización'
}
function udeo(row: HistoryRow, organizations: Organization[]) {
  return row.udeo || organizations.find(item => item.id === row.organizacionId)?.udeo || '-'
}

function errorText(error: unknown, hasOrganization: boolean) {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Sin permiso'
    if (error.status === 400) return hasOrganization ? (error.message || 'Los filtros indicados no son válidos.') : 'Seleccioná una organización para consultar el histórico.'
    if (error.status === 500) return 'Ocurrió un error en el servidor al consultar el histórico. Intentá nuevamente.'
    return error.message || 'No fue posible consultar el histórico de reemplazantes.'
  }
  return 'No fue posible consultar el histórico de reemplazantes.'
}

function filenameFromDisposition(header: string | null) {
  if (!header) return 'reemplazantes.pdf'
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8?.[1]) return decodeURIComponent(utf8[1])
  const simple = header.match(/filename="?([^";]+)"?/i)
  return simple?.[1] || 'reemplazantes.pdf'
}

export default function History({ token, request, onError, organizations, global, organizationId }: {
  token: string; request: Request; onError: (message: string) => void
  organizations: Organization[]; global: boolean; organizationId: string
}) {
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
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  const fixedOrganizationId = global ? '' : organizationId
  const activeOrgId = organizationId
  const fixedOrganization = organizations.find(item => String(item.id) === (global ? filters.organizacionId || activeOrgId : fixedOrganizationId))

  function update<K extends FilterKey>(key: K, value: Filters[K]) {
    setFilters(current => ({ ...current, [key]: value }))
    setPage(0)
  }

  function buildParams(nextFilters: Filters = filters, targetPage?: number) {
    const targetOrganizationId = global ? (nextFilters.organizacionId || activeOrgId) : fixedOrganizationId
    const params = new URLSearchParams()
    if (targetOrganizationId) params.set('organizacionId', targetOrganizationId)
    ;(['reemplazante', 'titular', 'udeo', 'periodoDesde', 'periodoHasta'] as const).forEach(key => {
      const value = nextFilters[key].trim()
      if (value) params.set(key, value)
    })
    const dni = nextFilters.dni.trim()
    if (dni) params.set('cuil', dni)
    if (targetPage !== undefined) { params.set('page', String(targetPage)); params.set('size', String(PAGE_SIZE)) }
    return { params, targetOrganizationId }
  }

  async function loadPage(targetPage: number, nextFilters: Filters = filters) {
    const { params, targetOrganizationId } = buildParams(nextFilters, targetPage)
    if (!targetOrganizationId) {
      setRows(null)
      setError(global ? 'Seleccioná una organización para consultar el histórico.' : 'Usuario sin organización asignada. Contacte al administrador.')
      return
    }
    setLoading(true); setError(''); onError('')
    try {
      const result = await request<Page<HistoryRow>>(token, `/api/v1/reemplazantes?${params.toString()}`)
      setRows(result)
      setPage(targetPage)
    } catch (exception) {
      setRows(null)
      if (exception instanceof ApiError && exception.status === 403) window.dispatchEvent(new Event('sisge-reemplazos-forbidden'))
      setError(errorText(exception, Boolean(targetOrganizationId)))
    } finally { setLoading(false) }
  }

  async function downloadPdf() {
    const { params, targetOrganizationId } = buildParams()
    if (!targetOrganizationId) { setError(global ? 'Seleccioná una organización para descargar el reporte.' : 'Usuario sin organización asignada. Contacte al administrador.'); return }
    setDownloading(true); setError(''); onError('')
    try {
      const response = await fetch(`${apiUrl}/api/v1/reemplazantes/reporte?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new ApiError(data.message ?? 'No fue posible descargar el reporte', response.status, data.details)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filenameFromDisposition(response.headers.get('content-disposition'))
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch (exception) {
      if (exception instanceof ApiError && exception.status === 403) window.dispatchEvent(new Event('sisge-reemplazos-forbidden'))
      setError(errorText(exception, Boolean(targetOrganizationId)))
    } finally { setDownloading(false) }
  }

  function submit(event: FormEvent) { event.preventDefault(); void loadPage(0) }
  function clear() { setFilters(emptyFilters); setPage(0); void loadPage(0, emptyFilters) }

  return <div className="stack">
    <section className="card filter-card"><form className="history-filters" onSubmit={submit}>
      {global && <label>Organización<select value={filters.organizacionId} onChange={(event) => update('organizacionId', event.target.value)}><option value="">Seleccionar organización</option>{organizations.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>}
      <label>Reemplazante<input value={filters.reemplazante} onChange={(event) => update('reemplazante', event.target.value)} placeholder="Nombre parcial" /></label>
      <label>DNI<input value={filters.dni} onChange={(event) => update('dni', event.target.value)} placeholder="Busca coincidencias en CUIL" /></label>
      <label>Titular<input value={filters.titular} onChange={(event) => update('titular', event.target.value)} placeholder="Nombre parcial" /></label>
      <label>UDEO<input value={filters.udeo} onChange={(event) => update('udeo', event.target.value)} placeholder="Código exacto" /></label>
      <label>Período reemplazo desde<input type="date" value={filters.periodoDesde} onChange={(event) => update('periodoDesde', event.target.value)} /></label>
      <label>Período reemplazo hasta<input type="date" value={filters.periodoHasta} onChange={(event) => update('periodoHasta', event.target.value)} /></label>
      <div className="history-actions"><button className="primary" disabled={loading || downloading}>{loading ? <><span className="spinner" />Buscando.</> : 'Buscar'}</button><button className="secondary" type="button" disabled={loading || downloading} onClick={() => void downloadPdf()}>{downloading ? <><span className="spinner" />Descargando.</> : 'Descargar PDF'}</button><button className="secondary" type="button" disabled={loading || downloading} onClick={clear}>Limpiar filtros</button></div>
    </form></section>
    <section className="card table-card"><div className="card-heading"><div><h2>Histórico de reemplazantes</h2><p>{global ? 'Consultá los reemplazos históricos de la organización seleccionada.' : `Consultá los reemplazos históricos de ${fixedOrganization?.nombre ?? 'tu organización'}.`}</p></div>{!global && <span className="muted">Organización: {fixedOrganization?.nombre ?? 'asignada'}</span>}</div>
      {error && <div className="alert error"><span>{error}</span></div>}
      {loading && <p className="empty">Cargando registros.</p>}
      {!loading && rows && (rows.content.length ? <div className="scroll-table"><table><thead><tr><th>Reemplazante</th><th>CUIL</th><th>Titular</th><th>Hospital</th><th>UDEO</th><th>Período</th></tr></thead><tbody>{rows.content.map(row => <tr key={row.id}><td>{row.reemplazante || '-'}</td><td>{row.cuil || '-'}</td><td>{row.titular || '-'}</td><td>{hospital(row, organizations)}</td><td>{udeo(row, organizations)}</td><td>{formatPeriod(row.periodoDesde, row.periodoHasta)}</td></tr>)}</tbody></table></div> : <p className="empty">No hay registros históricos para los filtros seleccionados.</p>)}
      {!loading && !rows && !error && <p className="empty">Aplicá los filtros y presioná Buscar para consultar el histórico.</p>}
      {!loading && rows && rows.totalPages > 1 && <div className="pagination"><button className="secondary" disabled={page <= 0} onClick={() => void loadPage(page - 1)}>Anterior</button><span>Página {page + 1} de {rows.totalPages} · {rows.totalElements} registros</span><button className="secondary" disabled={rows.last} onClick={() => void loadPage(page + 1)}>Siguiente</button></div>}
    </section>
  </div>
}



