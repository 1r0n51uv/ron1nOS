import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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

describe('modifica sempre attiva (DASH-004)', () => {
  const items = [
    { id: 'a', x: 0, y: 0, w: 8, h: 8 },
    { id: 'b', x: 8, y: 0, w: 8, h: 8 },
  ]
  const widgets = [def('a', 'Primo'), def('b', 'Secondo')]

  function setup() {
    const onChange = vi.fn()
    const onRemove = vi.fn()
    renderWithProviders(
      <DashboardGrid items={items} widgets={widgets} onChange={onChange} onRemove={onRemove} />,
    )
    return { onChange, onRemove, handle: screen.getByRole('button', { name: 'Sposta il widget Primo' }) }
  }

  it('senza onChange non mostra i comandi', () => {
    renderWithProviders(<DashboardGrid items={items} widgets={widgets} />)
    expect(screen.queryByRole('button', { name: /Sposta il widget/ })).toBeNull()
  })

  it('le frecce spostano il widget', () => {
    const { onChange, handle } = setup()
    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith([{ ...items[0], y: 1 }, items[1]])
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    // Coprendo b lo spinge sotto.
    expect(onChange).toHaveBeenLastCalledWith([
      { ...items[0], x: 1 },
      { ...items[1], y: 8 },
    ])
  })

  it('Maiusc + frecce ridimensionano, Canc rimuove', () => {
    const { onChange, onRemove, handle } = setup()
    fireEvent.keyDown(handle, { key: 'ArrowDown', shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith([{ ...items[0], h: 9 }, items[1]])
    fireEvent.keyDown(handle, { key: 'Delete' })
    expect(onRemove).toHaveBeenCalledWith('a')
  })

  it('Opzioni apre il pannello e le scelte cambiano il layout (DASH-005)', async () => {
    const onChange = vi.fn()
    const opts = { ...def('a', 'Primo'), variants: ['detailed', 'compact'] as const }
    renderWithProviders(<DashboardGrid items={items} widgets={[opts, widgets[1]]} onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Altre azioni sul widget Primo' }), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Opzioni' }))
    fireEvent.click(await screen.findByRole('radio', { name: 'Compatta' }))
    expect(onChange).toHaveBeenLastCalledWith([{ ...items[0], variant: 'compact' }, items[1]])
  })

  it('il menu del widget ha Rimuovi', async () => {
    const { onRemove } = setup()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Altre azioni sul widget Secondo' }), {
      key: 'Enter',
    })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Rimuovi' }))
    expect(onRemove).toHaveBeenCalledWith('b')
  })

  it('si trascina dalla maniglia e si salva al rilascio', () => {
    const { onChange, handle } = setup()
    // In jsdom la griglia è larga 0: una colonna vale lo spazio, 16px.
    fireEvent.pointerDown(handle, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(window, { clientX: 0, clientY: 80 })
    expect(screen.getByTestId('dashboard-grid').querySelector('[data-dragging]')).not.toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.pointerUp(window)
    expect(onChange).toHaveBeenCalledWith([{ ...items[0], y: 2 }, items[1]])
  })
})
