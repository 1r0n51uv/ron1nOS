import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as apiModule from '@/lib/api'
import { api, ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type { ExerciseRow, RecentRecord, SessionRow, WorkoutSummary } from '../data'
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

const exercise = (name: string, extra: Partial<ExerciseRow> = {}): ExerciseRow => ({
  name,
  key: name.toLowerCase(),
  image: { catalogId: 'X', source: 'dictionary', url: '/x.jpg' },
  group: null,
  timed: false,
  sets: 10,
  sessions: 4,
  lastDay: '2026-10-21',
  best1RMKg: 76.4,
  bestDurationSeconds: null,
  trend: [70, 72, 76.4],
  ...extra,
})

const EXERCISES: ExerciseRow[] = [
  exercise('Panca piana'),
  exercise('Squat', { best1RMKg: 120, trend: [120] }),
  exercise('Plank', { timed: true, best1RMKg: null, bestDurationSeconds: 90, trend: [60, 90], image: null }),
  exercise('Croci'),
  exercise('Stacco'),
  exercise('Lat machine'),
]

const RECORDS: RecentRecord[] = [
  {
    kind: 'e1rm',
    value: 81.7,
    weightKg: null,
    day: '2026-10-21',
    sessionId: 's1',
    exercise: { name: 'Panca piana', key: 'panca piana', image: null },
  },
  {
    kind: 'reps',
    value: 10,
    weightKg: 60,
    day: '2026-10-15',
    sessionId: 's2',
    exercise: { name: 'Squat', key: 'squat', image: null },
  },
]

const GROUPS = {
  groups: ['petto', 'gambe', null],
  weeks: [
    ...Array.from({ length: 11 }, (_, i) => ({
      monday: `2026-08-${String(3 + i).padStart(2, '0')}`,
      groups: [],
    })),
    {
      monday: '2026-10-19',
      groups: [
        { group: 'petto', volumeKg: 480, sets: 1 },
        { group: 'gambe', volumeKg: 270, sets: 2 },
        { group: null, volumeKg: 100, sets: 1 },
      ],
    },
  ],
}

function mockApi(summary: WorkoutSummary, exercises: ExerciseRow[] | Error = EXERCISES) {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/workout/summary') return summary
    if (path === '/workout/records') return { records: RECORDS }
    if (path === '/workout/muscle-groups') return GROUPS
    if (path === '/workout/exercises?sort=sets&limit=6') {
      if (exercises instanceof Error) throw exercises
      return { exercises }
    }
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
    expect(screen.getByRole('link', { name: 'Tutti gli esercizi' })).toHaveAttribute(
      'href',
      '/allenamenti/esercizi',
    )
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

  it('mostra i 6 esercizi più allenati con migliore e andamento (GYM-007)', async () => {
    mockApi(SUMMARY)
    renderWithProviders(<WorkoutPage />)
    const list = await screen.findByRole('list', { name: 'Esercizi più allenati' })
    const cards = within(list).getAllByRole('link')
    expect(cards).toHaveLength(6)
    expect(cards[0]).toHaveAttribute('href', '/allenamenti/esercizi/panca%20piana')
    expect(cards[0]).toHaveTextContent('Panca piana76 kg1RM stimato')
    expect(within(cards[0]!).getByRole('img', { name: 'Andamento Panca piana' })).toBeInTheDocument()
    // Una sola sessione: niente sparkline.
    expect(within(cards[1]!).queryByRole('img', { name: 'Andamento Squat' })).not.toBeInTheDocument()
    expect(cards[2]).toHaveTextContent('Plank1:30durata migliore')
  })

  it('mostra i nuovi record con link alla sessione (GYM-010)', async () => {
    mockApi(SUMMARY)
    renderWithProviders(<WorkoutPage />)
    const records = await screen.findByRole('region', { name: 'Nuovi record' })
    const links = await within(records).findAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual([
      'Panca piana1RM stimato · 82 kgieri',
      'SquatPiù ripetizioni a 60 kg · 10giovedì 15 ottobre',
    ])
    expect(links[0]).toHaveAttribute('href', '/allenamenti/sessioni/s1')
  })

  it('mostra il volume per gruppo con la legenda e passa alle serie (GYM-012)', async () => {
    mockApi(SUMMARY)
    renderWithProviders(<WorkoutPage />)
    const groups = await screen.findByRole('region', { name: 'Gruppi muscolari' })
    expect(within(groups).getByRole('img', { name: /questa settimana 850 kg$/ })).toBeInTheDocument()
    const legend = within(groups).getByRole('list', { name: 'Legenda' })
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((l) => l.textContent),
    ).toEqual(['Petto', 'Gambe', 'Non assegnato'])
    fireEvent.click(within(groups).getByRole('radio', { name: 'Serie' }))
    expect(within(groups).getByRole('img', { name: /questa settimana 4 serie$/ })).toBeInTheDocument()
  })

  it('se gli esercizi non arrivano lo dice solo nella loro sezione', async () => {
    mockApi(SUMMARY, new ApiError('internal', 'Errore del server', 500))
    renderWithProviders(<WorkoutPage />)
    expect(await screen.findByText('Esercizi non disponibili.')).toBeInTheDocument()
    expect(await screen.findByRole('list', { name: 'Sessioni' })).toBeInTheDocument()
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
    // Ogni sezione dice il suo errore: costanza, esercizi, record, gruppi e storico.
    await waitFor(() => expect(screen.getAllByText('Database non raggiungibile')).toHaveLength(5))
    expect(screen.getByText('Allenamenti non disponibili.')).toBeInTheDocument()
    expect(screen.getByText('Storico non disponibile.')).toBeInTheDocument()
  })

  it('se il riepilogo non arriva le altre sezioni restano (GYM-002)', async () => {
    mockApi(SUMMARY)
    const ok = vi.mocked(api.get).getMockImplementation()!
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path === '/workout/summary') throw new ApiError('internal', 'Errore del server', 500)
      return ok(path)
    })
    renderWithProviders(<WorkoutPage />)
    expect(await screen.findByText('Allenamenti non disponibili.')).toBeInTheDocument()
    expect(await screen.findByRole('list', { name: 'Sessioni' })).toBeInTheDocument()
    expect(await screen.findByRole('list', { name: 'Esercizi più allenati' })).toBeInTheDocument()
    expect(screen.queryByText('questa settimana ·')).not.toBeInTheDocument()
  })
})
