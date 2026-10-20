import { useQuery } from '@tanstack/react-query'

import { mockDelay } from '@/lib/mock'

export type Note = { id: string; title: string; body: string; tags: string[]; pinned: boolean }

const mock: Note[] = [
  {
    id: 'n1',
    title: 'Migrazione Traefik → Caddy',
    body: 'Provare il reverse proxy con certificati automatici sui sottodomini interni.',
    tags: ['Homelab'],
    pinned: true,
  },
]

// Mock: la sorgente delle note è ancora da decidere.
export function getPinnedNote() {
  return mockDelay(mock.find((n) => n.pinned) ?? null)
}

export function usePinnedNote() {
  return useQuery({ queryKey: ['notes', 'pinned'], queryFn: getPinnedNote })
}
