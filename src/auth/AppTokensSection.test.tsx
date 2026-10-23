import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import { AppTokensSection } from './AppTokensSection'
import type { AppToken } from './data'
import { authSource } from './data'

const tokens: AppToken[] = [
  { id: 'a', name: 'iPhone', createdAt: '2026-10-23T08:00:00Z', lastUsedAt: '2026-10-23T09:00:00Z' },
  { id: 'b', name: 'iPad', createdAt: '2026-10-22T08:00:00Z', lastUsedAt: null },
]

describe('Impostazioni › App iOS (SET-008)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('elenco con ultimo uso, mai se non usato', async () => {
    vi.spyOn(authSource, 'me').mockResolvedValue({ enabled: true })
    vi.spyOn(authSource, 'tokens').mockResolvedValue(tokens)
    renderWithProviders(<AppTokensSection />)
    expect(await screen.findByRole('listitem', { name: 'iPhone' })).toHaveTextContent('ultimo uso')
    expect(screen.getByRole('listitem', { name: 'iPad' })).toHaveTextContent('ultimo uso mai')
  })

  it('crea un token con il nome e lo mostra una volta', async () => {
    vi.spyOn(authSource, 'me').mockResolvedValue({ enabled: true })
    vi.spyOn(authSource, 'tokens').mockResolvedValue([])
    const create = vi
      .spyOn(authSource, 'createToken')
      .mockResolvedValue({ ...tokens[0], token: 'r1n_segreto' })
    renderWithProviders(<AppTokensSection />)
    expect(await screen.findByText('Nessun token')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome')).toHaveValue('iPhone')
    fireEvent.click(screen.getByRole('button', { name: 'Crea token' }))
    await waitFor(() => expect(create).toHaveBeenCalledWith('iPhone'))
    expect(await screen.findByLabelText('Token appena creato')).toHaveTextContent('r1n_segreto')
  })

  it('senza nome non si crea', async () => {
    vi.spyOn(authSource, 'me').mockResolvedValue({ enabled: true })
    vi.spyOn(authSource, 'tokens').mockResolvedValue([])
    renderWithProviders(<AppTokensSection />)
    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: '  ' } })
    expect(screen.getByRole('button', { name: 'Crea token' })).toBeDisabled()
  })

  it('Revoca chiama la revoca del token', async () => {
    vi.spyOn(authSource, 'me').mockResolvedValue({ enabled: true })
    vi.spyOn(authSource, 'tokens').mockResolvedValue(tokens)
    const revoke = vi.spyOn(authSource, 'deleteToken').mockResolvedValue(undefined)
    renderWithProviders(<AppTokensSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Revoca · iPad' }))
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('b'))
  })

  it('con il login spento non servono token', async () => {
    vi.spyOn(authSource, 'me').mockResolvedValue({ enabled: false })
    const list = vi.spyOn(authSource, 'tokens')
    renderWithProviders(<AppTokensSection />)
    expect(await screen.findByText('Login spento')).toBeInTheDocument()
    expect(list).not.toHaveBeenCalled()
  })
})
