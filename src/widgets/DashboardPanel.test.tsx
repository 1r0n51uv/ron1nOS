import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import { DashboardPanel } from './DashboardPanel'
import type { LayoutResponse } from './layout'
import { source } from './layout'

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
