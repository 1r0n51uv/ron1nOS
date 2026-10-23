import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { ModuleId } from '../../server/dashboard/catalog.ts'
import type { Preferences, PreferencesPatch } from '../../server/preferences/schema.ts'
import { applyPatch, DEFAULT_PREFERENCES, normalize } from '../../server/preferences/schema.ts'

// Preferenze di ron1nOS (SET-002): GET e PATCH /api/v1/preferences,
// contratto in api/openapi.yaml. Tipi e predefiniti vengono dal backend.
export type { Preferences, PreferencesPatch }

export type PreferencesResponse = Preferences & {
  updatedAt: string | null
  // Data dell'immagine di sfondo caricata, o null se non c'è (SET-003).
  backgroundImage: string | null
  // false senza database: valgono i predefiniti e non si salva.
  stored: boolean
}

export function getPreferences() {
  return api.get<PreferencesResponse>('/preferences')
}

export function patchPreferences(patch: PreferencesPatch) {
  return api.patch<PreferencesResponse>('/preferences', patch)
}

// Sfondo caricato (SET-003): salvarlo lo mette anche in uso.
export function uploadBackground(file: File) {
  const form = new FormData()
  form.append('file', file)
  return api.put<PreferencesResponse>('/preferences/background', form)
}

export function removeBackground() {
  return api.delete<PreferencesResponse>('/preferences/background')
}

export function backgroundUrl(version: string) {
  return `/api/v1/preferences/background?v=${encodeURIComponent(version)}`
}

// La sorgente passa da un oggetto così i test possono sostituirla.
export const source = { getPreferences, patchPreferences, uploadBackground, removeBackground }

const key = ['preferences']
export const STORAGE_KEY = 'ron1nos.preferences'

// L'ultima copia letta resta nel browser: all'avvio si parte da quella,
// o dai predefiniti, così tema e densità non cambiano sotto gli occhi.
export function cached(): PreferencesResponse {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as { backgroundImage?: unknown }
      const image = typeof saved?.backgroundImage === 'string' ? saved.backgroundImage : null
      return { ...normalize(saved), updatedAt: null, backgroundImage: image, stored: true }
    }
  } catch {
    // Storage non disponibile o copia rovinata: valgono i predefiniti.
  }
  return { ...DEFAULT_PREFERENCES, updatedAt: null, backgroundImage: null, stored: true }
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

// Moduli spenti in Impostazioni › Moduli (SET-005).
export function useDisabledModules(): readonly ModuleId[] {
  return usePreferences().data?.disabledModules ?? []
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

// Carica o toglie l'immagine di sfondo; la risposta sono le preferenze nuove.
export function useBackgroundImage() {
  const queryClient = useQueryClient()
  const onSuccess = (saved: PreferencesResponse) => {
    remember(saved)
    queryClient.setQueryData(key, saved)
  }
  return {
    upload: useMutation({ mutationFn: (file: File) => source.uploadBackground(file), onSuccess }),
    remove: useMutation({ mutationFn: () => source.removeBackground(), onSuccess }),
  }
}
