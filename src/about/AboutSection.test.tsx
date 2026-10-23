import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { renderWithProviders } from '@/test/render'
import { AboutSection } from './AboutSection'
import { source, uptime } from './data'

describe('uptime', () => {
  it('minuti, ore o giorni', () => {
    expect(uptime(59)).toBe('0 min')
    expect(uptime(12 * 60)).toBe('12 min')
    expect(uptime(5 * 3600 + 3 * 60)).toBe('5 h 3 min')
    expect(uptime(3 * 86400 + 4 * 3600 + 59)).toBe('3 g 4 h')
  })
})

describe('Impostazioni › Informazioni (SET-012)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('versione, stato e da quanto è acceso', async () => {
    vi.spyOn(source, 'getHealth').mockResolvedValue({ ok: true, database: 'ok' })
    vi.spyOn(source, 'getAbout').mockResolvedValue({
      version: { commit: '0123456789abcdef', builtAt: '2026-10-23T08:00:00Z' },
      startedAt: '2026-10-21T08:00:00Z',
      uptimeSeconds: 2 * 86400 + 3600,
    })
    renderWithProviders(<AboutSection />)
    const commit = await screen.findByRole('link', { name: '0123456' })
    expect(commit).toHaveAttribute('href', 'https://github.com/1r0n51uv/ron1nOS/commit/0123456789abcdef')
    expect(await screen.findByText('attivo')).toBeInTheDocument()
    expect(screen.getByText('collegato')).toBeInTheDocument()
    expect(screen.getByText('2 g 1 h')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Repository di ron1nOS' })).toHaveAttribute(
      'href',
      'https://github.com/1r0n51uv/ron1nOS',
    )
    expect(screen.getByRole('link', { name: 'Specifica delle impostazioni' })).toBeInTheDocument()
  })

  it('fuori da un’immagine dice build locale; un backend giù si vede', async () => {
    vi.spyOn(source, 'getHealth').mockRejectedValue(new ApiError('network', 'x', 0))
    vi.spyOn(source, 'getAbout').mockResolvedValue({
      version: { commit: null, builtAt: null },
      startedAt: '2026-10-23T08:00:00Z',
      uptimeSeconds: 600,
    })
    renderWithProviders(<AboutSection />)
    expect(await screen.findByText('build locale')).toBeInTheDocument()
    expect(screen.getByText('non indicata')).toBeInTheDocument()
    expect(await screen.findByText('non raggiungibile')).toBeInTheDocument()
  })

  it('database non configurato', async () => {
    vi.spyOn(source, 'getHealth').mockResolvedValue({ ok: true, database: 'disabled' })
    vi.spyOn(source, 'getAbout').mockResolvedValue({
      version: { commit: null, builtAt: null },
      startedAt: '2026-10-23T08:00:00Z',
      uptimeSeconds: 0,
    })
    renderWithProviders(<AboutSection />)
    expect(await screen.findByText('non configurato')).toBeInTheDocument()
  })
})
