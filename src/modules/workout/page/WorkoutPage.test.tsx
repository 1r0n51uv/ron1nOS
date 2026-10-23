import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as apiModule from '@/lib/api'
import { api, ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type { SessionRow, WorkoutSummary } from '../data'
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

const SESSIONS: SessionRow[] = Array.from({ length: 20 }, (_, i) => ({
  id: `s${i}`,
  day: i === 0 ? '2026-10-22' : '2026-10-01',
  routine: i % 2 ? 'Gambe' : 'Push',
  startedAt: '2026-10-01T16:00:00Z',
  durationSeconds: 2700,
  exercises: [
    { name: `Panca ${i}`, image: { catalogId: 'X', source: 'dictionary', url: '/x.jpg' } },
    { name: `Mio ${i}`, image: null },
  ],
}))

function mockApi(summary: WorkoutSummary) {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/workout/summary') return summary
    if (path === '/workout/routines') return { routines: ['Push', 'Gambe'] }
    if (path.startsWith('/workout/sessions?cursor='))
      return { sessions: [{ ...SESSIONS[1]!, id: 'ultima' }], nextCursor: null }
    if (path.startsWith('/workout/sessions')) return { sessions: SESSIONS, nextCursor: 'c2' }
    throw new Error(path)
  })
}

beforeEach(() => {
  vi.mocked(api.get).mockReset()
})

describe('WorkoutPage', () => {
  it('mostra costanza e allenamenti per settimana con la media', async () => {
    mockApi(SUMMARY)
    renderWithProviders(<WorkoutPage />)
    expect(await screen.findByText('3 allenamenti questa settimana · 1 giorno di fila')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /questa settimana 3 allenamenti, media 2,0$/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('media 2,0 a settimana')).toBeInTheDocument()
  })

  it('mostra lo storico a pagine e filtra per routine', async () => {
    mockApi(SUMMARY)
    renderWithProviders(<WorkoutPage />)
    const list = await screen.findByRole('list', { name: 'Sessioni' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(20)
    expect(within(list).getAllByText('oggi · 45 min')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Altre sessioni' }))
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(21))
    expect(screen.queryByRole('button', { name: 'Altre sessioni' })).not.toBeInTheDocument()

    fireEvent.click(await screen.findByRole('radio', { name: 'Gambe' }))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/workout/sessions?routine=Gambe'))
    expect(screen.getByRole('radio', { name: 'Gambe' })).toHaveAttribute('aria-checked', 'true')
  })

  it('senza allenamenti mostra solo l invito a importare', async () => {
    mockApi({ ...SUMMARY, last: null, thisWeek: 0, streakDays: 0 })
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
