import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import History from './History'
import { ApiError } from './services/http'

type Request = <T>(token: string, path: string, init?: RequestInit) => Promise<T>

const row = {
  id: 1, organizacionId: 5, hospitalNombre: 'Hospital Central', udeo: '6118', importacionId: 10, archivoOrigen: 'x.xlsx', filaOrigen: 1,
  reemplazante: 'Ana Pérez', cuil: '20-12345678-9', dni: '12345678', categoriaReemplazante: 'A', instrumentoLegal: 'IL-1', periodoDesde: '2025-01-02',
  periodoHasta: '2025-01-10', aPagar: 100, aDeuda: 0, titular: 'Juan López', categoriaTitular: 'B', licenciaDesde: '2025-01-01',
  licenciaHasta: '2025-01-10', cantidadDias: 10, tipoLicenciaExcel: 'L', agrupamiento: 'G1', funcionTitular: 'F', tipoLicencia: 'TL',
  observaciones: '', lugarTrabajo: 'Sala', fechaCierre: null,
}
const page = { content: [row], totalElements: 1, totalPages: 1, number: 0, last: true }
const organizations = [{ id: 5, nombre: 'Hospital Central', udeo: '6118' }]

function renderModule(request: Request, global = true, organizationId = '') {
  const onError = vi.fn()
  return { onError, ...render(<History token="token" request={request} onError={onError} organizations={organizations} global={global} organizationId={organizationId} />) }
}

describe('History', () => {
  afterEach(() => { cleanup() })

  it('fija la organización permitida para usuarios no globales y oculta el selector', async () => {
    const request = vi.fn(async () => page) as unknown as Request
    renderModule(request, false, '5')
    expect(screen.queryByLabelText('Organización')).toBeNull()
    fireEvent.click(screen.getByText('Buscar'))
    await waitFor(() => expect(vi.mocked(request).mock.calls.some(([, path]) => path.includes('organizacionId=5'))).toBe(true))
    expect(await screen.findByText('Ana Pérez')).toBeTruthy()
  })

  it('requiere seleccionar organización para usuario global antes de consultar', async () => {
    const request = vi.fn(async () => page) as unknown as Request
    renderModule(request, true)
    fireEvent.click(screen.getByText('Buscar'))
    expect(await screen.findByText(/Seleccioná una organización/i)).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('envía filtros activos a la API para usuario global con organización', async () => {
    const request = vi.fn(async () => page) as unknown as Request
    renderModule(request, true, '5')
    fireEvent.change(screen.getByLabelText('Reemplazante'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('DNI'), { target: { value: '1234' } })
    fireEvent.change(screen.getByLabelText('Titular'), { target: { value: 'Juan' } })
    fireEvent.change(screen.getByLabelText('UDEO'), { target: { value: '6118' } })
    fireEvent.change(screen.getByLabelText('Período reemplazo desde'), { target: { value: '2025-01-01' } })
    fireEvent.change(screen.getByLabelText('Período reemplazo hasta'), { target: { value: '2025-01-31' } })
    fireEvent.click(screen.getByText('Buscar'))
    await waitFor(() => expect(request).toHaveBeenCalled())
    const [, path] = vi.mocked(request).mock.calls[0]
    expect(path).toContain('organizacionId=5')
    expect(path).toContain('reemplazante=Ana')
    expect(path).toContain('cuil=1234')
    expect(path).toContain('titular=Juan')
    expect(path).toContain('udeo=6118')
    expect(path).toContain('periodoDesde=2025-01-01')
    expect(path).toContain('periodoHasta=2025-01-31')
  })

  it('renderiza los filtros de período', () => {
    const request = vi.fn(async () => page) as unknown as Request
    renderModule(request, true)
    expect(screen.getByLabelText('Período reemplazo desde')).toBeTruthy()
    expect(screen.getByLabelText('Período reemplazo hasta')).toBeTruthy()
  })

  it('pagina los resultados', async () => {
    const request = vi.fn(async () => ({ ...page, totalPages: 2, last: false })) as unknown as Request
    renderModule(request, true, '5')
    fireEvent.click(screen.getByText('Buscar'))
    fireEvent.click(await screen.findByText('Siguiente'))
    await waitFor(() => expect(vi.mocked(request).mock.calls.some(([, path]) => path.includes('page=1'))).toBe(true))
  })

  it('muestra mensajes específicos para 403, 400 y 500', async () => {
    for (const [status, message] of [[403, 'Sin permiso'], [400, 'organizaci'], [500, 'servidor']] as const) {
      const request = vi.fn(async () => { throw new ApiError('Error', status) }) as unknown as Request
      const view = renderModule(request, true, '5')
      fireEvent.click(screen.getByText('Buscar'))
      expect((await screen.findAllByText(new RegExp(message, 'i'))).length).toBeGreaterThan(0)
      view.unmount()
    }
  })

  it('muestra "Sin organización" cuando no hay hospital ni organización', async () => {
    const request = vi.fn(async () => ({ ...page, content: [{ ...row, organizacionId: null, hospitalNombre: null }] })) as unknown as Request
    renderModule(request, true, '5')
    fireEvent.click(screen.getByText('Buscar'))
    expect((await screen.findAllByText('Sin organización')).length).toBeGreaterThan(0)
  })

  it('usa el nombre de la organización cuando hospitalNombre viene vacío', async () => {
    const request = vi.fn(async () => ({ ...page, content: [{ ...row, organizacionId: 5, hospitalNombre: null }] })) as unknown as Request
    renderModule(request, true, '5')
    fireEvent.click(screen.getByText('Buscar'))
    expect((await screen.findAllByText('Hospital Central')).length).toBeGreaterThan(0)
  })

  it('usa la UDEO de la organización cuando row.udeo viene vacío', async () => {
    const request = vi.fn(async () => ({ ...page, content: [{ ...row, organizacionId: 5, udeo: null }] })) as unknown as Request
    renderModule(request, true, '5')
    fireEvent.click(screen.getByText('Buscar'))
    expect(await screen.findByText('6118')).toBeTruthy()
  })
})

