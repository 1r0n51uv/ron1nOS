import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

// Import del CSV di Liftin' (GYM-003): il file va al backend, che lo legge
// e calcola anteprima e unione. Il client non interpreta il CSV.
export const MAX_CSV_BYTES = 5 * 1024 * 1024

export type ImportSummary = {
  newSessions: number
  updatedSessions: number
  unchangedSessions: number
  deletedSessions: number
  newSets: number
  updatedSets: number
  skippedRows: number
  from: string
  to: string
}

function csvForm(file: File) {
  const form = new FormData()
  form.append('file', file)
  return form
}

export function previewImport(file: File) {
  return api.post<ImportSummary>('/workout/import/preview', csvForm(file))
}

export function applyImport(file: File) {
  return api.post<ImportSummary>('/workout/import', csvForm(file))
}

export function useImportPreview() {
  return useMutation({ mutationFn: previewImport })
}

// Dopo l'import widget e pagina si rileggono senza ricaricare.
export function useImportWorkouts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: applyImport,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workout'] }),
  })
}

// Controllo del file prima dell'invio: il resto lo verifica il server.
export function csvFileError(file: File) {
  if (!/\.csv$/i.test(file.name)) return 'Serve un file .csv esportato da Liftin’.'
  if (file.size > MAX_CSV_BYTES) return 'Il file supera i 5 MB.'
  return null
}

// Immagini degli esercizi (GYM-014): foto di free-exercise-db servite dal
// backend. La scelta a mano vale per tutto lo storico di quel nome.
export type ExerciseImage = {
  catalogId: string
  source: 'manual' | 'dictionary' | 'catalog'
  url: string
}

export type CatalogExercise = {
  id: string
  name: string
  primaryMuscles: string[]
  equipment: string | null
  images: number
  url: string
}

export function useCatalog(q: string) {
  return useQuery({
    queryKey: ['workout', 'catalog', q],
    queryFn: () => api.get<{ exercises: CatalogExercise[] }>(`/workout/catalog?q=${encodeURIComponent(q)}`),
    staleTime: Infinity,
  })
}

export function useSetExerciseImage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, catalogId }: { name: string; catalogId: string | null }) =>
      api.put<{ name: string; image: ExerciseImage | null }>(
        `/workout/exercises/${encodeURIComponent(name)}/image`,
        { catalogId },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workout'] }),
  })
}

// Riepilogo (GYM-001, GYM-013): ultimo allenamento, settimana, giorni di
// fila e allenamenti per settimana sulle ultime 26 settimane.
export type WorkoutSummary = {
  today: string
  last: {
    id: string
    day: string
    routine: string
    startedAt: string
    durationSeconds: number | null
    exercise: { name: string; image: ExerciseImage | null } | null
  } | null
  thisWeek: number
  streakDays: number
  weeks: { monday: string; count: number }[]
}

export function useWorkoutSummary() {
  return useQuery({
    queryKey: ['workout', 'summary'],
    queryFn: () => api.get<WorkoutSummary>('/workout/summary'),
  })
}
