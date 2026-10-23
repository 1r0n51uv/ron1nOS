import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { Preferences, PreferencesPatch } from '../../server/preferences/schema.ts'
import { applyPatch, DEFAULT_PREFERENCES, normalize } from '../../server/preferences/schema.ts'

// Preferenze di ron1nOS (SET-002): GET e PATCH /api/v1/preferences,
// contratto in api/openapi.yaml. Tipi e predefiniti vengono dal backend.
export type { Preferences, PreferencesPatch }

export type PreferencesResponse = Preferences & {
  updatedAt: string | null
  // false senza database: valgono i predefiniti e non si salva.
  stored: boolean
}

export function getPreferences() {
  return api.get<PreferencesResponse>('/preferences')
}

export function patchPreferences(patch: PreferencesPatch) {
  return api.patch<PreferencesResponse>('/preferences', patch)
}

// La sorgente passa da un oggetto così i test possono sostituirla.
export const source = { getPreferences, patchPreferences }

const key = ['preferences']
export const STORAGE_KEY = 'ron1nos.preferences'

// L'ultima copia letta resta nel browser: all'avvio si parte da quella,
// o dai predefiniti, così tema e densità non cambiano sotto gli occhi.
export function cached(): PreferencesResponse {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...normalize(JSON.parse(raw)), updatedAt: null, stored: true }
  } catch {
    // Storage non disponibile o copia rovinata: valgono i predefiniti.
  }
  return { ...DEFAULT_PREFERENCES, updatedAt: null, stored: true }
}

function remember(prefs: PreferencesResponse) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Solo una comodità: senza storage si riparte dai predefiniti.
  }
}

export function usePreferences() {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const prefs = await source.getPreferences()
      remember(prefs)
      return prefs
    },
    placeholderData: cached,
  })
}

// La modifica si vede subito; se il server la rifiuta torna la versione di prima.
export function useUpdatePreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: PreferencesPatch) => source.patchPreferences(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key })
      const before = queryClient.getQueryData<PreferencesResponse>(key)
      if (before) queryClient.setQueryData(key, { ...before, ...applyPatch(before, patch) })
      return { before }
    },
    onError: (_error, _patch, context) => {
      if (context?.before) queryClient.setQueryData(key, context.before)
    },
    onSuccess: (saved) => {
      remember(saved)
      queryClient.setQueryData(key, saved)
    },
  })
}
