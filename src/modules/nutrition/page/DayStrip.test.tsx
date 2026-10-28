import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/test/render'
import { DayStrip } from './DayStrip'

// DES-006: i giorni sono raggruppati per settimana e quella di oggi si riconosce.
describe('striscia dei giorni', () => {
  it('raggruppa per settimana e segna quella di oggi', () => {
    renderWithProviders(<DayStrip today="2026-10-21" selected="2026-10-21" />)
    const groups = screen.getAllByRole('group')
    expect(groups).toHaveLength(5)

    const current = screen.getByRole('group', { name: 'Questa settimana' })
    expect(within(current).getAllByRole('link')).toHaveLength(7)
    expect(within(current).getByRole('link', { name: 'Oggi' })).toHaveAttribute('aria-current', 'date')
    expect(screen.getByRole('group', { name: 'Settimana del 26 ott–1 nov' })).toBeInTheDocument()
  })

  it('i giorni restano tutti raggiungibili, nello stesso ordine', () => {
    renderWithProviders(<DayStrip today="2026-10-21" selected="2026-10-23" />)
    const links = within(screen.getByRole('navigation', { name: 'Giorni' })).getAllByRole('link')
    expect(links).toHaveLength(24)
    expect(links.filter((l) => l.getAttribute('aria-current') === 'date')).toHaveLength(1)
  })
})
