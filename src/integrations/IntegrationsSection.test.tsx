import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import type { Integration } from './data'
import { source } from './data'
import { IntegrationsSection } from './IntegrationsSection'

const at = '2026-10-23T06:00:00.000Z'
const list: Integration[] = [
  { id: 'postgres', name: 'Postgres', state: 'connected', message: null, checkedAt: at, env: [] },
  {
    id: 'yazio',
    name: 'YAZIO',
    state: 'not_configured',
    message: null,
    checkedAt: at,
    env: ['YAZIO_USERNAME', 'YAZIO_PASSWORD'],
  },
  { id: 'glances', name: 'Glances', state: 'error', message: 'Non raggiungibile', checkedAt: at, env: [] },
]

describe('Impostazioni › Integrazioni (SET-009)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('una riga per servizio con stato, messaggio e variabili da impostare', async () => {
    vi.spyOn(source, 'getIntegrations').mockResolvedValue(list)
    renderWithProviders(<IntegrationsSection />)
    const yazio = await screen.findByRole('listitem', { name: 'YAZIO' })
    expect(yazio).toHaveTextContent('non configurato')
    expect(within(yazio).getByText('YAZIO_USERNAME')).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Glances' })).toHaveTextContent('errore')
    expect(screen.getByRole('listitem', { name: 'Glances' })).toHaveTextContent('Non raggiungibile')
    expect(screen.getByRole('listitem', { name: 'Postgres' })).toHaveTextContent('collegato')
  })

  it('Verifica rifà il controllo e aggiorna la riga', async () => {
    vi.spyOn(source, 'getIntegrations').mockResolvedValue(list)
    const check = vi
      .spyOn(source, 'checkIntegration')
      .mockResolvedValue({ ...list[2], state: 'connected', message: null })
    renderWithProviders(<IntegrationsSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Verifica · Glances' }))
    await waitFor(() => expect(check).toHaveBeenCalledWith('glances'))
    await waitFor(() =>
      expect(screen.getByRole('listitem', { name: 'Glances' })).toHaveTextContent('collegato'),
    )
    expect(screen.getByRole('listitem', { name: 'Glances' })).not.toHaveTextContent('Non raggiungibile')
  })
})
