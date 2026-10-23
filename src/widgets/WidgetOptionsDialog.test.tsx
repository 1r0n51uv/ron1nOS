import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type { WidgetDef, WidgetProps } from './types'
import { WidgetOptionsDialog } from './WidgetOptionsDialog'

const Preview = ({ variant, options }: WidgetProps) => (
  <div>anteprima {`${variant} ${JSON.stringify(options)}`}</div>
)

const widget: WidgetDef = {
  id: 'notes.summary',
  module: 'notes',
  title: 'Nota',
  description: '',
  size: { min: { w: 6, h: 4 }, default: { w: 8, h: 6 }, max: { w: 12, h: 10 } },
  variants: ['detailed', 'compact'],
  options: [
    {
      key: 'show',
      label: 'Dati',
      type: 'multi',
      choices: [
        { value: 'a', label: 'Primo' },
        { value: 'b', label: 'Secondo' },
      ],
      default: ['a', 'b'],
    },
    { key: 'limit', label: 'Elementi', type: 'count', min: 1, max: 3, default: 3 },
    {
      key: 'metric',
      label: 'Risorsa',
      type: 'choice',
      choices: [
        { value: 'cpu', label: 'CPU' },
        { value: 'ram', label: 'RAM' },
      ],
      default: 'cpu',
    },
  ],
  component: Preview,
}

const item = { id: 'notes.summary', x: 0, y: 0, w: 8, h: 6 }

function setup(over = {}) {
  const onChange = vi.fn()
  const onClose = vi.fn()
  renderWithProviders(
    <WidgetOptionsDialog item={{ ...item, ...over }} widget={widget} onChange={onChange} onClose={onClose} />,
  )
  return { onChange, onClose }
}

describe('Opzioni del widget (DASH-005)', () => {
  it('mostra l’anteprima con i predefiniti e la dimensione', () => {
    setup()
    expect(
      screen.getByText('anteprima detailed {"show":["a","b"],"limit":3,"metric":"cpu"}'),
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Dettagliata' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/si cambia trascinando/)).toBeInTheDocument()
  })

  it('cambia variante e risorsa', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByRole('radio', { name: 'Compatta' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...item, variant: 'compact' })
    fireEvent.click(screen.getByRole('radio', { name: 'RAM' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...item, options: { metric: 'ram' } })
  })

  it('le scelte multiple restano nell’ordine del catalogo', () => {
    const { onChange } = setup({ options: { show: ['b'] } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Primo' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...item, options: { show: ['a', 'b'] } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Secondo' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...item, options: { show: [] } })
  })

  it('il numero di elementi resta nei limiti', () => {
    const { onChange } = setup()
    expect(screen.getByRole('button', { name: 'Elementi: uno in più' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Elementi: uno in meno' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...item, options: { limit: 2 } })
  })

  it('Ripristina predefinite toglie variante e opzioni; Fatto chiude', () => {
    const { onChange, onClose } = setup({ variant: 'compact', options: { limit: 1 } })
    fireEvent.click(screen.getByRole('button', { name: 'Ripristina predefinite' }))
    expect(onChange).toHaveBeenLastCalledWith(item)
    fireEvent.click(screen.getByRole('button', { name: 'Fatto' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('un widget senza opzioni lo dice', () => {
    renderWithProviders(
      <WidgetOptionsDialog
        item={item}
        widget={{ ...widget, variants: [], options: undefined }}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Questo widget non ha altre opzioni.')).toBeInTheDocument()
  })
})
