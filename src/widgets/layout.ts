import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { WidgetVariant } from './types'

// Layout della dashboard (DASH-007): risposta di
// GET /api/v1/dashboard/layouts/{device}, contratto in api/openapi.yaml.
export type Device = 'desktop' | 'iphone'

export type LayoutItem = {
  id: string
  x: number
  y: number
  w: number
  h: number
  variant?: WidgetVariant
  options?: Record<string, unknown>
}

export type DashboardLayout = {
  header: 'full' | 'line' | 'hidden'
  items: LayoutItem[]
}

// Forme della testata (DASH-006), dal menu della dashboard e in Impostazioni.
export const HEADER_FORMS: [DashboardLayout['header'], string][] = [
  ['full', 'Completa'],
  ['line', 'Una riga'],
  ['hidden', 'Nascosta'],
]

export type LayoutResponse = DashboardLayout & {
  device: Device
  updatedAt: string | null
  // false senza database: si vede il predefinito e non si salva.
  stored: boolean
}

export function getLayout(device: Device) {
  return api.get<LayoutResponse>(`/dashboard/layouts/${device}`)
}

export function putLayout(device: Device, layout: DashboardLayout) {
  return api.put<LayoutResponse>(`/dashboard/layouts/${device}`, layout)
}

// Ripristino (DASH-008): il server cancella il layout e risponde con il predefinito.
export function deleteLayout(device: Device) {
  return api.delete<LayoutResponse>(`/dashboard/layouts/${device}`)
}

// La sorgente passa da un oggetto così i test possono sostituirla.
export const source = { getLayout, putLayout, deleteLayout }

const key = (device: Device) => ['dashboard', 'layout', device]

// In ordine di lettura: dall'alto in basso, da sinistra a destra.
export function readingOrder(items: LayoutItem[]) {
  return [...items].sort((a, b) => a.y - b.y || a.x - b.x)
}

export const SAVE_DELAY_MS = 1000

// Layout del dispositivo, modificabile: ogni cambio si vede subito e si
// salva da solo un secondo dopo l'ultimo. Se il salvataggio fallisce il
// layout sullo schermo resta e `retry` riprova.
export function useDashboardLayout(device: Device = 'desktop') {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: key(device), queryFn: () => source.getLayout(device) })
  const save = useMutation({
    mutationFn: (layout: DashboardLayout) => source.putLayout(device, layout),
    onSuccess: (saved) => queryClient.setQueryData(key(device), saved),
  })
  const [pending, setPending] = useState<DashboardLayout | null>(null)
  const restore = useMutation({
    mutationFn: () => source.deleteLayout(device),
    onSuccess: (layout) => {
      setPending(null)
      queryClient.setQueryData(key(device), layout)
    },
  })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Il cambio non ancora inviato, da salvare comunque se si cambia pagina.
  const unsaved = useRef<DashboardLayout | null>(null)
  const { mutate } = save

  const flush = useCallback(
    (layout: DashboardLayout) => {
      unsaved.current = null
      mutate(layout)
    },
    [mutate],
  )

  const setLayout = useCallback(
    (layout: DashboardLayout) => {
      setPending(layout)
      unsaved.current = layout
      clearTimeout(timer.current)
      timer.current = setTimeout(() => flush(layout), SAVE_DELAY_MS)
    },
    [flush],
  )

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      const layout = unsaved.current
      if (!layout) return
      // La pagina se ne va prima del salvataggio: la cache prende subito il
      // layout nuovo e il salvataggio parte lo stesso.
      queryClient.setQueryData<LayoutResponse>(key(device), (old) => (old ? { ...old, ...layout } : old))
      void source.putLayout(device, layout).then(
        (saved) => queryClient.setQueryData(key(device), saved),
        () => undefined,
      )
    },
    [queryClient, device],
  )

  const layout = pending ?? query.data
  return {
    layout,
    stored: query.data?.stored ?? true,
    isPending: query.isPending,
    setLayout,
    saveFailed: save.isError,
    retry: () => {
      if (layout) flush(layout)
    },
    // Un salvataggio in attesa non deve riscrivere il layout appena ripristinato.
    reset: () => {
      clearTimeout(timer.current)
      unsaved.current = null
      return restore.mutateAsync()
    },
    resetting: restore.isPending,
    resetFailed: restore.isError,
  }
}
