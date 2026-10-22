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
  it('solo il campo password e il marchio; Accedi spento finché è vuoto', () => {
    show()
    expect(screen.getByRole('heading', { name: 'ron1nOS' })).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Accedi' })).toBeDisabled()
  })

  it('invia la password', () => {
    show()
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'segreta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Accedi' }))
    expect(mutate).toHaveBeenCalledWith('segreta', expect.anything())
  })

  it('password sbagliata: il messaggio del backend, senza altro', () => {
    show('/login', { error: new ApiError('invalid_password', 'Password non valida', 401) })
    expect(screen.getByRole('alert')).toHaveTextContent('Password non valida')
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true')
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
