import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Route, Routes, useLocation } from 'react-router'

import { ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type * as data from './data'
import { useMe } from './data'
import { RequireAuth } from './RequireAuth'

vi.mock('./data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useMe: vi.fn(),
}))

function Where() {
  const location = useLocation()
  return <div>login {location.search}</div>
}

function show(me: unknown, route = '/pasti') {
  vi.mocked(useMe).mockReturnValue(me as never)
  renderWithProviders(
    <Routes>
      <Route path="/login" element={<Where />} />
      <Route element={<RequireAuth />}>
        <Route path="*" element={<div>contenuto</div>} />
      </Route>
    </Routes>,
    { route },
  )
}

describe('RequireAuth (AUTH-001)', () => {
  it('senza sessione porta al login ricordando la pagina', () => {
    show({ error: new ApiError('unauthenticated', 'Accesso richiesto', 401), isPending: false })
    expect(screen.getByText('login ?next=%2Fpasti')).toBeInTheDocument()
  })

  it('con la sessione mostra la pagina', () => {
    show({ data: { enabled: true }, error: null, isPending: false })
    expect(screen.getByText('contenuto')).toBeInTheDocument()
  })

  it('backend spento: mostra la dashboard, i widget diranno il loro errore', () => {
    show({ error: new ApiError('network', 'Backend non raggiungibile', 0), isPending: false })
    expect(screen.getByText('contenuto')).toBeInTheDocument()
  })
})
