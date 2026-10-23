import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_PREFERENCES } from '../../server/preferences/schema.ts'
import type { PreferencesResponse } from './data'
import { cached, source, STORAGE_KEY, usePreferences, useUpdatePreferences } from './data'

const saved: PreferencesResponse = {
  ...DEFAULT_PREFERENCES,
  appearance: { ...DEFAULT_PREFERENCES.appearance, density: 'compact' },
  updatedAt: '2026-10-23T06:00:00.000Z',
  stored: true,
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('preferenze nel browser (SET-002)', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('senza copia salvata parte dai predefiniti', () => {
    expect(cached()).toMatchObject(DEFAULT_PREFERENCES)
  })

  it('una copia rovinata non blocca: valgono i predefiniti', () => {
    localStorage.setItem(STORAGE_KEY, '{rotto')
    expect(cached()).toMatchObject(DEFAULT_PREFERENCES)
  })

  it('parte dalla copia salvata e la aggiorna con quella del server', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_PREFERENCES, appearance: { glass: 'strong' } }),
    )
    let resolve: (p: PreferencesResponse) => void = () => {}
    vi.spyOn(source, 'getPreferences').mockReturnValue(new Promise((r) => (resolve = r)))
    const { result } = renderHook(() => usePreferences(), { wrapper })
    // Prima della risposta: la copia del browser, senza passare dai predefiniti.
    expect(result.current.data?.appearance.glass).toBe('strong')
    act(() => resolve(saved))
    await waitFor(() => expect(result.current.data?.appearance.density).toBe('compact'))
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').appearance.density).toBe('compact')
  })

  it('la modifica si vede subito e torna indietro se il server la rifiuta', async () => {
    vi.spyOn(source, 'getPreferences').mockResolvedValue(saved)
    let reject: (e: Error) => void = () => {}
    vi.spyOn(source, 'patchPreferences').mockReturnValue(new Promise((_, r) => (reject = r)))
    const { result } = renderHook(() => ({ prefs: usePreferences(), update: useUpdatePreferences() }), {
      wrapper,
    })
    await waitFor(() => expect(result.current.prefs.data?.updatedAt).toBe(saved.updatedAt))
    act(() => result.current.update.mutate({ appearance: { glass: 'light' } }))
    await waitFor(() => expect(result.current.prefs.data?.appearance.glass).toBe('light'))
    expect(result.current.prefs.data?.appearance.density).toBe('compact')
    act(() => reject(new Error('400')))
    await waitFor(() => expect(result.current.prefs.data?.appearance.glass).toBe('medium'))
  })
})
