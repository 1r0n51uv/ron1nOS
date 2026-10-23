import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DashboardLayout, LayoutResponse } from './layout'
import { readingOrder, SAVE_DELAY_MS, source, useDashboardLayout } from './layout'

const saved: LayoutResponse = {
  device: 'desktop',
  header: 'full',
  items: [{ id: 'server.summary', x: 0, y: 0, w: 8, h: 8 }],
  updatedAt: null,
  stored: true,
}
const moved: DashboardLayout = { header: 'line', items: [{ id: 'server.summary', x: 8, y: 0, w: 8, h: 8 }] }

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('ordine di lettura', () => {
  it('ordina per riga e poi per colonna', () => {
    const items = [
      { id: 'c', x: 0, y: 10, w: 8, h: 8 },
      { id: 'b', x: 8, y: 0, w: 8, h: 8 },
      { id: 'a', x: 0, y: 0, w: 8, h: 8 },
    ]
    expect(readingOrder(items).map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('useDashboardLayout (DASH-007)', () => {
  beforeEach(() => {
    vi.spyOn(source, 'getLayout').mockResolvedValue(saved)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('mostra subito il cambio e lo salva un secondo dopo l’ultimo', async () => {
    const put = vi.spyOn(source, 'putLayout').mockImplementation(async (_d, l) => ({ ...saved, ...l }))
    const { result } = renderHook(() => useDashboardLayout(), { wrapper })
    await waitFor(() => expect(result.current.layout).toEqual(saved))

    vi.useFakeTimers()
    act(() => result.current.setLayout({ ...moved, header: 'hidden' }))
    act(() => result.current.setLayout(moved))
    expect(result.current.layout).toEqual(moved)
    act(() => vi.advanceTimersByTime(SAVE_DELAY_MS - 1))
    expect(put).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    vi.useRealTimers()
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    expect(put).toHaveBeenCalledWith('desktop', moved)
  })

  it('se il salvataggio fallisce tiene il layout e riprova a richiesta', async () => {
    const put = vi.spyOn(source, 'putLayout').mockRejectedValueOnce(new Error('giù'))
    const { result } = renderHook(() => useDashboardLayout(), { wrapper })
    await waitFor(() => expect(result.current.layout).toEqual(saved))

    vi.useFakeTimers()
    act(() => result.current.setLayout(moved))
    act(() => vi.advanceTimersByTime(SAVE_DELAY_MS))
    vi.useRealTimers()
    await waitFor(() => expect(result.current.saveFailed).toBe(true))
    expect(result.current.layout).toEqual(moved)

    put.mockResolvedValueOnce({ ...saved, ...moved })
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.saveFailed).toBe(false))
    expect(put).toHaveBeenLastCalledWith('desktop', moved)
  })
})
