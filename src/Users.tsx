import { FormEvent, useCallback, useEffect, useState } from 'react'
import { ApiError, message } from './services/http'

type Request = <T>(token: string, path: string, init?: RequestInit) => Promise<T>
type Can = (permission: string) => boolean

type Organization = { id: number; nombre: string; udeo?: string }
type Role = { id: number; nombre: string; descripcion?: string | null; globalRole: boolean; permisos?: string[] | null }
type MembershipUser = {
  usuarioId: number; nombre: string; apellido: string; username?: string; email: string; estado: string; rol: string; createdAt?: string
}
type GlobalUser = { id: number; nombre: string; apellido: string; username?: string; email: string; estado: string; rolGlobal: string | null }
type GlobalMembershipRow = {
  usuarioId: number; nombre: string; apellido: string; username?: string | null; email: string; dni?: string | null; estado: string; rolGlobal: string | null
  organizacionId: number | null; organizacionNombre: string | null; rol: string | null; membresiaEstado?: string | null; createdAt?: string | null
}
type CreatedUser = {
  id: number; nombre: string; apellido: string; username: string; email: string; organizacionId: number
  organizacionNombre: string; rol: string; password: string
}

export type RoleChange = { rol: string }
export type GlobalRoleChange = { rol: string | null }
export type MembershipRoleUpdated = {
  usuarioId: number; email: string; organizacionId: number; organizacionNombre: string; rol: string
}
export type GlobalRoleUpdated = { usuarioId: number; email: string; rol: string | null }

type UserForm = { nombre: string; apellido: string; username: string; email: string; rol: string; manualPassword: boolean; password: string; showPassword: boolean }

const emptyForm: UserForm = { nombre: '', apellido: '', username: '', email: '', rol: '', manualPassword: false, password: '', showPassword: false }

function errorText(error: unknown) { return message(error) }
function fullName(user: { nombre: string; apellido: string }) { return `${user.apellido}, ${user.nombre}` }
function isAdminRole(role: string | null) { return Boolean(role && role.toUpperCase().includes('ADMIN')) }
async function copyText(value: string) { try { await navigator.clipboard.writeText(value) } catch { /* ignore */ } }
function formatDate(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export default function Users({ token, can, request, onError }: {
  token: string; can: Can; request: Request; onError: (message: string) => void
}) {
  const [tab, setTab] = useState<'organization' | 'global' | 'memberships'>('organization')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [rolesError, setRolesError] = useState('')
  const canManage = can('USUARIOS_GESTIONAR')

  useEffect(() => {
    let active = true
    request<Organization[]>(token, '/api/v1/organizaciones')
      .then(items => { if (active) setOrganizations(items) })
      .catch(error => { if (active) onError(errorText(error)) })
    request<Role[]>(token, '/api/v1/roles')
      .then(items => { if (active) setRoles(items) })
      .catch(error => { if (active) setRolesError(errorText(error)) })
    return () => { active = false }
  }, [request, token, onError])

  const membershipRoles = roles.filter(role => !role.globalRole)
  const globalRoles = roles.filter(role => role.globalRole)

  return <div className="stack">
    <div className="tabs users-tabs">
      <button className={tab === 'organization' ? 'active' : ''} onClick={() => setTab('organization')}>Usuarios por organización</button>
      {canManage && <button className={tab === 'global' ? 'active' : ''} onClick={() => setTab('global')}>Usuarios globales</button>}
      {canManage && <button className={tab === 'memberships' ? 'active' : ''} onClick={() => setTab('memberships')}>Membresías</button>}
    </div>
    {rolesError && <div className="alert error"><span>No se pudieron cargar los roles: {rolesError}</span></div>}
    {tab === 'organization'
      ? <OrganizationUsers token={token} request={request} organizations={organizations} roles={membershipRoles} canManage={canManage} onError={onError} />
      : tab === 'global'
        ? <GlobalUsers token={token} request={request} roles={globalRoles} onError={onError} />
          : <GlobalMemberships token={token} request={request} roles={roles} />}
  </div>
}

function OrganizationUsers({ token, request, organizations, roles, canManage, onError }: {
  token: string; request: Request; organizations: Organization[]; roles: Role[]
  canManage: boolean; onError: (message: string) => void
}) {
  const [organizationId, setOrganizationId] = useState('')
  const [users, setUsers] = useState<MembershipUser[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [created, setCreated] = useState<CreatedUser | null>(null)
  const [editing, setEditing] = useState<MembershipUser | null>(null)
  const [savingRole, setSavingRole] = useState(false)
  const [toast, setToast] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!organizationId && organizations.length === 1) setOrganizationId(String(organizations[0].id))
  }, [organizations, organizationId])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(timer)
  }, [copied])

  const load = useCallback(async (id = organizationId) => {
    if (!id) { setUsers(null); return }
    setLoading(true); onError('')
    try { setUsers(await request<MembershipUser[]>(token, `/api/v1/organizaciones/${id}/usuarios`)) }
    catch (error) { onError(errorText(error)) }
    finally { setLoading(false) }
  }, [organizationId, onError, request, token])
  useEffect(() => { void load(organizationId) }, [load, organizationId])

  function update<K extends keyof UserForm>(key: K, value: UserForm[K]) { setForm(current => ({ ...current, [key]: value })) }
  async function submit(event: FormEvent) {
    event.preventDefault(); onError(''); setCreated(null); setCopied(false)
    if (!organizationId) return onError('Seleccione una organización.')
    if (!form.rol) return onError('Seleccione un rol.')
    if (form.manualPassword && form.password.length > 0 && form.password.length < 8) return onError('La contraseña debe tener al menos 8 caracteres.')
    setCreating(true)
    try {
      const body: Record<string, string> = { nombre: form.nombre.trim(), apellido: form.apellido.trim(), username: form.username.trim(), email: form.email.trim(), rol: form.rol }
      if (form.manualPassword && form.password) body.password = form.password
      const user = await request<CreatedUser>(token, `/api/v1/organizaciones/${organizationId}/usuarios`, { method: 'POST', body: JSON.stringify(body) })
      setCreated(user)
      setForm(emptyForm)
      setToast('Usuario creado correctamente.')
      await load()
    } catch (error) { onError(errorText(error)) } finally { setCreating(false) }
  }
  async function saveRole(user: MembershipUser, role: string) {
    setSavingRole(true); onError('')
    try {
      const change: RoleChange = { rol: role }
      const updated = await request<MembershipRoleUpdated>(token, `/api/v1/organizaciones/${organizationId}/usuarios/${user.usuarioId}/rol`, {
        method: 'PUT', body: JSON.stringify(change),
      })
      setUsers(current => current ? current.map(item => item.usuarioId === updated.usuarioId ? { ...item, rol: updated.rol } : item) : current)
      setToast(`Rol de ${updated.email} actualizado a ${updated.rol}.`)
      setEditing(null)
    } catch (error) {
      onError(errorText(error))
      if (error instanceof ApiError && error.status === 404) { setEditing(null); await load() }
    } finally { setSavingRole(false) }
  }

  return <div className="stack">
    <section className="card filter-card"><form onSubmit={(event) => event.preventDefault()}><label>Organización<select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">Seleccionar organización</option>{organizations.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label></form></section>
    <section className="card"><div className="card-heading"><div><h2>Alta de usuario</h2><p>Registre un usuario en la organización seleccionada. El usuario recibirá el acceso con el rol indicado.</p></div></div>
      <form className="upload-form" onSubmit={submit}>
        <label>Nombre<input value={form.nombre} maxLength={100} onChange={(event) => update('nombre', event.target.value)} required /></label>
        <label>Apellido<input value={form.apellido} maxLength={100} onChange={(event) => update('apellido', event.target.value)} required /></label>
        <label>Usuario<input value={form.username} maxLength={100} pattern="[A-Za-z0-9._-]+" title="Solo letras, dígitos, punto, guion y guion bajo" onChange={(event) => update('username', event.target.value)} required placeholder="ana.perez" /></label>
        <label>Correo electrónico<input type="email" value={form.email} maxLength={255} onChange={(event) => update('email', event.target.value)} required /></label>
        <label className="check-label"><input type="checkbox" checked={form.manualPassword} onChange={(event) => update('manualPassword', event.target.checked)} /> Definir contraseña manualmente</label>
        {form.manualPassword && <label>Contraseña<div className="inline-field"><input type={form.showPassword ? 'text' : 'password'} value={form.password} minLength={8} maxLength={100} onChange={(event) => update('password', event.target.value)} required /><button type="button" className="secondary" onClick={() => update('showPassword', !form.showPassword)}>{form.showPassword ? 'Ocultar' : 'Mostrar'}</button></div></label>}
        <label>Rol<select value={form.rol} onChange={(event) => update('rol', event.target.value)} required><option value="">Seleccionar rol</option>{roles.map(role => <option key={role.id} value={role.nombre}>{role.nombre}</option>)}</select></label>
        {!roles.length && <p className="field-note">No hay roles de organización disponibles.</p>}
        <button className="primary" disabled={creating || !organizationId || !roles.length}>{creating ? <><span className="spinner" />Creando…</> : 'Crear usuario'}</button>
      </form>
      {created && <div className="result"><div><p className="eyebrow">USUARIO CREADO</p><h2>{created.nombre} {created.apellido}</h2><p>{created.username} · {created.email} · {created.rol}</p></div><div className="stat"><span>Contraseña (guardala, se muestra una sola vez)</span><div className="inline-field"><strong>{created.password}</strong><button type="button" className="secondary" onClick={() => { void copyText(created.password); setCopied(true) }}>{copied ? 'Copiada' : 'Copiar'}</button></div></div></div>}
    </section>
    <section className="card table-card"><div className="card-heading"><div><h2>Usuarios de la organización</h2><p>Consulte los usuarios asignados y edite su rol de membresía.</p></div><button className="secondary" disabled={loading || !organizationId} onClick={() => void load()}>{loading ? <><span className="spinner" />Cargando…</> : 'Recargar'}</button></div>
      {loading && !users && <p className="empty">Cargando usuarios…</p>}
      {!organizationId && <p className="empty">Seleccione una organización para ver sus usuarios.</p>}
      {organizationId && users && (users.length ? <div className="scroll-table"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Email</th><th>Estado</th><th>Rol</th><th>Acciones</th></tr></thead><tbody>{users.map(user => <tr key={user.usuarioId}><td>{fullName(user)}</td><td>{user.username || '—'}</td><td>{user.email}</td><td>{user.estado}</td><td>{user.rol}</td><td>{canManage && <button className="link-button" onClick={() => setEditing(user)}>Editar rol</button>}</td></tr>)}</tbody></table></div> : <p className="empty">La organización no tiene usuarios asignados.</p>)}
    </section>
    {editing && <MembershipRoleDialog user={editing} roles={roles} saving={savingRole} onCancel={() => setEditing(null)} onSave={(role) => void saveRole(editing, role)} />}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>
}

function MembershipRoleDialog({ user, roles, saving, onCancel, onSave }: {
  user: MembershipUser; roles: Role[]; saving: boolean; onCancel: () => void; onSave: (role: string) => void
}) {
  const [role, setRole] = useState(user.rol)
  const [confirming, setConfirming] = useState(false)
  function submit(event: FormEvent) { event.preventDefault(); if (role) setConfirming(true) }
  if (confirming) return <div className="modal-backdrop"><section className="modal confirm-dialog"><h2>Confirmar cambio de rol</h2><p>Se cambiará el rol de <strong>{fullName(user)}</strong> de <strong>{user.rol}</strong> a <strong>{role}</strong>.</p><div className="action-group"><button className="secondary" disabled={saving} onClick={() => setConfirming(false)}>Volver</button><button className="primary" disabled={saving} onClick={() => onSave(role)}>{saving ? <><span className="spinner" />Guardando…</> : 'Confirmar'}</button></div></section></div>
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}><div className="card-heading"><div><h2>Editar rol de membresía</h2><p>{fullName(user)} · {user.email}</p></div><button className="close" type="button" onClick={onCancel}>×</button></div>
    <div className="form-grid"><label>Rol<select value={role} onChange={(event) => setRole(event.target.value)} disabled={!roles.length} required><option value="">Seleccionar rol</option>{roles.map(item => <option key={item.id} value={item.nombre}>{item.nombre}</option>)}</select></label></div>
    {!roles.length && <p className="field-note">No hay roles de organización disponibles para asignar.</p>}
    <div className="action-group"><button className="secondary" type="button" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving || !role || !roles.length}>{saving ? <><span className="spinner" />Guardando…</> : 'Guardar rol'}</button></div>
  </form></div>
}

function GlobalUsers({ token, request, roles, onError }: {
  token: string; request: Request; roles: Role[]; onError: (message: string) => void
}) {
  const [users, setUsers] = useState<GlobalUser[] | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [pending, setPending] = useState<{ user: GlobalUser; role: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const load = useCallback(async (text: string) => {
    setLoading(true); onError('')
    try { setUsers(await request<GlobalUser[]>(token, `/api/v1/admin/usuarios${text.trim() ? `?q=${encodeURIComponent(text.trim())}` : ''}`)) }
    catch (error) { onError(errorText(error)) }
    finally { setLoading(false) }
  }, [onError, request, token])
  useEffect(() => { void load('') }, [load])

  function search(event: FormEvent) { event.preventDefault(); void load(query) }
  async function save() {
    if (!pending) return
    setSaving(true); onError('')
    try {
      const change: GlobalRoleChange = { rol: pending.role || null }
      const updated = await request<GlobalRoleUpdated>(token, `/api/v1/admin/usuarios/${pending.user.id}/rol-global`, {
        method: 'PUT', body: JSON.stringify(change),
      })
      setUsers(current => current ? current.map(item => item.id === updated.usuarioId ? { ...item, rolGlobal: updated.rol } : item) : current)
      setDrafts(current => { const next = { ...current }; delete next[pending.user.id]; return next })
      setToast(`Rol global de ${updated.email} actualizado a ${updated.rol ?? 'sin rol global'}.`)
      setPending(null)
    } catch (error) { onError(errorText(error)) } finally { setSaving(false) }
  }

  return <div className="stack">
    <section className="card filter-card"><form onSubmit={search}><label>Buscar<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, apellido, usuario o email" /></label><button className="primary" disabled={loading}>{loading ? <><span className="spinner" />Buscando…</> : 'Buscar'}</button></form></section>
    <section className="card table-card"><div className="card-heading"><div><h2>Usuarios globales</h2><p>Asigne o quite el rol global de cada usuario.</p></div><button className="secondary" disabled={loading} onClick={() => void load(query)}>{loading ? <><span className="spinner" />Cargando…</> : 'Recargar'}</button></div>
      {loading && !users && <p className="empty">Cargando usuarios…</p>}
      {users && (users.length ? <div className="scroll-table"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Email</th><th>Estado</th><th>Rol global</th><th>Acciones</th></tr></thead><tbody>{users.map(user => {
        const value = drafts[user.id] ?? user.rolGlobal ?? ''
        return <tr key={user.id}><td>{fullName(user)}</td><td>{user.username || '—'}</td><td>{user.email}</td><td>{user.estado}</td><td><select aria-label={`Rol global de ${user.email}`} value={value} onChange={(event) => setDrafts(current => ({ ...current, [user.id]: event.target.value }))}><option value="">Sin rol global</option>{roles.map(role => <option key={role.id} value={role.nombre}>{role.nombre}</option>)}</select></td><td><button className="link-button" disabled={value === (user.rolGlobal ?? '')} onClick={() => setPending({ user, role: value })}>Guardar rol</button></td></tr>
      })}</tbody></table></div> : <p className="empty">No hay usuarios para los filtros seleccionados.</p>)}
    </section>
    {pending && <GlobalRoleDialog user={pending.user} role={pending.role} saving={saving} onCancel={() => setPending(null)} onConfirm={() => void save()} />}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>
}

function GlobalRoleDialog({ user, role, saving, onCancel, onConfirm }: {
  user: GlobalUser; role: string; saving: boolean; onCancel: () => void; onConfirm: () => void
}) {
  const removing = !role
  const sensitive = isAdminRole(role) || isAdminRole(user.rolGlobal)
  return <div className="modal-backdrop"><section className="modal confirm-dialog"><h2>{removing ? 'Quitar rol global' : 'Cambiar rol global'}</h2><p>Usuario: <strong>{fullName(user)}</strong> ({user.email}).</p><p>{removing ? `Se quitará el rol global${user.rolGlobal ? ` ${user.rolGlobal}` : ''}.` : `Se asignará el rol global ${role}.`}</p>{sensitive && <div className="alert error">Atención: este cambio otorga o revoca privilegios de administración.</div>}<div className="action-group"><button className="secondary" disabled={saving} onClick={onCancel}>Cancelar</button><button className={removing || sensitive ? 'danger-button' : 'primary'} disabled={saving} onClick={onConfirm}>{saving ? <><span className="spinner" />Guardando…</> : 'Confirmar'}</button></div></section></div>
}

function GlobalMemberships({ token, request, roles }: { token: string; request: Request; roles: Role[] }) {
  const [rows, setRows] = useState<GlobalMembershipRow[] | null>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [editing, setEditing] = useState<GlobalMembershipRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timer) }, [toast])

  const load = useCallback(() => {
    let active = true
    setLoading(true); setError(''); setForbidden(false)
    const q = debouncedQuery ? `?q=${encodeURIComponent(debouncedQuery)}` : ''
    request<GlobalMembershipRow[]>(token, `/api/v1/admin/usuarios/membresias${q}`)
      .then(items => { if (active) setRows(items) })
      .catch(err => {
        if (!active) return
        if (err instanceof ApiError && err.status === 403) { setForbidden(true); setRows(null); return }
        setError(errorText(err))
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [debouncedQuery, request, token])

  useEffect(() => load(), [load])

  async function save(form: MembershipEditForm) {
    if (!editing) return
    setSaving(true); setError('')
    try {
      const body: Record<string, unknown> = { nombre: form.nombre.trim(), apellido: form.apellido.trim(), email: form.email.trim(), dni: form.dni.trim() || null }
      await request(token, `/api/v1/admin/usuarios/${editing.usuarioId}`, { method: 'PUT', body: JSON.stringify(body) })
      if (editing.organizacionId != null && form.rol && form.rol !== (editing.rol ?? '')) {
        await request(token, `/api/v1/organizaciones/${editing.organizacionId}/usuarios/${editing.usuarioId}/rol`, { method: 'PUT', body: JSON.stringify({ rol: form.rol }) })
      }
      setRows(current => current ? current.map(row => { const updated = { ...row, nombre: form.nombre.trim(), apellido: form.apellido.trim(), email: form.email.trim(), dni: form.dni.trim() || null }; return row.usuarioId === editing.usuarioId && row.organizacionId === editing.organizacionId ? { ...updated, rol: form.rol || row.rol } : row.usuarioId === editing.usuarioId ? updated : row }) : current)
      setToast('Usuario actualizado.')
      setEditing(null)
      load()
    } catch (err) { setError(errorText(err)) } finally { setSaving(false) }
  }

  return <div className="stack">
    <section className="card filter-card"><form onSubmit={(event) => event.preventDefault()}><label>Buscar<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, apellido, usuario, email, rol global, organización o rol" /></label></form></section>
    {error && <div className="alert error"><span>{error}</span></div>}
    {forbidden ? <div className="alert error"><span>Sin permisos para gestionar usuarios</span></div> : <section className="card table-card"><div className="card-heading"><div><h2>Membresías de usuarios</h2><p>Vista global por usuario y organización.</p></div>{loading && <span className="field-note"><span className="spinner" /> Cargando.</span>}</div>
      {loading && !rows && <p className="empty">Cargando membresías.</p>}
      {rows && (rows.length ? <div className="scroll-table"><table><thead><tr><th>Usuario</th><th>Nombre</th><th>DNI</th><th>Email</th><th>Organización</th><th>Rol</th><th>Estado</th><th>Rol global</th><th>Alta</th><th>Acciones</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.usuarioId}-${row.organizacionId ?? 'none'}-${index}`}><td>{row.username || '-'}</td><td>{fullName(row)}</td><td>{row.dni || '-'}</td><td>{row.email}</td><td>{row.organizacionNombre ?? 'Sin organización'}</td><td>{row.rol ?? '-'}</td><td>{row.membresiaEstado ?? row.estado ?? '-'}</td><td>{row.rolGlobal ?? '-'}</td><td>{formatDate(row.createdAt ?? null)}</td><td><button className="link-button" onClick={() => setEditing(row)}>Editar</button></td></tr>)}</tbody></table></div> : <p className="empty">No hay usuarios para los filtros seleccionados.</p>)}
    </section>}
    {editing && <MembershipEditDialog row={editing} roles={roles} saving={saving} onCancel={() => setEditing(null)} onSave={(form) => void save(form)} />}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>
}

type MembershipEditForm = { nombre: string; apellido: string; dni: string; email: string; rol: string }
function MembershipEditDialog({ row, roles, saving, onCancel, onSave }: { row: GlobalMembershipRow; roles: Role[]; saving: boolean; onCancel: () => void; onSave: (form: MembershipEditForm) => void }) {
  const [form, setForm] = useState<MembershipEditForm>({ nombre: row.nombre ?? '', apellido: row.apellido ?? '', dni: row.dni ?? '', email: row.email ?? '', rol: row.rol ?? '' })
  function submit(event: FormEvent) { event.preventDefault(); onSave(form) }
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}><div className="card-heading"><div><h2>Editar usuario</h2><p>{row.username || fullName(row)}{row.organizacionNombre ? ` · ${row.organizacionNombre}` : ''}</p></div><button className="close" type="button" onClick={onCancel}>×</button></div>
    <div className="form-grid">
      <label>Nombre<input value={form.nombre} maxLength={100} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></label>
      <label>Apellido<input value={form.apellido} maxLength={100} onChange={(e) => setForm({ ...form, apellido: e.target.value })} required /></label>
      <label>DNI<input value={form.dni} maxLength={20} onChange={(e) => setForm({ ...form, dni: e.target.value })} /></label>
      <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
      <label>Rol en organización<select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })} disabled={row.organizacionId == null || !roles.length}><option value="">Sin cambio / sin rol</option>{roles.map(role => <option key={role.id} value={role.nombre}>{role.nombre}</option>)}</select></label>
    </div>
    {row.organizacionId == null && <p className="field-note">Este usuario no tiene organización asociada; solo se actualizarán sus datos.</p>}
    <div className="action-group"><button className="secondary" type="button" onClick={onCancel} disabled={saving}>Cancelar</button><button className="primary" disabled={saving}>{saving ? <><span className="spinner" />Guardando.</> : 'Guardar cambios'}</button></div>
  </form></div>
}
