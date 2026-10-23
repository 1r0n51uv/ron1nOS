import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_PREFERENCES } from '../../server/preferences/schema.ts'
import { source } from './data'
import { StorageNotice } from './StorageNotice'

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('avviso senza database (SET-002)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('avvisa che le modifiche non si salvano', async () => {
    vi.spyOn(source, 'getPreferences').mockResolvedValue({
      ...DEFAULT_PREFERENCES,
      updatedAt: null,
      backgroundImage: null,
      stored: false,
    })
    render(wrap(<StorageNotice />))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Preferenze predefinite · senza database le modifiche non si salvano',
    )
  })

  it('con il database non mostra nulla', async () => {
    const get = vi
      .spyOn(source, 'getPreferences')
      .mockResolvedValue({ ...DEFAULT_PREFERENCES, updatedAt: null, backgroundImage: null, stored: true })
    render(wrap(<StorageNotice />))
    await vi.waitFor(() => expect(get).toHaveBeenCalled())
    expect(screen.queryByRole('status')).toBeNull()
  })
})
