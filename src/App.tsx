import { FormEvent, useEffect, useState } from 'react'
import './App.css'

type Page<T> = { content: T[]; totalElements: number; totalPages: number; number: number }
type ImportRow = {
  id: number; filaOrigen: number; reemplazante: string; cuil: string; categoriaReemplazante: string
  instrumentoLegal: string; periodoDesde: string; periodoHasta: string; aPagar: number; aDeuda: number
  titular: string; categoriaTitular: string; licenciaDesde: string; licenciaHasta: string; cantidadDias: number
  tipoLicenciaExcel: string; agrupamiento: string; funcionTitular: string; tipoLicencia: string
  observaciones: string; lugarTrabajo: string; errores: string
}
type ImportDetail = {
  id: number; organizacionId: number; archivoOrigen: string; estado: string; cantidadFilas: number
  cantidadFilasValidas: number; cantidadFilasConError: number; fechaCreacion: string; registros: ImportRow[]
}
type ImportSummary = {
  id: number; organizacionId: number; organizacionNombre: string; archivoOrigen: string; estado: string
  creadoPorEmail: string; fechaCreacion: string; cantidadFilas: number; cantidadFilasConError: number
}
type Replacement = {
  id: number; organizacionId: number; importacionId: number; reemplazante: string; cuil: string
  titular: string; instrumentoLegal: string; periodoDesde: string; periodoHasta: string; lugarTrabajo: string
  fechaCierre: string
}

type View = 'upload' | 'imports' | 'history'

const apiUrl = import.meta.env.VITE_API_URL ?? ''

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('sisge-token') ?? '')
  const [view, setView] = useState<View>('upload')
  const [error, setError] = useState('')

  function signOut() {
    localStorage.removeItem('sisge-token')
    setToken('')
  }

  if (!token) {
    return <Login onAuthenticated={setToken} />
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">S</span><div><strong>SISGE</strong><small>Gestión de reemplazantes</small></div></div>
        <nav>
          <NavButton active={view === 'upload'} onClick={() => setView('upload')}>Cargar Excel</NavButton>
          <NavButton active={view === 'imports'} onClick={() => setView('imports')}>Importaciones</NavButton>
          <NavButton active={view === 'history'} onClick={() => setView('history')}>Histórico</NavButton>
        </nav>
        <button className="sign-out" onClick={signOut}>Cerrar sesión</button>
      </aside>
      <section className="content">
        <header><div><p className="eyebrow">REEMPLAZANTES</p><h1>{view === 'upload' ? 'Nueva importación' : view === 'imports' ? 'Importaciones' : 'Histórico consolidado'}</h1></div></header>
        {error && <div className="alert error"><span>{error}</span><button onClick={() => setError('')}>×</button></div>}
        {view === 'upload' && <Upload token={token} onComplete={() => setView('imports')} onError={setError} />}
        {view === 'imports' && <Imports token={token} onError={setError} />}
        {view === 'history' && <History token={token} onError={setError} />}
      </section>
    </main>
  )
}

function Login({ onAuthenticated }: { onAuthenticated: (token: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true); setError('')
    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message ?? 'No fue posible iniciar sesión')
      localStorage.setItem('sisge-token', data.accessToken)
      onAuthenticated(data.accessToken)
    } catch (exception) {
      setError(message(exception))
    } finally { setLoading(false) }
  }

  return <main className="login-page"><form className="login-card" onSubmit={submit}>
    <div className="brand login-brand"><span className="brand-mark">S</span><div><strong>SISGE</strong><small>Gestión de reemplazantes</small></div></div>
    <h1>Bienvenido</h1><p>Ingrese sus credenciales para continuar.</p>
    {error && <div className="alert error">{error}</div>}
    <label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
    <label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label>
    <button className="primary" disabled={loading}>{loading ? 'Ingresando…' : 'Ingresar'}</button>
  </form></main>
}

function Upload({ token, onComplete, onError }: { token: string; onComplete: () => void; onError: (error: string) => void }) {
  const [organizationId, setOrganizationId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportDetail | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!file) return onError('Seleccione un archivo .xlsx.')
    setLoading(true); onError('')
    try {
      const form = new FormData(); form.append('file', file)
      const detail = await api<ImportDetail>(token, `/api/v1/organizaciones/${organizationId}/importaciones/upload`, { method: 'POST', body: form })
      setResult(detail)
    } catch (exception) { onError(message(exception)) } finally { setLoading(false) }
  }

  return <div className="stack">
    <section className="card"><div className="card-heading"><div><h2>Cargar archivo de reemplazantes</h2><p>El archivo debe ser Excel (.xlsx) y respetar las columnas requeridas.</p></div></div>
      <form className="upload-form" onSubmit={submit}>
        <label>Organización / Hospital<input type="number" min="1" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} placeholder="ID de organización" required /></label>
        <label className="file-input">Archivo Excel<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /><span>{file ? file.name : 'Seleccionar archivo .xlsx'}</span></label>
        <button className="primary" disabled={loading}>{loading ? 'Procesando…' : 'Cargar y validar'}</button>
      </form>
    </section>
    {result && <section className="card result"><div><p className="eyebrow">IMPORTACIÓN #{result.id}</p><h2>{result.archivoOrigen}</h2><p>La carga quedó en <Status value={result.estado} />.</p></div><div className="stat-grid"><Stat label="Filas" value={result.cantidadFilas} /><Stat label="Válidas" value={result.cantidadFilasValidas} /><Stat label="Con errores" value={result.cantidadFilasConError} /></div><button className="secondary" onClick={onComplete}>Ver importaciones</button></section>}
  </div>
}

function Imports({ token, onError }: { token: string; onError: (error: string) => void }) {
  const [organizationId, setOrganizationId] = useState('')
  const [imports, setImports] = useState<Page<ImportSummary> | null>(null)
  const [detail, setDetail] = useState<ImportDetail | null>(null)
  const [loading, setLoading] = useState(false)

  async function load(event?: FormEvent) {
    event?.preventDefault(); setLoading(true); onError('')
    try {
      const query = organizationId ? `?organizacionId=${organizationId}&size=50` : '?size=50'
      setImports(await api<Page<ImportSummary>>(token, `/api/v1/importaciones${query}`))
    } catch (exception) { onError(message(exception)) } finally { setLoading(false) }
  }
  async function open(id: number) {
    try { setDetail(await api<ImportDetail>(token, `/api/v1/importaciones/${id}`)) } catch (exception) { onError(message(exception)) }
  }
  async function submit(id: number) {
    try { setDetail(await api<ImportDetail>(token, `/api/v1/importaciones/${id}/enviar-revision`, { method: 'POST' })); await load() } catch (exception) { onError(message(exception)) }
  }

  return <div className="stack"><section className="card filter-card"><form onSubmit={load}><label>Organización <input type="number" min="1" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} placeholder="ID para usuarios no globales" /></label><button className="primary" disabled={loading}>{loading ? 'Buscando…' : 'Buscar'}</button></form></section>
    {imports && <section className="card table-card"><h2>Importaciones</h2><table><thead><tr><th>ID</th><th>Archivo</th><th>Organización</th><th>Estado</th><th>Filas</th><th>Errores</th><th /></tr></thead><tbody>{imports.content.map((item) => <tr key={item.id}><td>#{item.id}</td><td>{item.archivoOrigen}</td><td>{item.organizacionNombre ?? item.organizacionId}</td><td><Status value={item.estado} /></td><td>{item.cantidadFilas}</td><td>{item.cantidadFilasConError}</td><td><button className="link-button" onClick={() => open(item.id)}>Ver detalle</button></td></tr>)}</tbody></table>{imports.content.length === 0 && <Empty text="No hay importaciones para los filtros seleccionados." />}</section>}
    {detail && <ImportDetailPanel detail={detail} token={token} onRefresh={open} onSubmit={submit} onError={onError} />}
  </div>
}

function ImportDetailPanel({ detail, token, onRefresh, onSubmit, onError }: { detail: ImportDetail; token: string; onRefresh: (id: number) => Promise<void>; onSubmit: (id: number) => Promise<void>; onError: (error: string) => void }) {
  const [editing, setEditing] = useState<ImportRow | null>(null)
  return <section className="card table-card"><div className="card-heading"><div><p className="eyebrow">IMPORTACIÓN #{detail.id}</p><h2>{detail.archivoOrigen} <Status value={detail.estado} /></h2><p>{detail.cantidadFilasValidas} filas válidas · {detail.cantidadFilasConError} con errores</p></div>{(detail.estado === 'EN_PROCESO' || detail.estado === 'OBSERVADA') && <button className="primary" onClick={() => onSubmit(detail.id)}>Enviar a revisión</button>}</div>
    <div className="scroll-table"><table><thead><tr><th>Fila</th><th>Reemplazante</th><th>CUIL</th><th>Período</th><th>Titular</th><th>Errores</th><th /></tr></thead><tbody>{detail.registros.map((row) => <tr key={row.id}><td>{row.filaOrigen}</td><td>{row.reemplazante}</td><td>{row.cuil}</td><td>{row.periodoDesde} — {row.periodoHasta}</td><td>{row.titular}</td><td className={row.errores ? 'cell-error' : ''}>{row.errores || '—'}</td><td><button className="link-button" onClick={() => setEditing(row)}>Editar</button></td></tr>)}</tbody></table></div>
    {editing && <RowEditor row={editing} token={token} importId={detail.id} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await onRefresh(detail.id) }} onError={onError} />}
  </section>
}

function RowEditor({ row, token, importId, onClose, onSaved, onError }: { row: ImportRow; token: string; importId: number; onClose: () => void; onSaved: () => Promise<void>; onError: (error: string) => void }) {
  const [form, setForm] = useState({ agrupamiento: row.agrupamiento ?? '', funcionTitular: row.funcionTitular ?? '', tipoLicencia: row.tipoLicencia ?? '', observaciones: row.observaciones ?? '', lugarTrabajo: row.lugarTrabajo ?? '' })
  async function save(event: FormEvent) {
    event.preventDefault()
    try { await api(token, `/api/v1/importaciones/${importId}/reemplazantes/${row.id}`, { method: 'PUT', body: JSON.stringify(form) }); await onSaved() } catch (exception) { onError(message(exception)) }
  }
  return <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="card-heading"><h2>Editar fila {row.filaOrigen}</h2><button className="close" type="button" onClick={onClose}>×</button></div><div className="form-grid">{Object.entries(form).map(([key, value]) => <label key={key}>{label(key)}{key === 'observaciones' ? <textarea value={value} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /> : <input value={value} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}</label>)}</div><button className="primary">Guardar cambios</button></form></div>
}

function History({ token, onError }: { token: string; onError: (error: string) => void }) {
  const [filters, setFilters] = useState({ organizacionId: '', cuil: '', reemplazante: '', titular: '' })
  const [rows, setRows] = useState<Page<Replacement> | null>(null)
  const [loading, setLoading] = useState(false)
  async function search(event: FormEvent) {
    event.preventDefault(); setLoading(true); onError('')
    const params = new URLSearchParams({ size: '50' })
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value) })
    try { setRows(await api<Page<Replacement>>(token, `/api/v1/reemplazantes?${params}`)) } catch (exception) { onError(message(exception)) } finally { setLoading(false) }
  }
  return <div className="stack"><section className="card filter-card"><form className="history-filters" onSubmit={search}>{Object.entries(filters).map(([key, value]) => <label key={key}>{label(key)}<input type={key === 'organizacionId' ? 'number' : 'text'} min="1" value={value} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })} /></label>)}<button className="primary" disabled={loading}>{loading ? 'Buscando…' : 'Buscar'}</button></form></section>
    {rows && <section className="card table-card"><h2>Registros consolidados <span className="muted">({rows.totalElements})</span></h2><div className="scroll-table"><table><thead><tr><th>Reemplazante</th><th>CUIL</th><th>Titular</th><th>Instrumento</th><th>Período</th><th>Cierre</th></tr></thead><tbody>{rows.content.map((row) => <tr key={row.id}><td>{row.reemplazante}</td><td>{row.cuil}</td><td>{row.titular}</td><td>{row.instrumentoLegal}</td><td>{row.periodoDesde} — {row.periodoHasta}</td><td>{formatDate(row.fechaCierre)}</td></tr>)}</tbody></table></div>{rows.content.length === 0 && <Empty text="No hay registros históricos para los filtros seleccionados." />}</section>}
  </div>
}

async function api<T = unknown>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init.headers } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message ?? 'La solicitud no pudo completarse')
  return data as T
}
function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) { return <button className={active ? 'nav-button active' : 'nav-button'} onClick={onClick}>{children}</button> }
function Status({ value }: { value: string }) { return <span className={`status status-${value.toLowerCase()}`}>{value.replaceAll('_', ' ')}</span> }
function Stat({ label: statLabel, value }: { label: string; value: number }) { return <div className="stat"><strong>{value}</strong><span>{statLabel}</span></div> }
function Empty({ text }: { text: string }) { return <p className="empty">{text}</p> }
function label(value: string) { return ({ organizacionId: 'Organización', cuil: 'CUIL', reemplazante: 'Reemplazante', titular: 'Titular', agrupamiento: 'Agrupamiento', funcionTitular: 'Función titular', tipoLicencia: 'Tipo de licencia', observaciones: 'Observaciones', lugarTrabajo: 'Lugar de trabajo' } as Record<string, string>)[value] ?? value }
function formatDate(value?: string) { return value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(value)) : '—' }
function message(exception: unknown) { return exception instanceof Error ? exception.message : 'Ocurrió un error inesperado' }

export default App
