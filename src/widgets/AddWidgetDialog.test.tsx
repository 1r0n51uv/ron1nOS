import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import { AddWidgetDialog } from './AddWidgetDialog'
import type { ModuleId, WidgetDef } from './types'

const def = (id: string, module: ModuleId, title: string, description = ''): WidgetDef => ({
  id,
  module,
  title,
  description,
  size: { min: { w: 6, h: 6 }, default: { w: 8, h: 8 }, max: { w: 16, h: 16 } },
  variants: [],
  component: () => <div>anteprima {title}</div>,
})

const widgets = [
  def('notes.summary', 'notes', 'Nota fissata', 'La nota in cima.'),
  def('server.summary', 'server', 'Server', 'CPU, memoria e disco.'),
]

function setup() {
  const onAdd = vi.fn()
  renderWithProviders(
    <AddWidgetDialog widgets={widgets} present={new Set(['server.summary'])} onAdd={onAdd} />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Aggiungi widget' }))
  return { onAdd, dialog: screen.getByRole('dialog') }
}

describe('Aggiungi widget (DASH-004)', () => {
  it('mostra il catalogo diviso per modulo, con anteprima', () => {
    const { dialog } = setup()
    const notes = within(dialog).getByRole('region', { name: 'Note' })
    expect(within(notes).getByText('anteprima Nota fissata')).toBeInTheDocument()
    expect(within(notes).getByText('1 widget · 0 già in dashboard')).toBeInTheDocument()
    const server = within(dialog).getByRole('region', { name: 'Server' })
    expect(within(server).getByText('In dashboard')).toBeInTheDocument()
    expect(within(server).queryByRole('button', { name: 'Aggiungi' })).toBeNull()
  })

  it('filtra per ricerca e per modulo', () => {
    const { dialog } = setup()
    fireEvent.change(within(dialog).getByRole('searchbox', { name: 'Cerca widget' }), {
      target: { value: 'cpu' },
    })
    expect(within(dialog).queryByRole('region', { name: 'Note' })).toBeNull()
    expect(within(dialog).getByRole('region', { name: 'Server' })).toBeInTheDocument()
    fireEvent.change(within(dialog).getByRole('searchbox', { name: 'Cerca widget' }), {
      target: { value: '' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /^Note/ }))
    expect(within(dialog).queryByRole('region', { name: 'Server' })).toBeNull()
  })

  it('aggiunge il widget scelto e chiude', () => {
    const { onAdd, dialog } = setup()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aggiungi' }))
    expect(onAdd).toHaveBeenCalledWith(widgets[0])
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
