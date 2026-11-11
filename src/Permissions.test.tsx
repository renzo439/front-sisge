import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Permissions from './Permissions'
import { ApiError } from './services/http'

type Request = <T>(token: string, path: string, init?: RequestInit) => Promise<T>

const permissions = [
  { id: 1, codigo: 'ROLES_GESTIONAR', descripcion: 'Gestión de roles' },
  { id: 2, codigo: 'PERMISOS_GESTIONAR', descripcion: 'Gestión de permisos' },
]

function renderModule(request: Request, can = true) {
  const onError = vi.fn()
  return { onError, ...render(<Permissions token="token" can={() => can} request={request} onError={onError} />) }
}

describe('Permissions', () => {
  afterEach(() => { cleanup() })

  it('muestra acceso restringido sin PERMISOS_GESTIONAR', () => {
    renderModule(vi.fn() as unknown as Request, false)
    expect(screen.getByText('Acceso restringido')).toBeTruthy()
  })

  it('lista el catálogo de permisos ordenado por código', async () => {
    const request = vi.fn(async () => permissions) as unknown as Request
    renderModule(request)
    expect(await screen.findByText('PERMISOS_GESTIONAR')).toBeTruthy()
    expect(screen.getByText('ROLES_GESTIONAR')).toBeTruthy()
  })

  it('crea un permiso normalizando el código a mayúsculas', async () => {
    const created = { id: 3, codigo: 'NUEVO_PERMISO', descripcion: 'Permiso nuevo' }
    const request = vi.fn(async (_token: string, path: string, init?: RequestInit) => {
      if (init?.method === 'POST') return created
      return path === '/api/v1/permisos' ? [...permissions, created] : created
    }) as unknown as Request
    renderModule(request)
    fireEvent.click(await screen.findByText('Nuevo permiso'))
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'nuevo_permiso' } })
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Permiso nuevo' } })
    fireEvent.click(screen.getByText('Guardar permiso'))
    await waitFor(() => expect(vi.mocked(request).mock.calls.some(([, path, init]) => path === '/api/v1/permisos' && init?.method === 'POST' && init.body === JSON.stringify({ codigo: 'NUEVO_PERMISO', descripcion: 'Permiso nuevo' }))).toBe(true))
  })

  it('muestra el mensaje del backend al intentar eliminar un permiso asignado', async () => {
    const request = vi.fn(async (_token: string, _path: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') throw new ApiError('El permiso está asignado a roles.', 409)
      return permissions
    }) as unknown as Request
    renderModule(request)
    fireEvent.click((await screen.findAllByText('Eliminar'))[0])
    fireEvent.click(screen.getByText('Eliminar', { selector: 'button.danger-button' }))
    expect(await screen.findByText('El permiso está asignado a roles.')).toBeTruthy()
  })
})
