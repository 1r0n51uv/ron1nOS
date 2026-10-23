import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import { DashboardPanel } from './DashboardPanel'
import type { LayoutResponse } from './layout'
import { SAVE_DELAY_MS, source } from './layout'

const layout = (stored: boolean): LayoutResponse => ({
  device: 'desktop',
  header: 'full',
  items: [],
  updatedAt: null,
  stored,
})

describe('ripristino del layout in Impostazioni (DASH-008)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('chiede conferma e poi ripristina', async () => {
    vi.spyOn(source, 'getLayout').mockResolvedValue(layout(true))
    const del = vi.spyOn(source, 'deleteLayout').mockResolvedValue(layout(true))
    renderWithProviders(<DashboardPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ripristina layout predefinito' }))
    expect(screen.getByRole('dialog', { name: 'Ripristinare il layout predefinito?' })).toBeInTheDocument()
    expect(del).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Ripristina' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(del).toHaveBeenCalledWith('desktop')
  })

  it('se il ripristino fallisce lo dice e resta aperto', async () => {
    vi.spyOn(source, 'getLayout').mockResolvedValue(layout(true))
    vi.spyOn(source, 'deleteLayout').mockRejectedValue(new Error('giù'))
    renderWithProviders(<DashboardPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ripristina layout predefinito' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ripristina' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ripristino non riuscito')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('senza database il pulsante è spento', async () => {
    vi.spyOn(source, 'getLayout').mockResolvedValue(layout(false))
    renderWithProviders(<DashboardPanel />)
    expect(await screen.findByText('Senza database il layout è già quello predefinito.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ripristina layout predefinito' })).toBeDisabled()
  })
})

const full: LayoutResponse = {
  device: 'desktop',
  header: 'full',
  items: [
    { id: 'notes.summary', x: 0, y: 10, w: 8, h: 7 },
    { id: 'weight.summary', x: 0, y: 0, w: 8, h: 7 },
  ],
  updatedAt: null,
  stored: true,
}

describe('Impostazioni › Dashboard (SET-004)', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('elenca i widget presenti nell’ordine della dashboard', async () => {
    vi.spyOn(source, 'getLayout').mockResolvedValue(full)
    renderWithProviders(<DashboardPanel />)
    const list = await screen.findByRole('list', { name: 'Widget presenti' })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([expect.stringContaining('Peso'), expect.stringContaining('Note')])
  })

  it('testata e Rimuovi cambiano il layout e lo salvano da soli', async () => {
    vi.spyOn(source, 'getLayout').mockResolvedValue(full)
    const put = vi.spyOn(source, 'putLayout').mockImplementation(async (_d, l) => ({ ...full, ...l }))
    renderWithProviders(<DashboardPanel />)
    fireEvent.click(await screen.findByRole('radio', { name: 'Una riga' }))
    expect(screen.getByRole('radio', { name: 'Una riga' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Rimuovi · Nota fissata' }))
    expect(screen.queryByRole('button', { name: 'Rimuovi · Nota fissata' })).toBeNull()
    await waitFor(() => expect(put).toHaveBeenCalled(), { timeout: SAVE_DELAY_MS + 1000 })
    expect(put).toHaveBeenLastCalledWith('desktop', { header: 'line', items: [full.items[1]] })
  })

  it('Opzioni apre lo stesso pannello del widget', async () => {
    vi.spyOn(source, 'getLayout').mockResolvedValue(full)
    renderWithProviders(<DashboardPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Opzioni · Peso' }))
    expect(screen.getByRole('dialog', { name: 'Opzioni · Peso' })).toBeInTheDocument()
  })
})
