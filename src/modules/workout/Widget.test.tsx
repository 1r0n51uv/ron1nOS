import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as apiModule from '@/lib/api'
import { api } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import type { WorkoutSummary } from './data'
import { WorkoutWidget } from './Widget'

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof apiModule>()),
  api: { get: vi.fn() },
}))

const weeks = Array.from({ length: 26 }, (_, i) => ({ monday: `w${i}`, count: i % 3 }))

const SUMMARY: WorkoutSummary = {
  today: '2026-10-22',
  last: {
    id: 's1',
    day: '2026-10-21',
    routine: 'Push',
    startedAt: '2026-10-21T16:00:00Z',
    durationSeconds: 3900,
    exercise: {
      name: 'Panca piana',
      image: {
        catalogId: 'Barbell_Bench_Press_-_Medium_Grip',
        source: 'dictionary',
        url: '/api/v1/workout/catalog/images/Barbell_Bench_Press_-_Medium_Grip/0.jpg',
      },
    },
  },
  thisWeek: 3,
  streakDays: 2,
  weeks,
}

beforeEach(() => {
  vi.mocked(api.get).mockReset()
})

describe('WorkoutWidget', () => {
  it('mostra la foto dell ultimo allenamento, i due numeri e 12 settimane', async () => {
    vi.mocked(api.get).mockResolvedValue(SUMMARY)
    const { container } = renderWithProviders(<WorkoutWidget />)
    expect(await screen.findByText('Push')).toBeInTheDocument()
    expect(screen.getByText('ieri · 1 h 05 min')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Panca piana' })).toHaveAttribute(
      'src',
      SUMMARY.last!.exercise!.image!.url,
    )
    expect(screen.getByText('questa settimana').previousSibling).toHaveTextContent('3')
    expect(screen.getByText('giorni di fila').previousSibling).toHaveTextContent('2')
    expect(container.querySelectorAll('[data-week]')).toHaveLength(12)
    expect(screen.getByRole('link', { name: 'Dettagli' })).toHaveAttribute('href', '/allenamenti')
  })

  it('senza immagine il riquadro apre Scegli immagine', async () => {
    vi.mocked(api.get).mockResolvedValue({
      ...SUMMARY,
      last: { ...SUMMARY.last!, exercise: { name: 'Croci strane', image: null } },
    })
    renderWithProviders(<WorkoutWidget />)
    expect(
      await screen.findByRole('button', { name: 'Scegli immagine per Croci strane' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Scegli immagine')).toBeInTheDocument()
  })

  it('senza allenamenti invita a importare il CSV', async () => {
    vi.mocked(api.get).mockResolvedValue({ ...SUMMARY, last: null })
    renderWithProviders(<WorkoutWidget />)
    expect(await screen.findByRole('link', { name: 'importa il CSV di Liftin’' })).toHaveAttribute(
      'href',
      '/allenamenti',
    )
  })

  it('durante il caricamento mostra lo skeleton', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}))
    renderWithProviders(<WorkoutWidget />)
    expect(screen.getByLabelText('Allenamento: caricamento')).toBeInTheDocument()
  })
})
