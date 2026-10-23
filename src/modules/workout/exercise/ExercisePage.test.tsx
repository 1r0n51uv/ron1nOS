import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as apiModule from '@/lib/api'
import { api, ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type { ExerciseDetail } from '../data'
import { ExercisePage } from './ExercisePage'

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof apiModule>()),
  api: { get: vi.fn(), put: vi.fn() },
}))

const point = (day: string, best1RMKg: number, volumeKg: number) => ({
  sessionId: `s-${day}`,
  day,
  best1RMKg,
  volumeKg,
  bestDurationSeconds: 0,
  totalDurationSeconds: 0,
})

const PANCA: ExerciseDetail = {
  name: 'Panca piana',
  key: 'panca piana',
  image: { catalogId: 'X', source: 'dictionary', url: '/x.jpg' },
  group: 'petto',
  timed: false,
  best1RMKg: 100,
  heaviestKg: 92.5,
  bestDurationSeconds: null,
  sessions: 24,
  range: '6m',
  points: [point('2026-09-01', 76, 480), point('2026-10-01', 81.7, 630), point('2026-10-20', 79.8, 217.5)],
  recent: [
    {
      sessionId: 's-2026-10-20',
      day: '2026-10-20',
      best1RMKg: 79.75,
      sets: [
        { warmup: true, weightKg: 40, reps: 10, durationSeconds: null },
        { warmup: false, weightKg: 72.5, reps: 3, durationSeconds: null },
      ],
    },
  ],
}

function render(detail: ExerciseDetail | Error = PANCA) {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (detail instanceof Error) throw detail
    const range = new URLSearchParams(path.split('?')[1]).get('range')
    return { ...detail, range }
  })
  return renderWithProviders(
    <Routes>
      <Route path="/allenamenti/esercizi/:name" element={<ExercisePage />} />
    </Routes>,
    { route: '/allenamenti/esercizi/panca%20piana' },
  )
}

beforeEach(() => {
  vi.mocked(api.get).mockReset()
})

describe('ExercisePage', () => {
  it('testata con foto, gruppo e tre numeri', async () => {
    render()
    expect(await screen.findByRole('heading', { name: 'Panca piana' })).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/workout/exercises/panca%20piana?range=6m')
    expect(screen.getByText('Petto')).toBeInTheDocument()
    expect(screen.getByText('100 kg')).toBeInTheDocument()
    expect(screen.getByText('92,5 kg')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
  })

  it('un grafico per volta, con selettore e periodo', async () => {
    render()
    expect(
      await screen.findByRole('img', { name: '1RM stimato: da 76 kg a 80 kg, massimo 82 kg' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Volume' }))
    expect(
      screen.getByRole('img', { name: 'Volume: da 480 kg a 218 kg, massimo 630 kg' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: '1 anno' }))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/workout/exercises/panca%20piana?range=1y'))
    expect(screen.getByRole('radio', { name: '1 anno' })).toHaveAttribute('aria-checked', 'true')
  })

  it('le ultime volte senza riscaldamento, con link alla sessione', async () => {
    render()
    const recent = await screen.findByRole('region', { name: 'Ultime volte' })
    const link = within(recent).getByRole('link')
    expect(link).toHaveAttribute('href', '/allenamenti/sessioni/s-2026-10-20')
    expect(link).toHaveTextContent('72,5 × 3')
    expect(link).not.toHaveTextContent('40 × 10')
    expect(link).toHaveTextContent('80 kg')
  })

  it('per un esercizio a tempo durate al posto dei kg', async () => {
    render({
      ...PANCA,
      name: 'Plank',
      group: null,
      timed: true,
      best1RMKg: null,
      heaviestKg: null,
      bestDurationSeconds: 90,
      points: [{ ...point('2026-10-01', 0, 0), bestDurationSeconds: 60, totalDurationSeconds: 150 }],
      recent: [],
    })
    expect(await screen.findByText('Non assegnato')).toBeInTheDocument()
    expect(screen.getByText('1:30')).toBeInTheDocument()
    expect(screen.queryByText('peso più alto')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Durata totale' }))
    expect(
      screen.getByRole('img', { name: 'Durata totale: da 2:30 a 2:30, massimo 2:30' }),
    ).toBeInTheDocument()
  })

  it('il gruppo si sceglie dal dialog e si salva per il nome (GYM-011)', async () => {
    render()
    vi.mocked(api.put).mockResolvedValue({ name: 'panca piana', group: 'spalle' })
    fireEvent.click(await screen.findByRole('button', { name: 'Gruppo · Petto' }))
    const dialog = await screen.findByRole('dialog', { name: 'Gruppo muscolare' })
    expect(within(dialog).getByRole('radio', { name: 'Petto' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Spalle' }))
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/workout/exercises/Panca%20piana/group', { group: 'spalle' }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('se il gruppo non si salva il dialog resta aperto con l errore', async () => {
    render({ ...PANCA, group: null })
    vi.mocked(api.put).mockRejectedValue(new ApiError('internal', 'Errore del server', 500))
    fireEvent.click(await screen.findByRole('button', { name: 'Assegna il gruppo' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('radio', { name: 'Gambe' }))
    expect(await screen.findByText('Gruppo non salvato.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('un nome sconosciuto mostra l errore', async () => {
    render(new ApiError('not_found', 'Esercizio non trovato', 404))
    expect(await screen.findByText('Esercizio non trovato')).toBeInTheDocument()
  })
})
