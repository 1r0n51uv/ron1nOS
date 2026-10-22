import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type * as data from '../data'
import type { Report } from '../data'
import { useReport } from '../data'
import { addDays } from '../dates'
import { ReportPage } from './ReportPage'

vi.mock('../data', async (importOriginal) => ({
  ...(await importOriginal<typeof data>()),
  useReport: vi.fn(),
}))

function report(days: number, over: Partial<Report> = {}): Report {
  const from = addDays('2026-10-21', -(days - 1))
  return {
    days,
    from,
    to: '2026-10-21',
    series: Array.from({ length: days }, (_, i) => ({
      date: addDays(from, i),
      kcal: i % 2 ? 2000 : 2300,
      protein: 120,
      carbs: 220,
      fat: 65,
      logged: true,
      goalKcal: 2050,
    })),
    averageKcal: 2055,
    trendKcalPerWeek: -12,
    adherence: { inTarget: 21, total: 30, pct: 70 },
    macros: { protein: 118, carbs: 221, fat: 64 },
    goal: { protein: 126, carbs: 227, fat: 67 },
    weight: {
      points: [
        { date: '2026-09-22', kg: 81.5 },
        { date: '2026-10-20', kg: 80.1 },
      ],
      first: 81.5,
      last: 80.1,
      delta: -1.4,
    },
    ...over,
  }
}

beforeEach(() => {
  vi.mocked(useReport).mockImplementation((days) => ({ data: report(days), error: null }) as never)
})

describe('ReportPage (NUT-017)', () => {
  it('media, tendenza, aderenza e peso', () => {
    renderWithProviders(<ReportPage />, { route: '/pasti/andamento' })
    expect(screen.getByRole('heading', { name: 'Ultimi 30 giorni' })).toBeInTheDocument()
    expect(screen.getByText(/^2\.?055$/)).toBeInTheDocument()
    expect(screen.getByText('−12')).toBeInTheDocument()
    expect(screen.getByText('70')).toBeInTheDocument()
    expect(screen.getByText('21 giorni su 30')).toBeInTheDocument()
    expect(screen.getByText('80,1')).toBeInTheDocument()
    expect(screen.getByText('−1,4 kg')).toBeInTheDocument()
  })

  it('le barre fuori tolleranza sono più chiare e c’è l’obiettivo del giorno', () => {
    renderWithProviders(<ReportPage />, { route: '/pasti/andamento' })
    const chart = within(screen.getByRole('region', { name: 'Kcal al giorno' })).getByRole('img')
    expect(chart).toHaveAccessibleName(
      /^Kcal al giorno dal 22 set al 21 ott, obiettivo intorno a 2\.?050 kcal$/,
    )
    const bars = chart.querySelectorAll('[data-day]')
    expect(bars).toHaveLength(30)
    // 2300 è fuori di 250, 2000 dentro.
    expect(bars[0].firstElementChild).toHaveClass('bg-ink/20')
    expect(bars[1].firstElementChild).toHaveClass('bg-ink/55')
  })

  it('macro medie sull’obiettivo e peso da YAZIO', () => {
    renderWithProviders(<ReportPage />, { route: '/pasti/andamento' })
    expect(screen.getByLabelText('Proteine 118 / 126 g')).toBeInTheDocument()
    expect(screen.getByText('da YAZIO · 81,5 → 80,1 kg')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Peso da 81,5 a 80,1 kg in 30 giorni' })).toBeInTheDocument()
  })

  it('90 giorni dal selettore del periodo', () => {
    renderWithProviders(<ReportPage />, { route: '/pasti/andamento' })
    fireEvent.click(screen.getByRole('button', { name: '90 giorni' }))
    expect(vi.mocked(useReport)).toHaveBeenLastCalledWith(90)
    expect(screen.getByRole('heading', { name: 'Ultimi 90 giorni' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '90 giorni' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('senza dati i numeri restano vuoti', () => {
    vi.mocked(useReport).mockReturnValue({
      data: report(30, {
        averageKcal: null,
        trendKcalPerWeek: null,
        adherence: { inTarget: 0, total: 0, pct: null },
        macros: null,
        weight: { points: [], first: null, last: null, delta: null },
      }),
      error: null,
    } as never)
    renderWithProviders(<ReportPage />, { route: '/pasti/andamento' })
    expect(screen.getAllByText('—')).toHaveLength(4)
    expect(screen.getByText('Niente registrato nel periodo.')).toBeInTheDocument()
    expect(screen.getByText('Nessuna pesata nel periodo.')).toBeInTheDocument()
  })
})
