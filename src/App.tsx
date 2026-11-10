import { FormEvent, useCallback, useEffect, useState } from 'react'
import PersonalSurvey from './PersonalSurvey'
import { login } from './services/authService'
import { api, message } from './services/http'
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
type Organization = { id: number; nombre: string; udeo?: string }

type Person = {
  id: number; dni: string; cuil: string | null; nombres: string; apellido: string; sexo: string | null
  fechaNacimiento: string | null; organizacionId: number; organizacion: string; sectorId: number | null
  sector: string | null; escalafon: string | null; categoria: string | null; situacionRevista: string | null
  agrupamiento: string | null; funcion: string | null; fechaInicio: string; antiguedadAnios: number | null; afectado: boolean
}
type PersonalImportRow = {
  id: number; filaOrigen: number; valoresCrudos: string; dni: string | null; cuil: string | null
  nombres: string | null; apellido: string | null; sexo: string | null; fechaNacimiento: string | null
  organizacionId: number | null; sectorId: number | null; escalafon: string | null; categoria: string | null
  situacionRevista: string | null; agrupamiento: string | null; funcion: string | null; fechaInicio: string | null
  antiguedadAnios: number | null; afectado: boolean | null; revisada: boolean; errores: string
}
type PersonalImportDetail = {
  id: number; organizacionId: number; archivoOrigen: string; estado: 'EN_REVISION' | 'APROBADA'; filas: PersonalImportRow[]
}
type RowReviewForm = {
  dni: string; cuil: string; nombres: string; apellido: string; sexo: string; fechaNacimiento: string
  organizacionId: string; sectorId: string; escalafon: string; categoria: string; situacionRevista: string
  agrupamiento: string; funcion: string; fechaInicio: string; antiguedadAnios: string; afectado: boolean
}
type RowReviewPayload = {
  dni: string; cuil?: string; nombres: string; apellido: string; sexo?: string; fechaNacimiento?: string
  organizacionId: number; sectorId?: number; escalafon?: string; categoria?: string; situacionRevista?: string
  agrupamiento?: string; funcion?: string; fechaInicio: string; antiguedadAnios?: number; afectado: boolean
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('sisge-token') ?? '')
  const [error, setError] = useState('')
  const permissions = permissionsFromToken(token)
  const can = (permission: string) => {
    const required = permission.toUpperCase()
    return permissions.some((value) => ['*', required, `ROLE_${required}`, `SCOPE_${required}`].includes(value.toUpperCase()))
  }

  function signOut() {
    localStorage.removeItem('sisge-token')
    setToken('')
  }

  if (!token) {
    return <Login onAuthenticated={setToken} />
  }

  return <Application token={token} can={can} onSignOut={signOut} error={error} onError={setError} />
}

function Application({ token, can, onSignOut, error, onError }: { token: string; can: (permission: string) => boolean; onSignOut: () => void; error: string; onError: (message: string) => void }) {
  const [path, setPath] = useState(() => window.location.pathname === '/' ? '/dashboard' : window.location.pathname)
  const [collapsed, setCollapsed] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [organizationId, setOrganizationId] = useState('')
  const user = tokenUser(token)
  function navigate(next: string) {
    if (next === path) return
    window.history.pushState({}, '', next); setPath(next)
  }
  useEffect(() => {
    if (window.location.pathname === '/') window.history.replaceState({}, '', '/dashboard')
    const handlePopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])
  useEffect(() => {
    let active = true
    api<Organization[]>(token, '/api/v1/organizaciones').then(items => {
      if (!active) return
      setOrganizations(items)
      if (items.length === 1) setOrganizationId(String(items[0].id))
    }).catch(() => undefined)
    return () => { active = false }
  }, [token])
  useEffect(() => {
    window.addEventListener('sisge-session-invalid', onSignOut)
    return () => window.removeEventListener('sisge-session-invalid', onSignOut)
  }, [onSignOut])

  const currentOrganization = organizations.find(item => String(item.id) === organizationId)
  const content = routeContent(path, { token, can, onError, navigate })
  return <main className={collapsed ? 'app-layout sidebar-collapsed' : 'app-layout'}>
    <Sidebar path={path} collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} onNavigate={navigate} onSignOut={onSignOut} />
    <section className="app-main">
      <header className="top-header"><button className="menu-toggle" onClick={() => setCollapsed(value => !value)} aria-label="Contraer navegación">☰</button><div className="header-spacer" /><label className="organization-switcher">Organización<select value={organizationId} onChange={event => setOrganizationId(event.target.value)} disabled={organizations.length < 2}><option value="">{currentOrganization ? currentOrganization.nombre : organizations.length ? 'Seleccionar organización' : 'Sin organización seleccionada'}</option>{organizations.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><span className="notification-bell" aria-label="Sin notificaciones nuevas">♢</span><div className="user-menu"><span className="user-avatar">{user.slice(0, 1).toUpperCase()}</span><div><strong>{user}</strong><small>Usuario autenticado</small></div><button className="link-button" onClick={onSignOut}>Salir</button></div></header>
      <div className="page-content"><Breadcrumb path={path} /><PageHeader path={path} />{error && <div className="alert error"><span>{error}</span><button onClick={() => onError('')}>×</button></div>}{content}</div>
    </section>
  </main>
}

function Sidebar({ path, collapsed, onToggle, onNavigate, onSignOut }: { path: string; collapsed: boolean; onToggle: () => void; onNavigate: (path: string) => void; onSignOut: () => void }) {
  const groups = [
    { label: 'Dashboard', icon: '▦', path: '/dashboard', children: [] },
    { label: 'Personal', icon: '♟', path: '/personal/legajos', children: [{ label: 'Legajos', path: '/personal/legajos' }] },
    { label: 'Reemplazos', icon: '↻', path: '/reemplazos', children: [{ label: 'Nueva carga', path: '/reemplazos/nueva-carga' }, { label: 'Importaciones', path: '/reemplazos/importaciones' }, { label: 'Pendientes de revisión', path: '/reemplazos/pendientes' }, { label: 'Histórico', path: '/reemplazos/historico' }] },
    { label: 'Administración', icon: '⚙', path: '/administracion', children: ['Usuarios', 'Roles y permisos', 'Organizaciones', 'Dependencias', 'Sectores', 'Categorías', 'Agrupamientos', 'Tipos de licencia'].map(label => ({ label, path: `/administracion/${slug(label)}` })) },
    { label: 'Auditoría', icon: '⌕', path: '/auditoria/relevamiento', children: [{ label: 'Relevamiento de personal', path: '/auditoria/relevamiento' }, { label: 'Importaciones', path: '/auditoria/importaciones' }, { label: 'Validación de datos', path: '/auditoria/validacion' }, { label: 'Diferencias', path: '/auditoria/diferencias' }, { label: 'Historial', path: '/auditoria/historial' }] },
    { label: 'Configuración', icon: '⚙', path: '/configuracion/perfil', children: [{ label: 'Perfil', path: '/configuracion/perfil' }, { label: 'Preferencias', path: '/configuracion/preferencias' }] },
  ]
  return <aside className="main-sidebar"><div className="brand"><span className="brand-mark">S</span>{!collapsed && <div><strong>SISGE</strong><small>Gestión de Recursos Humanos</small></div>}<button className="collapse-button" onClick={onToggle} aria-label="Contraer menú">{collapsed ? '›' : '‹'}</button></div><nav>{groups.map(group => <div className="nav-group" key={group.label}><button className={path === group.path || path.startsWith(`${group.path}/`) || group.children.some(item => path === item.path) ? 'nav-button active' : 'nav-button'} onClick={() => onNavigate(group.children[0]?.path ?? group.path)}><span className="nav-icon">{group.icon}</span>{!collapsed && group.label}</button>{!collapsed && group.children.map(item => <button key={item.path} className={path === item.path || (item.path === '/personal/legajos' && path.startsWith('/personal/legajos/')) ? 'nav-child active' : 'nav-child'} onClick={() => onNavigate(item.path)}>{item.label}</button>)}</div>)}</nav><button className="sign-out" onClick={onSignOut}><span>↪</span>{!collapsed && 'Cerrar sesión'}</button></aside>
}

type RouteContext = { token: string; can: (permission: string) => boolean; onError: (message: string) => void; navigate: (path: string) => void }
function routeContent(path: string, context: RouteContext) {
  if (path === '/dashboard') return <Dashboard onNavigate={context.navigate} />
  if (path === '/personal' || path === '/personal/legajos') return <Personal token={context.token} can={context.can} onError={context.onError} allowImport={false} onOpenLegajo={id => context.navigate(`/personal/legajos/${id}`)} />
  if (path.startsWith('/personal/legajos/')) return <LegajoDetail />
  if (path === '/reemplazos') return <ReplacementsHome onNavigate={context.navigate} />
  if (path === '/reemplazos/nueva-carga') return <Upload token={context.token} onComplete={() => context.navigate('/reemplazos/importaciones')} onError={context.onError} />
  if (path === '/reemplazos/importaciones') return <Imports token={context.token} onError={context.onError} />
  if (path.startsWith('/reemplazos/importaciones/')) return <ReplacementDetail token={context.token} importId={path.split('/').pop() ?? ''} onError={context.onError} />
  if (path === '/reemplazos/pendientes') return <AdminImports token={context.token} can={context.can} onError={context.onError} />
  if (path === '/reemplazos/historico') return <History token={context.token} onError={context.onError} />
  if (path === '/auditoria/relevamiento') return <AuditOverview />
  if (path === '/auditoria/importaciones') return <PersonalSurvey token={context.token} can={context.can} request={api} onError={context.onError} />
  if (path.startsWith('/auditoria/importaciones/')) return <PersonalSurvey token={context.token} can={context.can} request={api} importId={path.split('/').pop()} onError={context.onError} />
  if (path === '/auditoria/validacion') return <PendingFeature title="Validación de datos" text="Los controles de validación estarán disponibles cuando el servicio de auditoría esté implementado." />
  if (path === '/auditoria/diferencias') return <PendingFeature title="Diferencias entre relevamientos" text="La comparación de relevamientos estará disponible cuando se implemente el servicio correspondiente." />
  if (path === '/auditoria/historial') return <PendingFeature title="Historial de auditoría" text="El historial de auditoría estará disponible cuando se implemente el servicio correspondiente." />
  if (path.startsWith('/administracion')) return <PendingFeature title="Administración" text="Funcionalidad pendiente de backend." />
  if (path.startsWith('/configuracion')) return <Settings path={path} />
  return <PendingFeature title="Página no encontrada" text="La ruta solicitada no existe." />
}

function PageHeader({ path }: { path: string }) {
  const pages: Record<string, [string, string]> = { '/dashboard': ['Dashboard', 'Resumen de la gestión de Recursos Humanos'], '/personal/legajos': ['Legajos', 'Consulta y gestión de la información del personal.'], '/reemplazos': ['Reemplazos', 'Gestión y seguimiento de reemplazantes.'], '/reemplazos/nueva-carga': ['Nueva carga de reemplazos', 'Importe el archivo Excel con la información de reemplazantes.'], '/reemplazos/importaciones': ['Importaciones de reemplazos', 'Consulte el estado y detalle de cada carga.'], '/reemplazos/pendientes': ['Pendientes de revisión', 'Gestione las importaciones pendientes de control.'], '/reemplazos/historico': ['Histórico de reemplazos', 'Consulta de registros consolidados.'], '/auditoria/relevamiento': ['Relevamiento de personal', 'Controlá que la información del personal se encuentre completa y actualizada.'], '/auditoria/importaciones': ['Importar personal', 'Importá información del personal para iniciar un nuevo relevamiento.'] }
  const current = pages[path] ?? (path.startsWith('/personal/legajos/') ? ['Legajo', 'Información consolidada del personal.'] : undefined)
  return current ? <div className="page-header"><div><p className="eyebrow">{path.startsWith('/auditoria') ? 'AUDITORÍA' : path.startsWith('/reemplazos') ? 'REEMPLAZOS' : path.startsWith('/personal') ? 'PERSONAL' : 'SISGE'}</p><h1>{current[0]}</h1><p>{current[1]}</p></div></div> : null
}
function Breadcrumb({ path }: { path: string }) { const labels = path.split('/').filter(Boolean).map(part => ({ dashboard: 'Dashboard', personal: 'Personal', legajos: 'Legajos', reemplazos: 'Reemplazos', auditoria: 'Auditoría', administracion: 'Administración', configuracion: 'Configuración', 'nueva-carga': 'Nueva carga', importaciones: 'Importaciones', pendientes: 'Pendientes', historico: 'Histórico', relevamiento: 'Relevamiento', validacion: 'Validación', diferencias: 'Diferencias', historial: 'Historial', perfil: 'Perfil', preferencias: 'Preferencias' }[part] ?? part)); return <div className="breadcrumbs">{labels.join(' › ')}</div> }
function Dashboard({ onNavigate }: { onNavigate: (path: string) => void }) { return <div className="stack"><section className="dashboard-stats">{[['Personal', 'Sin información disponible', '/personal/legajos'], ['Reemplazos', 'Sin información disponible', '/reemplazos'], ['Importaciones pendientes', 'Sin información disponible', '/reemplazos/pendientes'], ['Relevamientos', 'Sin información disponible', '/auditoria/relevamiento']].map(([label, value, path]) => <button className="stat-card" key={label} onClick={() => onNavigate(path)}><span>{label}</span><strong>{value}</strong></button>)}</section><section className="dashboard-grid"><PendingFeature title="Personal por organización" text="Sin información disponible." /><PendingFeature title="Personal por categoría" text="Sin información disponible." /><PendingFeature title="Personal por sector" text="Sin información disponible." /><PendingFeature title="Actividad reciente" text="Sin información disponible." /></section></div> }
function ReplacementsHome({ onNavigate }: { onNavigate: (path: string) => void }) { return <section className="quick-actions">{[['Nueva carga', 'Importe y valide un archivo Excel.', '/reemplazos/nueva-carga'], ['Importaciones', 'Consulte las cargas realizadas.', '/reemplazos/importaciones'], ['Pendientes de revisión', 'Revise importaciones pendientes.', '/reemplazos/pendientes'], ['Histórico', 'Consulte reemplazos consolidados.', '/reemplazos/historico']].map(([title, description, path]) => <button className="card quick-action" key={title} onClick={() => onNavigate(path)}><h2>{title}</h2><p>{description}</p><span>Ver sección →</span></button>)}</section> }
function AuditOverview() { return <section className="dashboard-stats">{['Personal relevado', 'Información completa', 'Información incompleta', 'Con inconsistencias', 'Pendientes de revisión'].map(label => <div className="stat-card" key={label}><span>{label}</span><strong>Sin información disponible</strong></div>)}</section> }
function PendingFeature({ title, text }: { title: string; text: string }) { return <section className="card pending-feature"><h2>{title}</h2><p>{text}</p></section> }
function Settings({ path }: { path: string }) { return <section className="card pending-feature"><h2>{path.endsWith('perfil') ? 'Perfil' : 'Preferencias'}</h2><p>La configuración de cuenta estará disponible próximamente.</p></section> }
function LegajoDetail() { return <section className="card pending-feature"><h2>Detalle del legajo</h2><p>El detalle estará disponible cuando el backend exponga la consulta individual de personas.</p><div className="tabs"><button className="active">Datos personales</button>{['Datos laborales', 'Destino', 'Situación', 'Licencias', 'Novedades', 'Documentación', 'Historial'].map(item => <button key={item} disabled>{item} · Próximamente</button>)}</div></section> }
function slug(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-') }
function tokenUser(token: string) { try { const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>; return String(payload.name ?? payload.nombre ?? payload.email ?? payload.sub ?? 'Usuario') } catch { return 'Usuario' } }
function ReplacementDetail({ token, importId, onError }: { token: string; importId: string; onError: (message: string) => void }) {
  const [detail, setDetail] = useState<ImportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try { setDetail(await api<ImportDetail>(token, `/api/v1/importaciones/${importId}`)) } catch (exception) { onError(message(exception)) } finally { setLoading(false) }
  }, [importId, onError, token])
  useEffect(() => { void load() }, [load])
  async function sendReview(id: number) {
    try { setDetail(await api<ImportDetail>(token, `/api/v1/importaciones/${id}/enviar-revision`, { method: 'POST' })) } catch (exception) { onError(message(exception)) }
  }
  return loading ? <p className="empty">Cargando importación…</p> : detail ? <ImportDetailPanel detail={detail} token={token} onRefresh={async () => { await load() }} onSubmit={sendReview} onError={onError} /> : <PendingFeature title="Importación no disponible" text="No fue posible obtener el detalle solicitado." />
}
function AdminImports({ token, can, onError }: { token: string; can: (permission: string) => boolean; onError: (message: string) => void }) {
  const [imports, setImports] = useState<Page<ImportSummary> | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState<{ id: number; action: 'observar' | 'rechazar' | 'aprobar' | 'cerrar' } | null>(null)
  async function load() {
    setLoading(true); onError('')
    try { setImports(await api<Page<ImportSummary>>(token, '/api/v1/admin/importaciones?size=50')) } catch (exception) { onError(message(exception)) } finally { setLoading(false) }
  }
  async function execute() {
    if (!confirm) return
    try { await api(token, `/api/v1/admin/importaciones/${confirm.id}/${confirm.action}`, { method: 'POST' }); setConfirm(null); await load() } catch (exception) { onError(message(exception)) }
  }
  const actionLabel = confirm ? ({ observar: 'Observar', rechazar: 'Rechazar', aprobar: 'Aprobar', cerrar: 'Cerrar' }[confirm.action]) : ''
  return <section className="card table-card"><div className="card-heading"><div><h2>Importaciones pendientes</h2><p>Consulte y resuelva las importaciones de reemplazos pendientes de revisión.</p></div><button className="primary" disabled={loading} onClick={() => void load()}>{loading ? 'Cargando…' : 'Cargar pendientes'}</button></div>{imports && (imports.content.length ? <div className="scroll-table"><table><thead><tr><th>Archivo</th><th>Organización</th><th>Fecha</th><th>Estado</th><th>Usuario</th><th>Acciones</th></tr></thead><tbody>{imports.content.map(item => <tr key={item.id}><td>{item.archivoOrigen}</td><td>{item.organizacionNombre ?? 'Organización no informada'}</td><td>{formatDate(item.fechaCreacion)}</td><td><Status value={item.estado} /></td><td>{item.creadoPorEmail ?? '—'}</td><td className="row-actions">{(['observar', 'rechazar', 'aprobar', 'cerrar'] as const).map(action => <button key={action} className="link-button" disabled={!can(`REEMPLAZOS_${action.toUpperCase()}`)} onClick={() => setConfirm({ id: item.id, action })}>{action}</button>)}</td></tr>)}</tbody></table></div> : <Empty text="No hay importaciones pendientes para los filtros seleccionados." />)}{confirm && <div className="modal-backdrop"><section className="modal confirm-dialog"><h2>{actionLabel} importación</h2><p>¿Confirma la acción seleccionada sobre esta importación?</p><div className="action-group"><button className="secondary" onClick={() => setConfirm(null)}>Cancelar</button><button className="primary" onClick={() => void execute()}>Confirmar</button></div></section></div>}</section>
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
      const data = await login(email, password)
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
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportDetail | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    api<Organization[]>(token, '/api/v1/organizaciones').then(items => {
      setOrganizations(items)
      if (items.length === 1) setOrganizationId(String(items[0].id))
    }).catch((exception: unknown) => onError(message(exception)))
  }, [token, onError])

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
        <label>Organización<select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} required><option value="">Seleccionar organización</option>{organizations.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
        <label className="file-input">Archivo Excel<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /><span>{file ? file.name : 'Seleccionar archivo .xlsx'}</span></label>
        <button className="primary" disabled={loading}>{loading ? 'Procesando…' : 'Cargar y validar'}</button>
      </form>
    </section>
    {result && <section className="card result"><div><p className="eyebrow">IMPORTACIÓN #{result.id}</p><h2>{result.archivoOrigen}</h2><p>La carga quedó en <Status value={result.estado} />.</p></div><div className="stat-grid"><Stat label="Filas" value={result.cantidadFilas} /><Stat label="Válidas" value={result.cantidadFilasValidas} /><Stat label="Con errores" value={result.cantidadFilasConError} /></div><button className="secondary" onClick={onComplete}>Ver importaciones</button></section>}
  </div>
}

function Imports({ token, onError }: { token: string; onError: (error: string) => void }) {
  const [organizationId, setOrganizationId] = useState('')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [imports, setImports] = useState<Page<ImportSummary> | null>(null)
  const [detail, setDetail] = useState<ImportDetail | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    api<Organization[]>(token, '/api/v1/organizaciones').then(items => {
      setOrganizations(items)
      if (items.length === 1) setOrganizationId(String(items[0].id))
    }).catch((exception: unknown) => onError(message(exception)))
  }, [token, onError])

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

  return <div className="stack"><section className="card filter-card"><form onSubmit={load}><label>Organización<select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">Todas las organizaciones</option>{organizations.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><button className="primary" disabled={loading}>{loading ? 'Buscando…' : 'Buscar'}</button></form></section>
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

export function Personal({ token, can, onError, allowImport = false, onOpenLegajo }: { token: string; can: (permission: string) => boolean; onError: (error: string) => void; allowImport?: boolean; onOpenLegajo?: (id: number) => void }) {
  const [filters, setFilters] = useState({ organizacionId: '', q: '' })
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [people, setPeople] = useState<Page<Person> | null>(null)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [detail, setDetail] = useState<PersonalImportDetail | null>(null)
  const [mode, setMode] = useState<'list' | 'import' | 'detail'>('list')
  useEffect(() => {
    api<Organization[]>(token, '/api/v1/organizaciones').then(items => {
      setOrganizations(items)
      if (items.length === 1) setFilters(current => ({ ...current, organizacionId: String(items[0].id) }))
    }).catch((exception: unknown) => onError(message(exception)))
  }, [token, onError])

  async function load(nextPage = page) {
    setLoading(true); onError('')
    const params = new URLSearchParams({ page: String(nextPage), size: '20' })
    if (filters.organizacionId) params.set('organizacionId', filters.organizacionId)
    if (filters.q) params.set('q', filters.q)
    try { setPeople(await api<Page<Person>>(token, `/api/v1/personas?${params}`)); setPage(nextPage) } catch (exception) { onError(message(exception)) } finally { setLoading(false) }
  }
  async function importFile(event: FormEvent) {
    event.preventDefault()
    if (!filters.organizacionId) return onError('Indique la organización antes de importar el personal.')
    if (!file || !file.name.toLowerCase().endsWith('.xlsx')) return onError('Seleccione exclusivamente un archivo .xlsx.')
    setImporting(true); onError('')
    try {
      const form = new FormData(); form.append('file', file)
      setDetail(await api<PersonalImportDetail>(token, `/api/v1/organizaciones/${filters.organizacionId}/personal/importaciones`, { method: 'POST', body: form }))
      setMode('detail'); setFile(null)
    } catch (exception) { onError(message(exception)) } finally { setImporting(false) }
  }
  async function refreshImport(importId: number) {
    try { setDetail(await api<PersonalImportDetail>(token, `/api/v1/personal/importaciones/${importId}`)) } catch (exception) { onError(message(exception)) }
  }
  async function approve() {
    if (!detail) return
    try {
      setDetail(await api<PersonalImportDetail>(token, `/api/v1/personal/importaciones/${detail.id}/aprobar`, { method: 'POST' }))
      await load(0)
    } catch (exception) { onError(message(exception)) }
  }
  const canApprove = detail?.estado === 'EN_REVISION' && detail.filas.every((row) => row.revisada && !row.errores)

  return <div className="stack">
    {mode !== 'detail' && <section className="card filter-card"><form className="personal-filters" onSubmit={(event) => { event.preventDefault(); void load(0) }}>
      <label>Organización<select value={filters.organizacionId} onChange={(event) => setFilters({ ...filters, organizacionId: event.target.value })}><option value="">Todas las organizaciones</option>{organizations.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
      <label>Buscar<input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="DNI, apellido, nombre o número de legajo..." /></label>
      <button className="primary" disabled={loading}>{loading ? 'Buscando…' : 'Buscar'}</button>
      {allowImport && can('PERSONAL_IMPORTAR') && <button className="secondary" type="button" onClick={() => setMode(mode === 'import' ? 'list' : 'import')}>Importar personal</button>}
    </form></section>}
    {mode === 'import' && <section className="card"><div className="card-heading"><div><h2>Importar personal</h2><p>Seleccione un Excel (.xlsx) con la primera hoja y cabeceras requeridas.</p></div></div>
      <form className="upload-form" onSubmit={importFile}><label className="file-input">Archivo Excel<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /><span>{file?.name ?? 'Seleccionar archivo .xlsx'}</span></label><button className="primary" disabled={importing}>{importing ? 'Importando…' : 'Importar y revisar'}</button></form>
    </section>}
    {mode === 'list' && people && <section className="card table-card"><h2>Legajos <span className="muted">({people.totalElements})</span></h2><div className="scroll-table"><table><thead><tr><th>DNI</th><th>Apellido y nombre</th><th>Organización</th><th>Sector</th><th>Categoría</th><th>Situación</th><th>Acciones</th></tr></thead><tbody>{people.content.map((person) => <tr key={person.id}><td>{formatDni(person.dni)}</td><td>{person.apellido}, {person.nombres}</td><td>{person.organizacion}</td><td>{person.sector ?? '—'}</td><td>{person.categoria ?? '—'}</td><td>{person.situacionRevista ?? '—'}</td><td>{onOpenLegajo && <button className="link-button" onClick={() => onOpenLegajo(person.id)}>Ver legajo</button>}</td></tr>)}</tbody></table></div>{people.content.length === 0 && <Empty text="No hay personas para los filtros seleccionados." />}<Pagination page={page} totalPages={people.totalPages} onChange={load} /></section>}
    {mode === 'detail' && detail && <PersonalImportDetailPanel detail={detail} token={token} canReview={can('PERSONAL_REVISAR')} canApprove={can('PERSONAL_APROBAR')} eligibleToApprove={Boolean(canApprove)} onRefresh={refreshImport} onReplace={setDetail} onApprove={approve} onClose={() => { setDetail(null); setMode('list') }} onError={onError} />}
  </div>
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => Promise<void> }) {
  if (totalPages <= 1) return null
  return <div className="pagination"><button className="secondary" disabled={page === 0} onClick={() => void onChange(page - 1)}>Anterior</button><span>Página {page + 1} de {totalPages}</span><button className="secondary" disabled={page + 1 >= totalPages} onClick={() => void onChange(page + 1)}>Siguiente</button></div>
}

function PersonalImportDetailPanel({ detail, token, canReview, canApprove, eligibleToApprove, onRefresh, onReplace, onApprove, onClose, onError }: { detail: PersonalImportDetail; token: string; canReview: boolean; canApprove: boolean; eligibleToApprove: boolean; onRefresh: (id: number) => Promise<void>; onReplace: (detail: PersonalImportDetail) => void; onApprove: () => Promise<void>; onClose: () => void; onError: (error: string) => void }) {
  const [editing, setEditing] = useState<PersonalImportRow | null>(null)
  const locked = detail.estado === 'APROBADA'
  return <section className="card table-card"><div className="card-heading"><div><p className="eyebrow">IMPORTACIÓN DE PERSONAL #{detail.id}</p><h2>{detail.archivoOrigen} <Status value={detail.estado} /></h2><p>{detail.filas.length} filas importadas. Cada fila debe revisarse explícitamente.</p></div><div className="action-group"><button className="secondary" onClick={() => void onRefresh(detail.id)}>Recargar</button>{canApprove && <button className="primary" disabled={!eligibleToApprove || locked} onClick={() => void onApprove()}>Aprobar importación</button>}<button className="close" type="button" onClick={onClose}>×</button></div></div>
    <div className="scroll-table"><table><thead><tr><th>Fila</th><th>DNI</th><th>Persona</th><th>Organización</th><th>Revisión</th><th>Errores</th><th /></tr></thead><tbody>{detail.filas.map((row) => <tr key={row.id}><td>{row.filaOrigen}</td><td>{formatDni(row.dni ?? rawValue(row, ['DNI', 'dni']))}</td><td>{row.apellido ?? rawValue(row, ['Apellido', 'apellido'])}, {row.nombres ?? rawValue(row, ['Nombres', 'nombres'])}</td><td>{row.organizacionId ?? rawValue(row, ['Organizacion', 'Organización', 'organizacionId']) ?? '—'}</td><td>{row.revisada ? 'Revisada' : 'Pendiente'}</td><td className={row.errores ? 'cell-error' : ''}>{row.errores || '—'}</td><td>{canReview && !locked && <button className="link-button" onClick={() => setEditing(row)}>Revisar</button>}</td></tr>)}</tbody></table></div>
    {editing && <PersonalRowEditor row={editing} importId={detail.id} token={token} onClose={() => setEditing(null)} onSaved={(updated) => { setEditing(null); onReplace(updated) }} onError={onError} />}
  </section>
}

function PersonalRowEditor({ row, importId, token, onClose, onSaved, onError }: { row: PersonalImportRow; importId: number; token: string; onClose: () => void; onSaved: (detail: PersonalImportDetail) => void; onError: (error: string) => void }) {
  const [form, setForm] = useState<RowReviewForm>(() => rowForm(row))
  const [saving, setSaving] = useState(false)
  const [validationError, setValidationError] = useState('')
  function update<K extends keyof RowReviewForm>(key: K, value: RowReviewForm[K]) { setForm({ ...form, [key]: value }) }
  async function save(event: FormEvent) {
    event.preventDefault(); setValidationError('')
    const payload = reviewPayload(form)
    if (typeof payload === 'string') return setValidationError(payload)
    setSaving(true)
    try {
      const updated = await api<PersonalImportDetail>(token, `/api/v1/personal/importaciones/${importId}/filas/${row.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      onSaved(updated)
    } catch (exception) { onError(message(exception)) } finally { setSaving(false) }
  }
  return <div className="modal-backdrop"><form className="modal personal-editor" onSubmit={save}><div className="card-heading"><div><h2>Revisar fila {row.filaOrigen}</h2><p>Guardar marca la fila como revisada.</p></div><button className="close" type="button" onClick={onClose}>×</button></div>{validationError && <div className="alert error">{validationError}</div>}
    <div className="form-grid">{[
      ['dni', 'DNI', 'text'], ['cuil', 'CUIL', 'text'], ['nombres', 'Nombres', 'text'], ['apellido', 'Apellido', 'text'], ['sexo', 'Sexo', 'text'],
      ['fechaNacimiento', 'Fecha de nacimiento', 'date'], ['organizacionId', 'Organización', 'number'], ['sectorId', 'Sector', 'number'],
      ['escalafon', 'Escalafón', 'text'], ['categoria', 'Categoría', 'text'], ['situacionRevista', 'Situación de revista', 'text'],
      ['agrupamiento', 'Agrupamiento', 'text'], ['funcion', 'Función', 'text'], ['fechaInicio', 'Fecha de inicio', 'date'],
      ['antiguedadAnios', 'Antigüedad (años)', 'number'],
    ].map(([key, text, type]) => <label key={key}>{text}<input type={type} value={form[key as keyof RowReviewForm] as string} onChange={(event) => update(key as keyof RowReviewForm, event.target.value)} /></label>)}
      <label>Afectado<select value={String(form.afectado)} onChange={(event) => update('afectado', event.target.value === 'true')}><option value="false">No</option><option value="true">Sí</option></select></label>
    </div><button className="primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar revisión'}</button></form></div>
}

function rowForm(row: PersonalImportRow): RowReviewForm {
  const raw = rawValues(row)
  const value = (field: keyof PersonalImportRow, keys: string[]) => String(row[field] ?? rawValueFrom(raw, keys) ?? '')
  const rawAffected = row.afectado ?? rawValueFrom(raw, ['Afectado', 'afectado'])
  return {
    dni: value('dni', ['DNI', 'dni']), cuil: value('cuil', ['CUIL', 'cuil']), nombres: value('nombres', ['Nombres', 'nombres']),
    apellido: value('apellido', ['Apellido', 'apellido']), sexo: value('sexo', ['Sexo', 'sexo']),
    fechaNacimiento: dateInput(value('fechaNacimiento', ['Fecha Nacimiento', 'Fecha de nacimiento', 'fechaNacimiento'])),
    organizacionId: value('organizacionId', ['Organizacion', 'Organización', 'organizacionId']),
    sectorId: value('sectorId', ['Sector', 'sectorId']), escalafon: value('escalafon', ['Escalafon', 'Escalafón', 'escalafon']),
    categoria: value('categoria', ['Categoria', 'Categoría', 'categoria']),
    situacionRevista: value('situacionRevista', ['Situacion Revista', 'Situación Revista', 'situacionRevista']),
    agrupamiento: value('agrupamiento', ['Agrupamiento', 'agrupamiento']), funcion: value('funcion', ['Funcion', 'Función', 'funcion']),
    fechaInicio: dateInput(value('fechaInicio', ['Fecha Inicio', 'fechaInicio'])),
    antiguedadAnios: value('antiguedadAnios', ['Antiguedad', 'Antigüedad', 'antiguedadAnios']),
    afectado: rawAffected === true || String(rawAffected).toLowerCase() === 'true' || String(rawAffected).toLowerCase() === 'si' || String(rawAffected).toLowerCase() === 'sí',
  }
}
function reviewPayload(form: RowReviewForm): RowReviewPayload | string {
  const dni = digits(form.dni); const cuil = digits(form.cuil)
  if (!dni || dni.length > 20) return 'El DNI es obligatorio y debe tener hasta 20 caracteres.'
  if (form.cuil && cuil.length !== 11) return 'El CUIL debe tener 11 dígitos.'
  if (!form.nombres.trim() || form.nombres.trim().length > 100) return 'Los nombres son obligatorios y deben tener hasta 100 caracteres.'
  if (!form.apellido.trim() || form.apellido.trim().length > 100) return 'El apellido es obligatorio y debe tener hasta 100 caracteres.'
  if (!/^\d+$/.test(form.organizacionId) || Number(form.organizacionId) < 1) return 'La organización es obligatoria.'
  if (!form.fechaInicio || !/^\d{4}-\d{2}-\d{2}$/.test(form.fechaInicio)) return 'La fecha de inicio es obligatoria y debe tener formato YYYY-MM-DD.'
  if (form.fechaNacimiento && !/^\d{4}-\d{2}-\d{2}$/.test(form.fechaNacimiento)) return 'La fecha de nacimiento debe tener formato YYYY-MM-DD.'
  const antiquity = form.antiguedadAnios === '' ? undefined : Number(form.antiguedadAnios)
  if (antiquity !== undefined && (!Number.isInteger(antiquity) || antiquity < 0 || antiquity > 100)) return 'La antigüedad debe ser un número entero entre 0 y 100.'
  return {
    dni, cuil: cuil || undefined, nombres: form.nombres.trim(), apellido: form.apellido.trim(), sexo: form.sexo.trim() || undefined,
    fechaNacimiento: form.fechaNacimiento || undefined, organizacionId: Number(form.organizacionId),
    sectorId: form.sectorId === '' ? undefined : Number(form.sectorId), escalafon: form.escalafon.trim() || undefined,
    categoria: form.categoria.trim() || undefined, situacionRevista: form.situacionRevista.trim() || undefined,
    agrupamiento: form.agrupamiento.trim() || undefined, funcion: form.funcion.trim() || undefined,
    fechaInicio: form.fechaInicio, antiguedadAnios: antiquity, afectado: form.afectado,
  }
}
function rawValues(row: PersonalImportRow): Record<string, unknown> {
  try { const values: unknown = JSON.parse(row.valoresCrudos); return values && typeof values === 'object' && !Array.isArray(values) ? values as Record<string, unknown> : {} } catch { return {} }
}
function rawValue(row: PersonalImportRow, keys: string[]) { return rawValueFrom(rawValues(row), keys) }
function rawValueFrom(values: Record<string, unknown>, keys: string[]) {
  const key = Object.keys(values).find((candidate) => keys.some((expected) => candidate.toLowerCase() === expected.toLowerCase()))
  const value = key ? values[key] : undefined
  return value == null ? '' : String(value)
}
function dateInput(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : ''
}
function digits(value: string) { return value.replace(/\D/g, '') }
function formatDni(value?: string | null) { const result = digits(value ?? ''); return result ? new Intl.NumberFormat('es-AR').format(Number(result)) : '—' }
function permissionsFromToken(token: string): string[] {
  try {
    const encoded = token.split('.')[1]; if (!encoded) return []
    const payload = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>
    const values = ['permissions', 'permisos', 'authorities', 'roles', 'role', 'scope', 'realm_access', 'resource_access']
      .flatMap((key) => permissionValues(payload[key]))
    return values.some((value) => ['ADMIN', 'ROLE_ADMIN', 'ADMINISTRADOR', 'ROLE_ADMINISTRADOR'].includes(value.toUpperCase())) ? ['*'] : values
  } catch { return [] }
}
function permissionValues(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/[\s,]+/).filter(Boolean)
  if (Array.isArray(value)) return value.flatMap(permissionValues)
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  const namedPermission = ['authority', 'name', 'nombre', 'permission', 'permiso', 'code', 'codigo']
    .flatMap((key) => permissionValues(record[key]))
  const nestedValues = ['roles', 'role', 'authorities', 'permissions', 'permisos']
    .flatMap((key) => permissionValues(record[key]))
  const nestedResources = Object.entries(record)
    .filter(([key]) => !['authority', 'name', 'nombre', 'permission', 'permiso', 'code', 'codigo', 'roles', 'role', 'authorities', 'permissions', 'permisos'].includes(key))
    .flatMap(([, nested]) => permissionValues(nested))
  return [...namedPermission, ...nestedValues, ...nestedResources]
}
function Status({ value }: { value: string }) { return <span className={`status status-${value.toLowerCase()}`}>{value.replace(/_/g, ' ')}</span> }
function Stat({ label: statLabel, value }: { label: string; value: number }) { return <div className="stat"><strong>{value}</strong><span>{statLabel}</span></div> }
function Empty({ text }: { text: string }) { return <p className="empty">{text}</p> }
function label(value: string) { return ({ organizacionId: 'Organización', cuil: 'CUIL', reemplazante: 'Reemplazante', titular: 'Titular', agrupamiento: 'Agrupamiento', funcionTitular: 'Función titular', tipoLicencia: 'Tipo de licencia', observaciones: 'Observaciones', lugarTrabajo: 'Lugar de trabajo' } as Record<string, string>)[value] ?? value }
function formatDate(value?: string) { return value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(value)) : '—' }
export default App
