import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router'

import { ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type * as data from './data'
import { safeNext, useLogin, useMe } from './data'
import { LoginPage } from './LoginPage'

vi.mock('./data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useMe: vi.fn(),
  useLogin: vi.fn(),
}))

const mutate = vi.fn()
const login = (extra = {}) => ({ mutate, isPending: false, error: null, ...extra }) as never

function show(route = '/login', extra = {}) {
  vi.mocked(useLogin).mockReturnValue(login(extra))
  renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<div>Pagina richiesta</div>} />
    </Routes>,
    { route },
  )
}

beforeEach(() => {
  mutate.mockReset()
  vi.mocked(useMe).mockReturnValue({
    data: undefined,
    error: new ApiError('unauthenticated', 'x', 401),
  } as never)
})

describe('LoginPage (AUTH-001)', () => {
  it('solo il campo del codice e il marchio; Accedi spento finché non sono 4 cifre', () => {
    show()
    expect(screen.getByRole('heading', { name: 'ron1nOS' })).toBeInTheDocument()
    const field = screen.getByLabelText('Codice')
    expect(field).toHaveAttribute('type', 'password')
    expect(field).toHaveAttribute('inputmode', 'numeric')
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Accedi' })).toBeDisabled()
    fireEvent.change(field, { target: { value: '12' } })
    expect(screen.getByRole('button', { name: 'Accedi' })).toBeDisabled()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('alla quarta cifra invia il codice, tenendo solo le cifre', () => {
    show()
    fireEvent.change(screen.getByLabelText('Codice'), { target: { value: '4a8-27x9' } })
    expect(screen.getByLabelText('Codice')).toHaveValue('4827')
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate).toHaveBeenCalledWith('4827', expect.anything())
  })

  it('Accedi invia il codice se non è già partito', () => {
    show()
    fireEvent.change(screen.getByLabelText('Codice'), { target: { value: '1234' } })
    mutate.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Accedi' }))
    expect(mutate).toHaveBeenCalledWith('1234', expect.anything())
  })

  it('codice sbagliato: il messaggio del backend, senza altro', () => {
    show('/login', { error: new ApiError('invalid_password', 'Codice non valido', 401) })
    expect(screen.getByRole('alert')).toHaveTextContent('Codice non valido')
    expect(screen.getByLabelText('Codice')).toHaveAttribute('aria-invalid', 'true')
  })

  it('già dentro: torna alla pagina richiesta', () => {
    vi.mocked(useMe).mockReturnValue({ data: { enabled: true }, error: null } as never)
    show('/login?next=%2Fpasti')
    expect(screen.getByText('Pagina richiesta')).toBeInTheDocument()
  })
})

describe('safeNext', () => {
  it('accetta solo percorsi interni', () => {
    expect(safeNext('/pasti?d=1')).toBe('/pasti?d=1')
    expect(safeNext(null)).toBe('/')
    expect(safeNext('//evil.example')).toBe('/')
    expect(safeNext('https://evil.example')).toBe('/')
    expect(safeNext('/login')).toBe('/')
  })
})
