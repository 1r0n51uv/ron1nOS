import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/test/render'
import { DashboardGrid } from './DashboardGrid'
import type { WidgetDef } from './types'

const def = (id: string, title: string): WidgetDef => ({
  id,
  module: 'notes',
  title,
  description: '',
  size: { min: { w: 1, h: 1 }, default: { w: 8, h: 8 }, max: { w: 24, h: 24 } },
  variants: [],
  component: () => <div>{title}</div>,
})

describe('DashboardGrid (DASH-003)', () => {
  it('mette ogni widget nel suo rettangolo e in ordine di lettura', () => {
    renderWithProviders(
      <DashboardGrid
        items={[
          { id: 'b', x: 8, y: 10, w: 6, h: 4 },
          { id: 'a', x: 0, y: 0, w: 8, h: 8 },
          { id: 'ignoto', x: 0, y: 20, w: 8, h: 8 },
        ]}
        widgets={[def('a', 'Primo'), def('b', 'Secondo')]}
      />,
    )
    const cells = screen.getByTestId('dashboard-grid').children
    expect([...cells].map((c) => c.getAttribute('data-widget'))).toEqual(['a', 'b'])
    expect((cells[1] as HTMLElement).style.gridColumn).toBe('9 / span 6')
    expect((cells[1] as HTMLElement).style.gridRow).toBe('11 / span 4')
    // L'altezza arriva al widget più in basso tra quelli mostrati.
    expect(screen.getByTestId('dashboard-grid').style.gridTemplateRows).toBe('repeat(14, 24px)')
  })
})
