import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { mockDelay } from '@/lib/mock'

export type Device = { id: string; name: string; meta: string; on: boolean }

const mock: Device[] = [
  { id: 'light.soggiorno', name: 'Luci soggiorno', meta: '60%', on: true },
  { id: 'climate.casa', name: 'Termostato', meta: '21,5 °C', on: true },
  { id: 'fan.purificatore', name: 'Purificatore', meta: 'spento', on: false },
  { id: 'switch.rack', name: 'Rack server', meta: '142 W', on: true },
]

// Mock: da sostituire con Home Assistant (REST o WebSocket API).
export function getDevices() {
  return mockDelay(mock)
}

export function setDevice(id: string, on: boolean) {
  const d = mock.find((x) => x.id === id)
  if (d) {
    d.on = on
    if (d.id === 'fan.purificatore') d.meta = on ? 'auto' : 'spento'
  }
  return mockDelay(mock, 120)
}

const key = ['home', 'devices']

export function useDevices() {
  return useQuery({ queryKey: key, queryFn: getDevices })
}

// Aggiornamento ottimistico: il tassello cambia subito, il server conferma.
export function useToggleDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => setDevice(id, on),
    onMutate: async ({ id, on }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Device[]>(key)
      qc.setQueryData<Device[]>(key, (list) => list?.map((d) => (d.id === id ? { ...d, on } : d)))
      return { prev }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSuccess: (data) => qc.setQueryData(key, data),
  })
}
