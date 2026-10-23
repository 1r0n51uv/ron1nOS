import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import { AccountSection } from './AccountSection'
import type { SessionInfo } from './data'
import { authSource } from './data'

const sessions: SessionInfo[] = [
  {
    id: 'a',
    device: 'Chrome su Mac',
    createdAt: '2026-10-20T08:00:00Z',
    lastSeenAt: '2026-10-23T06:00:00Z',
    current: true,
  },
  {
    id: 'b',
    device: 'Safari su iPhone',
    createdAt: '2026-10-21T08:00:00Z',
    lastSeenAt: '2026-10-22T21:00:00Z',
    current: false,
  },
]

describe('Impostazioni › Account (SET-007)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sessioni con dispositivo e ultimo uso, questa segnata', async () => {
    vi.spyOn(authSource, 'me').mockResolvedValue({ enabled: true })
    vi.spyOn(authSource, 'sessions').mockResolvedValue(sessions)
    renderWithProviders(<AccountSection />)
    expect(await screen.findByRole('listitem', { name: 'Chrome su Mac' })).toHaveTextContent('questo browser')
    expect(screen.getByRole('listitem', { name: 'Safari su iPhone' })).toHaveTextContent('ultimo uso')
    expect(screen.getByRole('button', { name: 'Esci' })).toBeInTheDocument()
    expect(screen.getByText('npm run auth:hash')).toBeInTheDocument()
  })

  it('Chiudi e Chiudi le altre sessioni', async () => {
    vi.spyOn(authSource, 'me').mockResolvedValue({ enabled: true })
    vi.spyOn(authSource, 'sessions').mockResolvedValue(sessions)
    const one = vi.spyOn(authSource, 'closeSession').mockResolvedValue(undefined)
    const others = vi.spyOn(authSource, 'closeOthers').mockResolvedValue(undefined)
    renderWithProviders(<AccountSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Chiudi · Safari su iPhone' }))
    await waitFor(() => expect(one).toHaveBeenCalledWith('b'))
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi le altre sessioni' }))
    await waitFor(() => expect(others).toHaveBeenCalled())
  })

  it('con il login spento lo dice, e spiega comunque la password', async () => {
    vi.spyOn(authSource, 'me').mockResolvedValue({ enabled: false })
    const list = vi.spyOn(authSource, 'sessions')
    renderWithProviders(<AccountSection />)
    expect(await screen.findByText('Login spento')).toBeInTheDocument()
    expect(screen.getByText('npm run auth:hash')).toBeInTheDocument()
    expect(list).not.toHaveBeenCalled()
  })
})
