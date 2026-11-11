import { FormEvent, useCallback, useEffect, useState } from 'react'
import { ApiError } from './services/http'

type Request = <T>(token: string, path: string, init?: RequestInit) => Promise<T>
type Can = (permission: string) => boolean

export type Permission = { id: number; codigo: string; descripcion: string | null }
export type PermissionPayload = { codigo: string; descripcion?: string }
type PermissionForm = { codigo: string; descripcion: string }

function errorText(error: unknown) { return error instanceof Error ? error.message : 'No fue posible completar la solicitud.' }
function normalizePermissionCode(value: string) { return value.trim().toUpperCase() }
function sanitizePermissionCode(value: string) { return value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }

function permissionForm(permission?: Permission): PermissionForm {
  return { codigo: permission?.codigo ?? '', descripcion: permission?.descripcion ?? '' }
}
function permissionPayload(form: PermissionForm): PermissionPayload | string {
  const codigo = normalizePermissionCode(form.codigo)
  if (!codigo) return 'El código es obligatorio.'
  if (codigo.length > 100) return 'El código debe tener hasta 100 caracteres.'
  if (!/^[A-Z0-9_]+$/.test(codigo)) return 'El código solo admite letras, dígitos y guiones bajos.'
  const descripcion = form.descripcion.trim()
  if (descripcion.length > 255) return 'La descripción debe tener hasta 255 caracteres.'
  return { codigo, descripcion: descripcion || undefined }
}

export default function Permissions({ token, can, request, onError }: {
  token: string; can: Can; request: Request; onError: (message: string) => void
}) {
  if (!can('PERMISOS_GESTIONAR')) {
    return <section className="card pending-feature"><h2>Acceso restringido</h2><p>Se requiere el permiso global PERMISOS_GESTIONAR para administrar permisos.</p></section>
  }
  return <PermissionManager token={token} request={request} onError={onError} />
}

function PermissionManager({ token, request, onError }: {
  token: string; request: Request; onError: (message: string) => void
}) {
  const [permissions, setPermissions] = useState<Permission[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editor, setEditor] = useState<{ mode: 'create' } | { mode: 'edit'; permission: Permission } | null>(null)
  const [deleting, setDeleting] = useState<Permission | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const load = useCallback(async () => {
    setLoading(true); onError('')
    try {
      const items = await request<Permission[]>(token, '/api/v1/permisos')
      setPermissions([...items].sort((a, b) => a.codigo.localeCompare(b.codigo)))
    } catch (error) { onError(errorText(error)) } finally { setLoading(false) }
  }, [onError, request, token])
  useEffect(() => { void load() }, [load])

  async function openEdit(id: number) {
    onError('')
    try { setEditor({ mode: 'edit', permission: await request<Permission>(token, `/api/v1/permisos/${id}`) }) }
    catch (error) { onError(errorText(error)) }
  }
  async function save(payload: PermissionPayload) {
    if (!editor) return
    setSaving(true); onError('')
    try {
      if (editor.mode === 'edit') await request<Permission>(token, `/api/v1/permisos/${editor.permission.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      else await request<Permission>(token, '/api/v1/permisos', { method: 'POST', body: JSON.stringify(payload) })
      setToast(editor.mode === 'edit' ? 'Permiso actualizado correctamente.' : 'Permiso creado correctamente.')
      setEditor(null); await load()
    } catch (error) { onError(errorText(error)) } finally { setSaving(false) }
  }
  async function remove() {
    if (!deleting) return
    setSaving(true); onError(''); setDeleteError('')
    try {
      await request(token, `/api/v1/permisos/${deleting.id}`, { method: 'DELETE' })
      setToast('Permiso eliminado correctamente.')
      setDeleting(null); await load()
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setDeleteError(errorText(error))
      else onError(errorText(error))
    } finally { setSaving(false) }
  }

  return <div className="stack">
    <section className="card table-card"><div className="card-heading"><div><h2>Permisos</h2><p>Administre el catálogo de permisos que pueden asignarse a los roles.</p></div><div className="action-group"><button className="secondary" disabled={loading} onClick={() => void load()}>{loading ? <><span className="spinner" />Cargando…</> : 'Recargar'}</button><button className="primary" onClick={() => setEditor({ mode: 'create' })}>Nuevo permiso</button></div></div>
      {loading && !permissions && <p className="empty">Cargando permisos…</p>}
      {permissions && (permissions.length ? <div className="scroll-table"><table><thead><tr><th>Código</th><th>Descripción</th><th>Acciones</th></tr></thead><tbody>{permissions.map(permission => <tr key={permission.id}><td>{permission.codigo}</td><td>{permission.descripcion || '—'}</td><td><div className="row-actions"><button className="link-button" onClick={() => void openEdit(permission.id)}>Editar</button><button className="link-button" onClick={() => { setDeleteError(''); setDeleting(permission) }}>Eliminar</button></div></td></tr>)}</tbody></table></div> : <p className="empty">No hay permisos registrados.</p>)}
    </section>
    {editor && <PermissionEditor permission={editor.mode === 'edit' ? editor.permission : undefined} saving={saving} onCancel={() => setEditor(null)} onSave={save} />}
    {deleting && <div className="modal-backdrop"><section className="modal confirm-dialog"><h2>Eliminar permiso</h2><p>¿Confirma la eliminación del permiso <strong>{deleting.codigo}</strong>? Esta acción no puede deshacerse.</p>{deleteError && <div className="alert error"><span>{deleteError}</span></div>}<div className="action-group"><button className="secondary" onClick={() => setDeleting(null)}>Cancelar</button><button className="danger-button" disabled={saving} onClick={() => void remove()}>{saving ? <><span className="spinner" />Eliminando…</> : 'Eliminar'}</button></div></section></div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>
}

function PermissionEditor({ permission, saving, onCancel, onSave }: {
  permission?: Permission; saving: boolean; onCancel: () => void; onSave: (payload: PermissionPayload) => Promise<void>
}) {
  const [form, setForm] = useState<PermissionForm>(() => permissionForm(permission))
  const [validationError, setValidationError] = useState('')
  function update<K extends keyof PermissionForm>(key: K, value: PermissionForm[K]) { setForm(current => ({ ...current, [key]: value })) }
  function submit(event: FormEvent) {
    event.preventDefault(); setValidationError('')
    const payload = permissionPayload(form)
    if (typeof payload === 'string') return setValidationError(payload)
    void onSave(payload)
  }
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}><div className="card-heading"><div><h2>{permission ? 'Editar permiso' : 'Nuevo permiso'}</h2><p>{permission ? `Modifique los datos de ${permission.codigo}.` : 'Complete los datos del nuevo permiso.'}</p></div><button className="close" type="button" onClick={onCancel}>×</button></div>
    {validationError && <div className="alert error">{validationError}</div>}
    <div className="form-grid">
      <label>Código<input value={form.codigo} maxLength={100} onChange={(event) => update('codigo', sanitizePermissionCode(event.target.value))} placeholder="PERMISOS_GESTIONAR" required /></label>
      <label>Descripción<input value={form.descripcion} maxLength={255} onChange={(event) => update('descripcion', event.target.value)} /></label>
    </div>
    <p className="field-note">El código se guarda en mayúsculas y solo admite letras, dígitos y guiones bajos.</p>
    <div className="action-group"><button className="secondary" type="button" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving}>{saving ? <><span className="spinner" />Guardando…</> : 'Guardar permiso'}</button></div>
  </form></div>
}
