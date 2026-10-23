import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, ApiError } from '@/lib/api'

// Login della dashboard (docs/specs/auth.md). /auth/me risponde 401 senza
// sessione; con il login spento risponde { enabled: false }.
export type Me = { enabled: boolean }

// Una sessione in Impostazioni › Account (SET-007).
export type SessionInfo = {
  id: string
  device: string
  createdAt: string
  lastSeenAt: string
  current: boolean
}

export const authSource = {
  me: () => api.get<Me>('/auth/me'),
  sessions: () => api.get<{ sessions: SessionInfo[] }>('/auth/sessions').then((r) => r.sessions),
  closeSession: (id: string) => api.delete<void>(`/auth/sessions/${id}`),
  closeOthers: () => api.delete<void>('/auth/sessions/others'),
  login: (password: string) => api.post<Me & { expiresAt: string }>('/auth/login', { password }),
  logout: () => api.post<void>('/auth/logout'),
  logoutEverywhere: () => api.delete<void>('/auth/sessions'),
}

export const ME_KEY = ['auth', 'me']

export const isUnauthenticated = (error: unknown) => error instanceof ApiError && error.status === 401

export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: () => authSource.me(), retry: false, staleTime: Infinity })
}

export function useLogin() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (password: string) => authSource.login(password),
    // I dati letti prima del login non valgono più: si riparte puliti.
    onSuccess: () => {
      client.clear()
      client.setQueryData<Me>(ME_KEY, { enabled: true })
    },
  })
}

export function useLogout() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (everywhere: boolean) => (everywhere ? authSource.logoutEverywhere() : authSource.logout()),
    onSuccess: () => {
      client.clear()
      void client.invalidateQueries({ queryKey: ME_KEY })
    },
  })
}

// Solo percorsi interni: niente redirect verso altri siti dopo il login.
export function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '/'
}

const SESSIONS_KEY = ['auth', 'sessions']

export function useSessions(enabled: boolean) {
  return useQuery({ queryKey: SESSIONS_KEY, queryFn: () => authSource.sessions(), enabled })
}

// Chiudi una sessione o tutte le altre; l'elenco si rilegge dopo.
export function useCloseSessions() {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: SESSIONS_KEY })
  return {
    one: useMutation({ mutationFn: (id: string) => authSource.closeSession(id), onSuccess: refresh }),
    others: useMutation({ mutationFn: () => authSource.closeOthers(), onSuccess: refresh }),
  }
}
