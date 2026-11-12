import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Migration from './Migration'
import { ApiError } from './services/http'

type Request = <T>(token: string, path: string, init?: RequestInit) => Promise<T>

const unassociated = {
  id: 11, organizacionId: null, organizacionNombre: null, hospitalNombre: 'Hospital Central', udeo: '6118',
  archivoOrigen: 'historico.xlsx', estado: 'APROBADA', cantidadFilas: 10, cantidadFilasConError: 0,
}
const associated = {
  id: 12, organizacionId: 5, organizacionNombre: 'Hospital Norte', hospitalNombre: 'Hospital Norte', udeo: '6120',
  archivoOrigen: 'historico.xlsx', estado: 'APROBADA', cantidadFilas: 4, cantidadFilasConError: 0,
}
const organizations = [
  { id: 5, nombre: 'Hospital Norte', udeo: '6120' },
  { id: 6, nombre: 'Hospital Sur', udeo: '6130' },
]

function renderModule(request: Request, can = true) {
  return render(<Migration token="token" can={() => can} request={request} />)
}

function uploadHistorical(request: Request, can = true) {
  const view = renderModule(request, can)
  fireEvent.change(screen.getByLabelText('Archivo Excel'), { target: { files: [new File(['x'], 'historico.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })] } })
  fireEvent.click(screen.getByText('Migrar archivo'))
  return view
}

describe('Migration', () => {
  afterEach(() => { cleanup() })

  it('muestra acceso restringido sin los permisos de migración', () => {
    renderModule(vi.fn() as unknown as Request, false)
    expect(screen.getByText('Acceso restringido')).toBeTruthy()
  })

  it('muestra la acción solo para importaciones sin organización y conserva hospital y UDEO', async () => {
    const request = vi.fn(async (_token: string, path: string) => path.includes('migrar-historico-consolidado') ? [unassociated, associated] : organizations) as unknown as Request
    uploadHistorical(request)
    expect(await screen.findByText('Hospital Central')).toBeTruthy()
    expect(screen.getByText('6118')).toBeTruthy()
    expect(screen.getByText('Sin organización')).toBeTruthy()
    expect(screen.getAllByText('Asociar organización')).toHaveLength(1)
    expect(screen.getAllByText('Hospital Norte').length).toBeGreaterThan(0)
  })

  it('asocia una organización y refresca la fila manteniendo los datos originales', async () => {
    const updated = { ...unassociated, organizacionId: 6, organizacionNombre: 'Hospital Sur' }
    const request = vi.fn(async (_token: string, path: string, init?: RequestInit) => {
      if (path.includes('migrar-historico-consolidado')) return [unassociated, associated]
      if (path === '/api/v1/admin/organizaciones') return organizations
      if (init?.method === 'PUT') return updated
      throw new Error(`Solicitud inesperada: ${path}`)
    }) as unknown as Request
    uploadHistorical(request)
    fireEvent.click(await screen.findByText('Asociar organización'))
    fireEvent.change(await screen.findByLabelText('Organización'), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Asociar' }))
    await waitFor(() => expect(vi.mocked(request).mock.calls.some(([, path, init]) => path === '/api/v1/admin/importaciones/11/organizacion' && init?.method === 'PUT' && init.body === JSON.stringify({ organizacionId: 6 }))).toBe(true))
    expect(await screen.findByText('Organización asociada correctamente.')).toBeTruthy()
    expect(screen.queryByText('Asociar organización')).toBeNull()
    expect(screen.getByText('Hospital Sur')).toBeTruthy()
    expect(screen.getByText('Hospital Central')).toBeTruthy()
    expect(screen.getByText('6118')).toBeTruthy()
  })

  it('muestra un mensaje claro para 403, 404 y 409 al asociar', async () => {
    for (const [status, expected] of [[403, 'permiso'], [404, 'ya no existe'], [409, 'ya tiene una organización']] as const) {
      const request = vi.fn(async (_token: string, path: string, init?: RequestInit) => {
        if (path.includes('migrar-historico-consolidado')) return [unassociated]
        if (path === '/api/v1/admin/organizaciones') return organizations
        if (init?.method === 'PUT') throw new ApiError('Error', status)
        throw new Error(`Solicitud inesperada: ${path}`)
      }) as unknown as Request
      const view = uploadHistorical(request)
      fireEvent.click(await screen.findByText('Asociar organización'))
      fireEvent.change(await screen.findByLabelText('Organización'), { target: { value: '6' } })
      fireEvent.click(screen.getByRole('button', { name: 'Asociar' }))
      expect(await screen.findByText(new RegExp(expected, 'i'))).toBeTruthy()
      view.unmount()
    }
  })

  it('muestra el mensaje del backend cuando la migración tiene filas con errores', async () => {
    const request = vi.fn(async () => { throw new ApiError('El archivo contiene filas con errores.', 409) }) as unknown as Request
    uploadHistorical(request)
    expect(await screen.findByText('El archivo contiene filas con errores.')).toBeTruthy()
  })
})
