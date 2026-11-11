import { FormEvent, useCallback, useEffect, useState } from 'react'
import { ApiError } from './services/http'

type Request = <T>(token: string, path: string, init?: RequestInit) => Promise<T>
type Can = (permission: string) => boolean

type Organization = { id: number; nombre: string; udeo?: string }
type Role = { id: number; nombre: string; descripcion?: string | null; globalRole: boolean; permisos?: string[] | null }
type MembershipUser = {
  usuarioId: number; nombre: string; apellido: string; email: string; estado: string; rol: string; createdAt?: string
}
type GlobalUser = { id: number; nombre: string; apellido: string; email: string; estado: string; rolGlobal: string | null }
type CreatedUser = {
  id: number; nombre: string; apellido: string; email: string; organizacionId: number
  organizacionNombre: string; rol: string; passwordTemporal: string
}

export type RoleChange = { rol: string }
export type GlobalRoleChange = { rol: string | null }
export type MembershipRoleUpdated = {
  usuarioId: number; email: string; organizacionId: number; organizacionNombre: string; rol: string
}
export type GlobalRoleUpdated = { usuarioId: number; email: string; rol: string | null }

type UserForm = { nombre: string; apellido: string; email: string; rol: string }

const emptyForm: UserForm = { nombre: '', apellido: '', email: '', rol: '' }

function errorText(error: unknown) { return error instanceof Error ? error.message : 'No fue posible completar la solicitud.' }
function fullName(user: { nombre: string; apellido: string }) { return `${user.apellido}, ${user.nombre}` }
function isAdminRole(role: string | null) { return Boolean(role && role.toUpperCase().includes('ADMIN')) }

export default function Users({ token, can, request, onError }: {
  token: string; can: Can; request: Request; onError: (message: string) => void
}) {
  const [tab, setTab] = useState<'organization' | 'global'>('organization')
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
    </div>
    {rolesError && <div className="alert error"><span>No se pudieron cargar los roles: {rolesError}</span></div>}
    {tab === 'organization'
      ? <OrganizationUsers token={token} request={request} organizations={organizations} roles={membershipRoles} canManage={canManage} onError={onError} />
      : <GlobalUsers token={token} request={request} roles={globalRoles} onError={onError} />}
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

  useEffect(() => {
    if (!organizationId && organizations.length === 1) setOrganizationId(String(organizations[0].id))
  }, [organizations, organizationId])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(timer)
  }, [toast])

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
    event.preventDefault(); onError(''); setCreated(null)
    if (!organizationId) return onError('Seleccione una organización.')
    if (!form.rol) return onError('Seleccione un rol.')
    setCreating(true)
    try {
      const user = await request<CreatedUser>(token, `/api/v1/organizaciones/${organizationId}/usuarios`, {
        method: 'POST',
        body: JSON.stringify({ nombre: form.nombre.trim(), apellido: form.apellido.trim(), email: form.email.trim(), rol: form.rol }),
      })
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
        <label>Correo electrónico<input type="email" value={form.email} maxLength={255} onChange={(event) => update('email', event.target.value)} required /></label>
        <label>Rol<select value={form.rol} onChange={(event) => update('rol', event.target.value)} required><option value="">Seleccionar rol</option>{roles.map(role => <option key={role.id} value={role.nombre}>{role.nombre}</option>)}</select></label>
        {!roles.length && <p className="field-note">No hay roles de organización disponibles.</p>}
        <button className="primary" disabled={creating || !organizationId || !roles.length}>{creating ? <><span className="spinner" />Creando…</> : 'Crear usuario'}</button>
      </form>
      {created && <div className="result"><div><p className="eyebrow">USUARIO CREADO</p><h2>{created.nombre} {created.apellido}</h2><p>{created.email} · {created.rol}</p></div><div className="stat"><span>Contraseña temporal</span><strong>{created.passwordTemporal}</strong></div></div>}
    </section>
    <section className="card table-card"><div className="card-heading"><div><h2>Usuarios de la organización</h2><p>Consulte los usuarios asignados y edite su rol de membresía.</p></div><button className="secondary" disabled={loading || !organizationId} onClick={() => void load()}>{loading ? <><span className="spinner" />Cargando…</> : 'Recargar'}</button></div>
      {loading && !users && <p className="empty">Cargando usuarios…</p>}
      {!organizationId && <p className="empty">Seleccione una organización para ver sus usuarios.</p>}
      {organizationId && users && (users.length ? <div className="scroll-table"><table><thead><tr><th>Nombre</th><th>Email</th><th>Estado</th><th>Rol</th><th>Acciones</th></tr></thead><tbody>{users.map(user => <tr key={user.usuarioId}><td>{fullName(user)}</td><td>{user.email}</td><td>{user.estado}</td><td>{user.rol}</td><td>{canManage && <button className="link-button" onClick={() => setEditing(user)}>Editar rol</button>}</td></tr>)}</tbody></table></div> : <p className="empty">La organización no tiene usuarios asignados.</p>)}
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
    <section className="card filter-card"><form onSubmit={search}><label>Buscar<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, apellido o email" /></label><button className="primary" disabled={loading}>{loading ? <><span className="spinner" />Buscando…</> : 'Buscar'}</button></form></section>
    <section className="card table-card"><div className="card-heading"><div><h2>Usuarios globales</h2><p>Asigne o quite el rol global de cada usuario.</p></div><button className="secondary" disabled={loading} onClick={() => void load(query)}>{loading ? <><span className="spinner" />Cargando…</> : 'Recargar'}</button></div>
      {loading && !users && <p className="empty">Cargando usuarios…</p>}
      {users && (users.length ? <div className="scroll-table"><table><thead><tr><th>Nombre</th><th>Email</th><th>Estado</th><th>Rol global</th><th>Acciones</th></tr></thead><tbody>{users.map(user => {
        const value = drafts[user.id] ?? user.rolGlobal ?? ''
        return <tr key={user.id}><td>{fullName(user)}</td><td>{user.email}</td><td>{user.estado}</td><td><select aria-label={`Rol global de ${user.email}`} value={value} onChange={(event) => setDrafts(current => ({ ...current, [user.id]: event.target.value }))}><option value="">Sin rol global</option>{roles.map(role => <option key={role.id} value={role.nombre}>{role.nombre}</option>)}</select></td><td><button className="link-button" disabled={value === (user.rolGlobal ?? '')} onClick={() => setPending({ user, role: value })}>Guardar rol</button></td></tr>
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
