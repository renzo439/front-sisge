import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PersonalSurvey from './PersonalSurvey'

const summary = { id: 15, organizacionId: 1, organizacionNombre: 'Hospital Central', archivoOrigen: 'personal.xlsx', estado: 'EN_REVISION', fechaCreacion: '2026-01-01', cantidadFilas: 2, cantidadFilasConError: 1 }
const organizations = [{ id: 1, nombre: 'Hospital Central', udeo: 'HOSP-CENTRAL' }]
const detail = { ...summary, filas: [
  { id: 10, filaOrigen: 2, dni: '30111222', cuil: '20301112229', apellido: 'Pérez', nombres: 'Ana', organizacionId: 1, organizacionNombre: 'Hospital Central', sectorNombre: 'Guardia', fechaInicio: '2020-01-01', revisada: false, errores: '' },
  { id: 11, filaOrigen: 3, dni: '30222333', apellido: 'Gómez', nombres: 'Luis', organizacionId: 1, organizacionNombre: 'Hospital Central', sectorNombre: 'Clínica', fechaInicio: '2020-01-01', revisada: true, errores: 'CUIL inválido' },
] }
type Request = <T>(token: string, path: string, init?: RequestInit) => Promise<T>

function renderModule(request: Request, permissions = ['PERSONAL_IMPORTAR', 'PERSONAL_REVISAR', 'PERSONAL_VALIDAR', 'PERSONAL_APROBAR', 'PERSONAL_CONSOLIDAR']) {
  const onError = vi.fn()
  return { onError, ...render(<PersonalSurvey token="token" can={permission => permissions.includes(permission)} request={request} onError={onError} />) }
}

describe('PersonalSurvey', () => {
  afterEach(() => { cleanup(); localStorage.clear() })

  it('carga un Excel y abre el detalle creado', async () => {
    const request = vi.fn(async (_token: string, path: string) => path.includes('?size') ? [] : path === '/api/v1/organizaciones' ? organizations : detail) as unknown as Request
    renderModule(request)
    await screen.findByText('No hay importaciones de personal disponibles.')
    fireEvent.click(screen.getByText('Nueva importación'))
    fireEvent.change(screen.getByLabelText('Organización'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Archivo Excel'), { target: { files: [new File(['datos'], 'personal.xlsx')] } })
    fireEvent.submit(screen.getByText('Cargar Excel').closest('form')!)
    await screen.findByText('Acciones administrativas')
    expect(vi.mocked(request).mock.calls.some(([, path]) => path === '/api/v1/organizaciones/1/personal/importaciones')).toBe(true)
  })

  it('filtra filas y actualiza solamente la fila revisada', async () => {
    const updated = { ...detail.filas[0], revisada: true, nombres: 'Ana María' }
    const request = vi.fn(async (_token: string, path: string) => path.includes('?size') ? { content: [summary] } : path === '/api/v1/organizaciones' ? organizations : path.endsWith('/15') ? detail : updated) as unknown as Request
    renderModule(request)
    fireEvent.click(await screen.findByText('Abrir'))
    await screen.findByText('Pérez')
    fireEvent.change(screen.getByPlaceholderText('DNI, CUIL, apellido o nombres'), { target: { value: 'Pérez' } })
    expect(screen.queryByText('Gómez')).toBeNull()
    fireEvent.click(screen.getByText('Revisar'))
    fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Ana María' } })
    fireEvent.click(screen.getByText('Guardar revisión'))
    await screen.findByText('Ana María')
    expect(vi.mocked(request).mock.calls.some(([, path]) => path.endsWith('/filas/10'))).toBe(true)
  })

  it('ejecuta validación, aprobación y consolidación con confirmación', async () => {
    const ready = { ...detail, filas: detail.filas.map(row => ({ ...row, revisada: true, errores: '' })) }
    const request = vi.fn(async (_token: string, path: string) => {
      if (path.includes('?size')) return { content: [summary] }
      if (path === '/api/v1/organizaciones') return organizations
      if (path.endsWith('/15')) return ready
      if (path.endsWith('/validar')) return { personasNuevas: 1, filasInvalidas: 0, erroresBloqueantes: false }
      if (path.endsWith('/aprobar')) return { ...ready, estado: 'APROBADA' }
      return { creados: 1, actualizados: 1, errores: 0 }
    }) as unknown as Request
    renderModule(request)
    fireEvent.click(await screen.findByText('Abrir'))
    fireEvent.click(await screen.findByText('Validar importación'))
    await screen.findByText('Resultado de la validación')
    fireEvent.click(screen.getByText('Aprobar importación'))
    fireEvent.click(screen.getByText('Confirmar'))
    await waitFor(() => expect(vi.mocked(request).mock.calls.some(([, path]) => path.endsWith('/aprobar'))).toBe(true))
    fireEvent.click(screen.getByText('Consolidar'))
    fireEvent.click(screen.getByText('Confirmar'))
    await waitFor(() => expect(vi.mocked(request).mock.calls.some(([, path]) => path.endsWith('/consolidar'))).toBe(true))
  })

  it('informa los errores de la API al validar', async () => {
    const request = vi.fn(async (_token: string, path: string) => {
      if (path.includes('?size')) return { content: [summary] }
      if (path === '/api/v1/organizaciones') return organizations
      if (path.endsWith('/15')) return detail
      throw new Error('No autorizado para validar')
    }) as unknown as Request
    const { onError } = renderModule(request)
    fireEvent.click(await screen.findByText('Abrir'))
    fireEvent.click(await screen.findByText('Validar importación'))
    await waitFor(() => expect(onError).toHaveBeenCalledWith('No autorizado para validar'))
  })
})
