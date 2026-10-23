import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as apiModule from '@/lib/api'
import { api } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type { SessionDetail } from '../data'
import { SessionPage } from './SessionPage'

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof apiModule>()),
  api: { get: vi.fn(), delete: vi.fn() },
}))

const SESSION: SessionDetail = {
  id: 's1',
  day: '2026-10-20',
  routine: 'Push',
  startedAt: '2026-10-20T16:00:00Z',
  durationSeconds: 3900,
  volumeKg: 1103,
  exercises: [
    {
      name: 'Panca piana',
      key: 'panca piana',
      image: { catalogId: 'X', source: 'dictionary', url: '/x.jpg' },
      timed: false,
      volumeKg: 935,
      record: true,
      sets: [
        { index: 1, warmup: true, weightKg: 40, reps: 10, durationSeconds: null },
        { index: 2, warmup: false, weightKg: 85, reps: 6, durationSeconds: null },
      ],
    },
    {
      name: 'Croci',
      key: 'croci',
      image: null,
      timed: false,
      volumeKg: 168,
      record: false,
      sets: [{ index: 1, warmup: false, weightKg: 14, reps: 12, durationSeconds: null }],
    },
    {
      name: 'Plank',
      key: 'plank',
      image: null,
      timed: true,
      volumeKg: 0,
      record: false,
      sets: [{ index: 1, warmup: false, weightKg: 0, reps: null, durationSeconds: 75 }],
    },
  ],
}

function render() {
  return renderWithProviders(
    <Routes>
      <Route path="/allenamenti/sessioni/:id" element={<SessionPage />} />
      <Route path="/allenamenti" element={<div>Pagina allenamenti</div>} />
    </Routes>,
    { route: '/allenamenti/sessioni/s1' },
  )
}

beforeEach(() => {
  vi.mocked(api.get).mockReset().mockResolvedValue(SESSION)
  vi.mocked(api.delete).mockReset().mockResolvedValue(undefined)
})

describe('SessionPage', () => {
  it('mostra testata, volume per esercizio e le serie', async () => {
    render()
    expect(await screen.findByRole('heading', { name: 'Push', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/· 18:00 · 1 h 05 min · 1103 kg$/)).toBeInTheDocument()
    const bars = screen.getByRole('region', { name: 'Volume per esercizio' })
    expect(within(bars).getAllByRole('listitem')).toHaveLength(2)
    const panca = screen.getByRole('listitem', { name: 'Panca piana' })
    expect(within(panca).getByText('Record')).toBeInTheDocument()
    expect(within(panca).getByText('40 × 10')).toHaveAttribute('title', 'Riscaldamento')
    expect(within(screen.getByRole('listitem', { name: 'Plank' })).getByText('1:15')).toBeInTheDocument()
    expect(
      within(screen.getByRole('listitem', { name: 'Croci' })).queryByText('Record'),
    ).not.toBeInTheDocument()
  })

  it('Elimina sessione chiede conferma e torna alla pagina', async () => {
    render()
    fireEvent.click(await screen.findByRole('button', { name: 'Elimina sessione' }))
    fireEvent.click(screen.getByRole('button', { name: 'Elimina' }))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/workout/sessions/s1'))
    expect(await screen.findByText('Pagina allenamenti')).toBeInTheDocument()
  })
})
