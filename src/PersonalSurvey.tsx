import { FormEvent, useEffect, useMemo, useState } from 'react'

type Request = <T>(token: string, path: string, init?: RequestInit) => Promise<T>
type Can = (permission: string) => boolean
type Organization = { id: number; nombre: string; udeo?: string }
type ImportRow = {
  id: number; filaOrigen: number; valoresCrudos?: string; dni?: string | null; cuil?: string | null
  nombres?: string | null; apellido?: string | null; sexo?: string | null; fechaNacimiento?: string | null
  organizacionId?: number | null; organizacionNombre?: string | null; dependencia?: string | null
  sectorId?: number | null; sectorNombre?: string | null; sector?: string | null; escalafon?: string | null
  categoria?: string | null; situacionRevista?: string | null; agrupamiento?: string | null; funcion?: string | null
  tipoAfectacion?: string | null; titulo?: string | null; fechaInicio?: string | null; antiguedadAnios?: number | null
  afectado?: boolean | null; adicionalMH?: string | null; adicionalJefatura?: string | null; revisada: boolean; errores?: string | null
}
type ImportDetail = {
  id: number; organizacionId: number; organizacionNombre?: string | null; archivoOrigen: string; estado: string
  fechaCreacion?: string; creadoPorEmail?: string; responsable?: string; cantidadFilas?: number
  cantidadFilasValidas?: number; cantidadFilasConError?: number; filas: ImportRow[]
}
type ImportSummary = Omit<ImportDetail, 'filas'> & { filas?: ImportRow[] }
type Page<T> = { content: T[]; totalPages?: number; totalElements?: number }
type View = 'list' | 'upload' | 'detail'
type Validation = Record<string, unknown> & { erroresBloqueantes?: boolean; filasInvalidas?: number }

const text = (value: unknown) => value == null || value === '' ? '—' : String(value)
const digits = (value: string) => value.replace(/\D/g, '')
const dateInput = (value?: string | null) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(value)) : '—'
const formatDni = (value?: string | null) => { const result = digits(value ?? ''); return result ? new Intl.NumberFormat('es-AR').format(Number(result)) : '—' }
const formatCuil = (value?: string | null) => { const result = digits(value ?? ''); return result.length === 11 ? `${result.slice(0, 2)}-${result.slice(2, 10)}-${result.slice(10)}` : result || '—' }

function errorText(error: unknown) { return error instanceof Error ? error.message : 'No fue posible completar la solicitud.' }
function errors(row: ImportRow) { return row.errores?.trim() ?? '' }
function rowState(row: ImportRow) { return errors(row) ? 'error' : row.revisada ? 'valid' : 'pending' }
function rowValues(row: ImportRow) {
  try {
    const parsed: unknown = JSON.parse(row.valoresCrudos ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch { return {} }
}
function raw(row: ImportRow, ...keys: string[]) {
  const values = rowValues(row)
  const key = Object.keys(values).find(candidate => keys.some(expected => candidate.toLowerCase() === expected.toLowerCase()))
  return key ? String(values[key] ?? '') : ''
}
function status(value: string) { return <span className={`status status-${value.toLowerCase()}`}>{value.replace(/_/g, ' ')}</span> }
function isDetail(response: ImportDetail | Validation): response is ImportDetail { return Array.isArray((response as ImportDetail).filas) }
function badge(row: ImportRow) {
  const state = rowState(row)
  return <span className={`review-badge ${state}`}>{state === 'error' ? 'Con errores' : state === 'valid' ? 'Válida y revisada' : 'Pendiente'}</span>
}

export default function PersonalSurvey({ token, can, request, onError }: { token: string; can: Can; request: Request; onError: (message: string) => void }) {
  const [view, setView] = useState<View>('list')
  const [imports, setImports] = useState<ImportSummary[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrganization, setSelectedOrganization] = useState('')
  const [detail, setDetail] = useState<ImportDetail | null>(null)
  const [loading, setLoading] = useState(false)

  async function loadImports() {
    setLoading(true); onError('')
    try {
      const response = await request<Page<ImportSummary> | ImportSummary[]>(token, '/api/v1/personal/importaciones?size=100')
      const content = Array.isArray(response) ? response : response.content
      setImports(content)
    } catch (error) { onError(errorText(error)) } finally { setLoading(false) }
  }
  useEffect(() => {
    let active = true
    async function initialLoad() {
      try {
        const [response, catalog] = await Promise.all([
          request<Page<ImportSummary> | ImportSummary[]>(token, '/api/v1/personal/importaciones?size=100'),
          request<Organization[]>(token, '/api/v1/organizaciones'),
        ])
        if (!active) return
        const content = Array.isArray(response) ? response : response.content
        setImports(content); setOrganizations(catalog)
      } catch (error) {
        if (active) onError(errorText(error))
      }
    }
    void initialLoad()
    return () => { active = false }
  }, [request, token, onError])
  async function open(importId: number) {
    setLoading(true); onError('')
    try {
      const result = await request<ImportDetail>(token, `/api/v1/personal/importaciones/${importId}`)
      setDetail(result); setView('detail')
    } catch (error) { onError(errorText(error)) } finally { setLoading(false) }
  }
  function showList() { setView('list'); setDetail(null); void loadImports() }

  return <div className="stack personal-survey">
    <div className="breadcrumbs">Relevamiento de Personal <span>›</span> Importaciones {detail && <><span>›</span> {detail.organizacionNombre ?? 'Organización sin nombre'}</>}</div>
    <div className="personal-heading">
      <div><p className="eyebrow">RELEVAMIENTO DE PERSONAL</p><h2>{view === 'upload' ? 'Nueva importación' : view === 'detail' ? 'Importación de personal' : 'Importaciones'}</h2></div>
      {view !== 'upload' && can('PERSONAL_IMPORTAR') && <button className="primary" onClick={() => setView('upload')}>Nueva importación</button>}
      {view === 'upload' && <button className="secondary" onClick={showList}>Volver a importaciones</button>}
    </div>
    {view === 'list' && <ImportList imports={imports} loading={loading} onOpen={open} onReload={loadImports} />}
    {view === 'upload' && <UploadForm token={token} request={request} organizations={organizations} organizationId={selectedOrganization} onOrganization={setSelectedOrganization} onCreated={(created) => { setDetail(created); setView('detail') }} onError={onError} />}
    {view === 'detail' && detail && <ImportWorkspace token={token} can={can} request={request} detail={detail} organizations={organizations} onReplace={setDetail} onBack={showList} onError={onError} />}
  </div>
}

function ImportList({ imports, loading, onOpen, onReload }: { imports: ImportSummary[]; loading: boolean; onOpen: (id: number) => void; onReload: () => Promise<void> }) {
  return <section className="card table-card">
    <div className="card-heading"><div><h2>Importaciones de personal</h2><p>Seleccione una importación para revisar sus filas y continuar el proceso.</p></div><button className="secondary" disabled={loading} onClick={() => void onReload()}>{loading ? 'Actualizando…' : 'Actualizar'}</button></div>
    {loading && !imports.length ? <p className="empty">Cargando importaciones…</p> : imports.length ? <div className="scroll-table"><table><thead><tr><th>Archivo</th><th>Organización</th><th>Estado</th><th>Fecha</th><th>Filas</th><th>Errores</th><th /></tr></thead><tbody>{imports.map(item => <tr key={item.id}><td>{item.archivoOrigen}</td><td>{item.organizacionNombre ?? 'Organización sin nombre'}</td><td>{status(item.estado)}</td><td>{formatDate(item.fechaCreacion)}</td><td>{item.cantidadFilas ?? '—'}</td><td>{item.cantidadFilasConError ?? '—'}</td><td><button className="link-button" onClick={() => onOpen(item.id)}>Abrir</button></td></tr>)}</tbody></table></div> : <p className="empty">No hay importaciones de personal disponibles.</p>}
  </section>
}

function UploadForm({ token, request, organizations, organizationId, onOrganization, onCreated, onError }: { token: string; request: Request; organizations: Organization[]; organizationId: string; onOrganization: (value: string) => void; onCreated: (detail: ImportDetail) => void; onError: (message: string) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); onError('')
    if (!organizationId) return onError('Seleccione una organización.')
    if (!file || !file.name.toLowerCase().endsWith('.xlsx') || file.size === 0) return onError('Seleccione un archivo .xlsx que no esté vacío.')
    setLoading(true)
    try {
      const form = new FormData(); form.append('file', file)
      onCreated(await request<ImportDetail>(token, `/api/v1/organizaciones/${organizationId}/personal/importaciones`, { method: 'POST', body: form }))
    } catch (error) { onError(errorText(error)) } finally { setLoading(false) }
  }
  return <section className="card"><div className="notice">La carga no modifica el padrón definitivo. Primero debe realizarse el relevamiento, validación, aprobación y consolidación.</div>
    <form className="upload-form" onSubmit={submit}><label>Organización<select value={organizationId} onChange={event => onOrganization(event.target.value)} required><option value="">Seleccionar organización</option>{organizations.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
      {!organizations.length && <p className="field-note">No hay organizaciones disponibles para importar personal.</p>}
      <label className="file-input" htmlFor="personal-import-file">Archivo Excel<input id="personal-import-file" aria-label="Archivo Excel" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event => setFile(event.target.files?.[0] ?? null)} required /><span>{file?.name ?? 'Seleccionar archivo .xlsx'}</span></label>
      <button className="primary" disabled={loading || !organizations.length}>{loading ? 'Cargando…' : 'Cargar Excel'}</button>
    </form>
  </section>
}

function ImportWorkspace({ token, can, request, detail, organizations, onReplace, onBack, onError }: { token: string; can: Can; request: Request; detail: ImportDetail; organizations: Organization[]; onReplace: (detail: ImportDetail) => void; onBack: () => void; onError: (message: string) => void }) {
  const [filters, setFilters] = useState({ q: '', errors: false, state: 'all', sector: '' })
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<ImportRow | null>(null)
  const [original, setOriginal] = useState<ImportRow | null>(null)
  const [validation, setValidation] = useState<Validation | null>(null)
  const [confirm, setConfirm] = useState<'approve' | 'consolidate' | null>(null)
  const [acting, setActing] = useState(false)
  const perPage = 50
  const counts = useMemo(() => ({ total: detail.cantidadFilas ?? detail.filas.length, valid: detail.cantidadFilasValidas ?? detail.filas.filter(row => row.revisada && !errors(row)).length, errors: detail.cantidadFilasConError ?? detail.filas.filter(row => Boolean(errors(row))).length }), [detail])
  const sectors = useMemo(() => [...new Set(detail.filas.map(row => row.sectorNombre ?? row.sector).filter((value): value is string => Boolean(value)))], [detail])
  const visible = useMemo(() => detail.filas.filter(row => {
    const haystack = `${row.dni ?? ''} ${row.cuil ?? ''} ${row.apellido ?? ''} ${row.nombres ?? ''}`.toLowerCase()
    const statusMatch = filters.state === 'all' || (filters.state === 'pending' && !row.revisada) || (filters.state === 'reviewed' && row.revisada) || (filters.state === 'valid' && rowState(row) === 'valid') || (filters.state === 'error' && rowState(row) === 'error')
    return (!filters.q || haystack.includes(filters.q.toLowerCase())) && (!filters.errors || Boolean(errors(row))) && statusMatch && (!filters.sector || (row.sectorNombre ?? row.sector) === filters.sector)
  }), [detail.filas, filters])
  const pageRows = visible.slice(page * perPage, (page + 1) * perPage)
  const blocking = Boolean(validation?.erroresBloqueantes) || Number(validation?.filasInvalidas ?? 0) > 0
  const ready = detail.filas.every(row => row.revisada && !errors(row)) && !blocking
  const canValidate = can('PERSONAL_VALIDAR') || can('ADMIN')
  const canApprove = can('PERSONAL_APROBAR')
  const canConsolidate = can('PERSONAL_CONSOLIDAR') || can('ADMIN')
  useEffect(() => setPage(0), [filters])
  async function validate() {
    setActing(true); onError('')
    try { setValidation(await request<Validation>(token, `/api/v1/admin/personal/importaciones/${detail.id}/validar`, { method: 'POST' })) } catch (error) { onError(errorText(error)) } finally { setActing(false) }
  }
  async function action() {
    if (!confirm) return
    const path = confirm === 'approve' ? `/api/v1/personal/importaciones/${detail.id}/aprobar` : `/api/v1/admin/personal/importaciones/${detail.id}/consolidar`
    setActing(true); onError('')
    try {
      const response = await request<ImportDetail | Validation>(token, path, { method: 'POST' })
      if (isDetail(response)) onReplace(response)
      else setValidation(response)
      setConfirm(null)
    } catch (error) { onError(errorText(error)) } finally { setActing(false) }
  }
  function rowSaved(updated: ImportRow | ImportDetail) {
    if (isDetail(updated)) { onReplace(updated); return }
    onReplace({ ...detail, filas: detail.filas.map(row => row.id === updated.id ? updated : row) })
  }
  return <><section className="card import-summary"><div><p className="eyebrow">IMPORTACIÓN</p><h2>{detail.archivoOrigen} {status(detail.estado)}</h2><p><strong>{detail.organizacionNombre ?? 'Organización sin nombre'}</strong> · {formatDate(detail.fechaCreacion)} · {detail.creadoPorEmail ?? detail.responsable ?? 'Responsable no disponible'}</p></div><div className="stat-grid"><Stat label="Procesadas" value={counts.total} /><Stat label="Válidas" value={counts.valid} /><Stat label="Con errores" value={counts.errors} /></div></section>
    <section className="card action-bar"><div><h2>Acciones administrativas</h2><p>Validar antes de aprobar. La consolidación crea o actualiza el padrón definitivo.</p></div><div className="action-group">{canValidate && <button className="secondary" disabled={acting} onClick={() => void validate()}>Validar importación</button>}{canApprove && <button className="primary" disabled={!ready || detail.estado === 'APROBADA' || acting} onClick={() => setConfirm('approve')}>Aprobar importación</button>}{canConsolidate && <button className="danger-button" disabled={detail.estado !== 'APROBADA' || blocking || acting} onClick={() => setConfirm('consolidate')}>Consolidar</button>}<button className="link-button" onClick={onBack}>Volver</button></div></section>
    {validation && <ValidationSummary validation={validation} />}
    <section className="card table-card"><div className="filter-grid"><label>Buscar<input value={filters.q} onChange={event => setFilters({ ...filters, q: event.target.value })} placeholder="DNI, CUIL, apellido o nombres" /></label><label>Sector<select value={filters.sector} onChange={event => setFilters({ ...filters, sector: event.target.value })}><option value="">Todos</option>{sectors.map(item => <option key={item}>{item}</option>)}</select></label><label>Estado<select value={filters.state} onChange={event => setFilters({ ...filters, state: event.target.value })}><option value="all">Todos</option><option value="pending">Pendientes</option><option value="reviewed">Revisadas</option><option value="valid">Válidas</option><option value="error">Con errores</option></select></label><label className="check-label"><input type="checkbox" checked={filters.errors} onChange={event => setFilters({ ...filters, errors: event.target.checked })} /> Solo con errores</label></div>
      <div className="scroll-table personnel-table"><table><thead><tr><th>Fila</th><th>DNI</th><th>CUIL</th><th>Apellido</th><th>Nombres</th><th>Organización</th><th>Dependencia</th><th>Sector</th><th>Escalafón</th><th>Categoría</th><th>Situación</th><th>Agrupamiento</th><th>Función</th><th>Inicio</th><th>Antigüedad</th><th>Afectado</th><th>Adic. M/H</th><th>Adic. jefatura</th><th>Revisión</th><th>Errores</th><th /></tr></thead><tbody>{pageRows.map(row => <tr key={row.id} className={`row-${rowState(row)}`}><td>{row.filaOrigen}</td><td>{formatDni(row.dni)}</td><td>{formatCuil(row.cuil)}</td><td>{text(row.apellido)}</td><td>{text(row.nombres)}</td><td>{row.organizacionNombre ?? detail.organizacionNombre ?? '—'}</td><td>{text(row.dependencia)}</td><td>{text(row.sectorNombre ?? row.sector)}</td><td>{text(row.escalafon)}</td><td>{text(row.categoria)}</td><td>{text(row.situacionRevista)}</td><td>{text(row.agrupamiento)}</td><td>{text(row.funcion)}</td><td>{formatDate(row.fechaInicio ?? undefined)}</td><td>{text(row.antiguedadAnios)}</td><td>{row.afectado ? 'Sí' : 'No'}</td><td>{text(row.adicionalMH)}</td><td>{text(row.adicionalJefatura)}</td><td>{badge(row)}</td><td>{errors(row) ? <button className="error-button" onClick={() => setOriginal(row)}>{errors(row)}</button> : '—'}</td><td><div className="row-actions">{can('PERSONAL_REVISAR') && detail.estado !== 'APROBADA' && <button className="link-button" onClick={() => setEditing(row)}>{row.revisada ? 'Editar' : 'Revisar'}</button>}<button className="link-button" onClick={() => setOriginal(row)}>Original</button></div></td></tr>)}</tbody></table></div>
      {!visible.length && <p className="empty">No hay filas para los filtros seleccionados.</p>}<Pager page={page} total={visible.length} perPage={perPage} onChange={setPage} /></section>
    {editing && <RowEditor row={editing} importId={detail.id} token={token} request={request} organizations={organizations} onClose={() => setEditing(null)} onSaved={row => { rowSaved(row); setEditing(null) }} onError={onError} />}
    {original && <OriginalDialog row={original} onClose={() => setOriginal(null)} />}
    {confirm && <ConfirmDialog action={confirm} loading={acting} onCancel={() => setConfirm(null)} onConfirm={action} />}
  </>
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="stat"><strong>{value}</strong><span>{label}</span></div> }
function Pager({ page, total, perPage, onChange }: { page: number; total: number; perPage: number; onChange: (page: number) => void }) {
  const pages = Math.ceil(total / perPage)
  return pages > 1 ? <div className="pagination"><button className="secondary" disabled={!page} onClick={() => onChange(page - 1)}>Anterior</button><span>Página {page + 1} de {pages} ({total} filas)</span><button className="secondary" disabled={page + 1 >= pages} onClick={() => onChange(page + 1)}>Siguiente</button></div> : null
}
function ValidationSummary({ validation }: { validation: Validation }) {
  const labels: Record<string, string> = { personasNuevas: 'Personas nuevas', personasExistentes: 'Personas existentes', designacionesNuevas: 'Designaciones nuevas', designacionesExistentes: 'Designaciones existentes', maestrosInexistentes: 'Maestros inexistentes', filasInvalidas: 'Filas inválidas', adicionalesInvalidos: 'Adicionales inválidos', posiblesDuplicados: 'Posibles duplicados', creados: 'Creados', actualizados: 'Actualizados', errores: 'Errores' }
  return <section className="card validation-summary"><h2>Resultado de la validación</h2><div className="validation-grid">{Object.entries(labels).map(([key, label]) => <div key={key}><span>{label}</span><strong>{text(validation[key])}</strong></div>)}</div>{Boolean(validation.erroresBloqueantes) && <div className="alert error">La validación detectó errores bloqueantes. Corrija las filas antes de aprobar o consolidar.</div>}</section>
}
function OriginalDialog({ row, onClose }: { row: ImportRow; onClose: () => void }) { return <div className="modal-backdrop"><section className="modal"><div className="card-heading"><h2>Datos originales del Excel</h2><button className="close" onClick={onClose}>×</button></div><pre className="raw-values">{JSON.stringify(rowValues(row), null, 2)}</pre></section></div> }
function ConfirmDialog({ action, loading, onCancel, onConfirm }: { action: 'approve' | 'consolidate'; loading: boolean; onCancel: () => void; onConfirm: () => void }) { const consolidation = action === 'consolidate'; return <div className="modal-backdrop"><section className="modal confirm-dialog"><h2>{consolidation ? 'Confirmar consolidación' : 'Confirmar aprobación'}</h2><p>{consolidation ? 'Esta acción crea o actualiza personas, designaciones y adicionales en el padrón definitivo.' : 'La importación quedará aprobada y no podrá seguir editándose.'}</p><div className="action-group"><button className="secondary" onClick={onCancel}>Cancelar</button><button className={consolidation ? 'danger-button' : 'primary'} disabled={loading} onClick={onConfirm}>{loading ? 'Procesando…' : 'Confirmar'}</button></div></section></div> }

function RowEditor({ row, importId, token, request, organizations, onClose, onSaved, onError }: { row: ImportRow; importId: number; token: string; request: Request; organizations: Organization[]; onClose: () => void; onSaved: (row: ImportRow | ImportDetail) => void; onError: (message: string) => void }) {
  const [form, setForm] = useState(() => ({ dni: row.dni ?? raw(row, 'dni'), cuil: row.cuil ?? raw(row, 'cuil'), apellido: row.apellido ?? raw(row, 'apellido'), nombres: row.nombres ?? raw(row, 'nombres'), sexo: row.sexo ?? '', fechaNacimiento: dateInput(row.fechaNacimiento), organizacionId: String(row.organizacionId ?? ''), dependencia: row.dependencia ?? '', sectorId: String(row.sectorId ?? ''), sectorNombre: row.sectorNombre ?? row.sector ?? '', escalafon: row.escalafon ?? '', categoria: row.categoria ?? '', situacionRevista: row.situacionRevista ?? '', agrupamiento: row.agrupamiento ?? '', funcion: row.funcion ?? '', tipoAfectacion: row.tipoAfectacion ?? '', titulo: row.titulo ?? '', fechaInicio: dateInput(row.fechaInicio), antiguedadAnios: row.antiguedadAnios?.toString() ?? '', afectado: Boolean(row.afectado), adicionalMH: row.adicionalMH ?? '', adicionalJefatura: row.adicionalJefatura ?? '' }))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  function set(key: keyof typeof form, value: string | boolean) { setForm(current => ({ ...current, [key]: value })); setFieldErrors(current => ({ ...current, [key]: '' })) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!digits(form.dni)) next.dni = 'El DNI es obligatorio.'
    if (!form.apellido.trim()) next.apellido = 'El apellido es obligatorio.'
    if (!form.nombres.trim()) next.nombres = 'Los nombres son obligatorios.'
    if (!form.organizacionId) next.organizacionId = 'Seleccione una organización.'
    if (!form.fechaInicio) next.fechaInicio = 'La fecha de inicio es obligatoria.'
    if (form.cuil && digits(form.cuil).length !== 11) next.cuil = 'El CUIL debe tener 11 dígitos.'
    if (Object.keys(next).length) { setFieldErrors(next); return }
    setSaving(true); onError('')
    try {
      const payload = { ...form, dni: digits(form.dni), cuil: form.cuil ? digits(form.cuil) : undefined, organizacionId: Number(form.organizacionId), sectorId: form.sectorId ? Number(form.sectorId) : undefined, antiguedadAnios: form.antiguedadAnios ? Number(form.antiguedadAnios) : undefined }
      onSaved(await request<ImportRow | ImportDetail>(token, `/api/v1/personal/importaciones/${importId}/filas/${row.id}`, { method: 'PUT', body: JSON.stringify(payload) }))
    } catch (error) { onError(errorText(error)) } finally { setSaving(false) }
  }
  const input = (key: keyof typeof form, label: string, type = 'text') => <label>{label}<input type={type} value={String(form[key])} onChange={event => set(key, event.target.value)} />{fieldErrors[key] && <small className="field-error">{fieldErrors[key]}</small>}</label>
  return <div className="modal-backdrop"><form className="modal personal-editor" onSubmit={submit}><div className="card-heading"><div><h2>Revisar fila {row.filaOrigen}</h2><p>Los cambios se aplican solo a esta fila.</p></div><button type="button" className="close" onClick={onClose}>×</button></div><fieldset><legend>Datos personales</legend><div className="form-grid">{input('dni', 'DNI')}{input('cuil', 'CUIL')}{input('apellido', 'Apellido')}{input('nombres', 'Nombres')}{input('sexo', 'Sexo')}{input('fechaNacimiento', 'Fecha de nacimiento', 'date')}</div></fieldset><fieldset><legend>Ubicación laboral</legend><div className="form-grid"><label>Organización<select value={form.organizacionId} onChange={event => set('organizacionId', event.target.value)}><option value="">Seleccionar</option>{organizations.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>{fieldErrors.organizacionId && <small className="field-error">{fieldErrors.organizacionId}</small>}</label>{input('dependencia', 'Dependencia')}{input('sectorNombre', 'Sector') }</div></fieldset><fieldset><legend>Designación</legend><div className="form-grid">{input('escalafon', 'Escalafón')}{input('categoria', 'Categoría')}{input('situacionRevista', 'Situación de revista')}{input('agrupamiento', 'Agrupamiento')}{input('funcion', 'Función')}{input('tipoAfectacion', 'Tipo de afectación')}{input('titulo', 'Título')}{input('fechaInicio', 'Fecha de inicio', 'date')}{input('antiguedadAnios', 'Antigüedad', 'number')}<label>Afectado<select value={String(form.afectado)} onChange={event => set('afectado', event.target.value === 'true')}><option value="false">No</option><option value="true">Sí</option></select></label></div></fieldset><fieldset><legend>Adicionales</legend><div className="form-grid">{input('adicionalMH', 'Adicional M/H')}{input('adicionalJefatura', 'Adicional por jefatura')}</div></fieldset><button className="primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar revisión'}</button></form></div>
}
