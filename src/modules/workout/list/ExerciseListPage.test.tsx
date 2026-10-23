import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as apiModule from '@/lib/api'
import { api, ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type { ExerciseRow } from '../data'
import { ExerciseListPage } from './ExerciseListPage'

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof apiModule>()),
  api: { get: vi.fn(), put: vi.fn() },
}))

vi.mock('@/modules/nutrition/dates', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  todayRome: () => '2026-10-22',
}))

const exercise = (name: string, extra: Partial<ExerciseRow> = {}): ExerciseRow => ({
  name,
  key: name.toLowerCase(),
  image: { catalogId: 'X', source: 'dictionary', url: '/x.jpg' },
  group: 'petto',
  timed: false,
  sets: 10,
  sessions: 4,
  lastDay: '2026-10-21',
  best1RMKg: 80,
  bestDurationSeconds: null,
  trend: [],
  ...extra,
})

const ALL = [
  exercise('Panca piana'),
  exercise('Croci', { group: null }),
  exercise('Esercizio mio', { image: null, group: null, lastDay: '2026-10-22' }),
]

function mockApi(rows: ExerciseRow[] | Error = ALL) {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (rows instanceof Error) throw rows
    const params = new URLSearchParams(path.split('?')[1])
    const q = params.get('q')?.toLowerCase()
    return {
      exercises: rows
        .filter((e) => !q || e.key.includes(q))
        .filter((e) => params.get('incomplete') !== 'true' || !e.group || !e.image),
    }
  })
}

beforeEach(() => {
  vi.mocked(api.get).mockReset()
})

describe('ExerciseListPage', () => {
  it('card con nome, gruppo, ultima volta e link all esercizio', async () => {
    mockApi()
    renderWithProviders(<ExerciseListPage />)
    const list = await screen.findByRole('list', { name: 'Esercizi' })
    const panca = within(list).getByRole('listitem', { name: 'Panca piana' })
    expect(panca).toHaveTextContent('Petto · ieri')
    expect(within(panca).getByRole('link')).toHaveAttribute('href', '/allenamenti/esercizi/panca%20piana')
    expect(within(panca).queryByText('Senza gruppo')).not.toBeInTheDocument()
    const mio = within(list).getByRole('listitem', { name: 'Esercizio mio' })
    expect(mio).toHaveTextContent('Non assegnato · oggi')
    expect(within(mio).getByRole('button', { name: 'Assegna il gruppo a Esercizio mio' })).toBeInTheDocument()
    expect(within(mio).getByRole('button', { name: 'Scegli immagine per Esercizio mio' })).toBeInTheDocument()
  })

  it('cerca per nome e filtra quelli da completare', async () => {
    mockApi()
    renderWithProviders(<ExerciseListPage />)
    await screen.findByRole('list', { name: 'Esercizi' })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Cerca esercizi' }), { target: { value: 'croc' } })
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/workout/exercises?q=croc'))
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1))

    fireEvent.change(screen.getByRole('searchbox', { name: 'Cerca esercizi' }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Da completare' }))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/workout/exercises?incomplete=true'))
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2))
  })

  it('il gruppo si assegna dalla card', async () => {
    mockApi()
    vi.mocked(api.put).mockResolvedValue({ name: 'croci', group: 'petto' })
    renderWithProviders(<ExerciseListPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Assegna il gruppo a Croci' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('radio', { name: 'Petto' }))
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/workout/exercises/Croci/group', { group: 'petto' }),
    )
  })

  it('senza nulla da completare lo dice', async () => {
    mockApi([exercise('Panca piana')])
    renderWithProviders(<ExerciseListPage />)
    await screen.findByRole('list', { name: 'Esercizi' })
    fireEvent.click(screen.getByRole('radio', { name: 'Da completare' }))
    expect(await screen.findByText('Tutti gli esercizi hanno gruppo e immagine.')).toBeInTheDocument()
  })

  it('con il backend in errore lo dice', async () => {
    mockApi(new ApiError('database_unavailable', 'Database non raggiungibile', 503))
    renderWithProviders(<ExerciseListPage />)
    expect(await screen.findByText('Database non raggiungibile')).toBeInTheDocument()
  })
})
