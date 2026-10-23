import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as apiModule from '@/lib/api'
import { api, ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type { WorkoutSummary } from '../data'
import { WorkoutPage } from './WorkoutPage'

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof apiModule>()),
  api: { get: vi.fn(), post: vi.fn() },
}))

const weeks = (counts: number[]) =>
  counts.map((count, i) => ({
    monday: `2026-${String(5 + Math.floor(i / 4)).padStart(2, '0')}-0${(i % 4) + 1}`,
    count,
  }))

const SUMMARY: WorkoutSummary = {
  today: '2026-10-22',
  last: {
    id: 's1',
    day: '2026-10-21',
    routine: 'Push',
    startedAt: '2026-10-21T16:00:00Z',
    durationSeconds: 3600,
    exercise: null,
  },
  thisWeek: 3,
  streakDays: 1,
  weeks: weeks([...Array(25).fill(2), 3]),
}

beforeEach(() => {
  vi.mocked(api.get).mockReset()
})

describe('WorkoutPage', () => {
  it('mostra costanza e allenamenti per settimana con la media', async () => {
    vi.mocked(api.get).mockResolvedValue(SUMMARY)
    renderWithProviders(<WorkoutPage />)
    expect(await screen.findByText('3 allenamenti questa settimana · 1 giorno di fila')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /questa settimana 3 allenamenti, media 2,0$/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('media 2,0 a settimana')).toBeInTheDocument()
  })

  it('senza allenamenti mostra solo l invito a importare', async () => {
    vi.mocked(api.get).mockResolvedValue({ ...SUMMARY, last: null, thisWeek: 0, streakDays: 0 })
    renderWithProviders(<WorkoutPage />)
    expect(
      await screen.findByText('Importa il CSV esportato da Liftin’ per vedere qui i tuoi allenamenti.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/questa settimana ·/)).not.toBeInTheDocument()
  })

  it('con il backend in errore lo dice', async () => {
    vi.mocked(api.get).mockRejectedValue(
      new ApiError('database_unavailable', 'Database non raggiungibile', 503),
    )
    renderWithProviders(<WorkoutPage />)
    expect(await screen.findByText('Database non raggiungibile')).toBeInTheDocument()
  })
})
