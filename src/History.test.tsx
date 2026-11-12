import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import History from './History'
import { ApiError } from './services/http'

type Request = <T>(token: string, path: string, init?: RequestInit) => Promise<T>

const row = {
  id: 1, organizacionId: 5, hospitalNombre: 'Hospital Central', udeo: '6118', importacionId: 10,
  archivoOrigen: 'historico.xlsx', filaOrigen: 2, reemplazante: 'Ana Pérez', cuil: '20-12345678-6',
  dni: '12345678', categoriaReemplazante: 'A', instrumentoLegal: 'IL-1', periodoDesde: '2025-01-02',
  periodoHasta: '2025-01-31', aPagar: 1234.5, aDeuda: 0, titular: 'Juan Gómez', categoriaTitular: 'B',
  licenciaDesde: '2025-01-02', licenciaHasta: '2025-01-31', cantidadDias: 30, tipoLicenciaExcel: 'Anual',
  agrupamiento: null, funcionTitular: null, tipoLicencia: null, observaciones: null, lugarTrabajo: null,
  fechaCierre: '2026-11-12T18:00:00Z',
}
const page = { content: [row], totalElements: 1, totalPages: 1, number: 0, last: true }
const organizations = [{ id: 5, nombre: 'Hospital Central' }, { id: 6, nombre: 'Hospital Norte' }]

function renderModule(request: Request, global: boolean, organizationId = '') {
  const onError = vi.fn()
  return { onError, ...render(<History token="token" can={() => true} request={request} onError={onError} organizations={organizations} global={global} organizationId={organizationId} />) }
}

describe('History', () => {
  afterEach(() => { cleanup() })

  it('fija la organización de la sesión para usuarios de hospital y oculta el selector', async () => {
    const request = vi.fn(async () => page) as unknown as Request
    renderModule(request, false, '5')
    expect(screen.queryByLabelText('Organización')).toBeNull()
    fireEvent.click(screen.getByText('Buscar'))
    await waitFor(() => expect(vi.mocked(request).mock.calls.some(([, path]) => path.includes('organizacionId=5'))).toBe(true))
    expect(await screen.findByText('Ana Pérez')).toBeTruthy()
  })

  it('permite consultar sin organización a usuarios globales y no envía filtros vacíos', async () => {
    const request = vi.fn(async () => page) as unknown as Request
    renderModule(request, true)
    expect(screen.getByLabelText('Organización')).toBeTruthy()
    fireEvent.click(screen.getByText('Buscar'))
    await waitFor(() => expect(vi.mocked(request).mock.calls.length).toBe(1))
    const path = vi.mocked(request).mock.calls[0][1]
    expect(path).not.toContain('organizacionId')
    expect(path).not.toContain('reemplazante=')
    expect(path).toContain('page=0')
  })

  it('vuelve a page=0 al buscar con filtros y arma la query con los valores cargados', async () => {
    const request = vi.fn(async () => page) as unknown as Request
    renderModule(request, true)
    fireEvent.change(screen.getByLabelText('Reemplazante'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('DNI'), { target: { value: '12.345.678' } })
    fireEvent.change(screen.getByLabelText('Organización'), { target: { value: '6' } })
    fireEvent.click(screen.getByText('Buscar'))
    await waitFor(() => expect(vi.mocked(request).mock.calls.length).toBe(1))
    const path = vi.mocked(request).mock.calls[0][1]
    expect(path).toContain('organizacionId=6')
    expect(path).toContain('reemplazante=Ana')
    expect(path).toContain('dni=12.345.678')
    expect(path).toContain('page=0')
  })

  it('pagina los resultados y muestra los estados de error 400, 403 y 500', async () => {
    const request = vi.fn(async () => ({ ...page, totalPages: 2, last: false })) as unknown as Request
    renderModule(request, true)
    fireEvent.click(screen.getByText('Buscar'))
    fireEvent.click(await screen.findByText('Siguiente'))
    await waitFor(() => expect(vi.mocked(request).mock.calls.some(([, path]) => path.includes('page=1'))).toBe(true))
  })

  it('muestra mensajes específicos para 403, 400 y 500', async () => {
    for (const [status, message] of [[403, 'permiso'], [400, 'organización'], [500, 'servidor']] as const) {
      const request = vi.fn(async () => { throw new ApiError('Error', status) }) as unknown as Request
      const view = renderModule(request, true)
      fireEvent.click(screen.getByText('Buscar'))
      expect(await screen.findByText(new RegExp(message, 'i'))).toBeTruthy()
      view.unmount()
    }
  })

  it('muestra "Sin organización" cuando no hay hospital ni organización', async () => {
    const request = vi.fn(async () => ({ ...page, content: [{ ...row, organizacionId: null, hospitalNombre: null }] })) as unknown as Request
    renderModule(request, true)
    fireEvent.click(screen.getByText('Buscar'))
    expect(await screen.findByText('Sin organización')).toBeTruthy()
  })
})
