import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

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
      api.put<{ name: string; image: ExerciseImage | null; group: string | null }>(
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

// Storico delle sessioni (GYM-004): pagine da 20 dalla più recente.
export type SessionRow = {
  id: string
  day: string
  routine: string
  startedAt: string
  durationSeconds: number | null
  exercises: { name: string; image: ExerciseImage | null }[]
}

type SessionPage = { sessions: SessionRow[]; nextCursor: string | null }

export function useSessions(routine: string | null) {
  return useInfiniteQuery({
    queryKey: ['workout', 'sessions', routine],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams()
      if (routine) params.set('routine', routine)
      if (pageParam) params.set('cursor', pageParam)
      const qs = params.toString()
      return api.get<SessionPage>(`/workout/sessions${qs ? `?${qs}` : ''}`)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // Cambiando routine resta l'elenco di prima finché arriva il nuovo.
    placeholderData: keepPreviousData,
  })
}

export function useRoutines() {
  return useQuery({
    queryKey: ['workout', 'routines'],
    queryFn: () => api.get<{ routines: string[] }>('/workout/routines'),
  })
}

// Dettaglio di una sessione (GYM-005), in sola lettura.
export type SessionDetail = {
  id: string
  day: string
  routine: string
  startedAt: string
  durationSeconds: number | null
  volumeKg: number
  exercises: {
    name: string
    key: string
    image: ExerciseImage | null
    timed: boolean
    volumeKg: number
    record: boolean
    sets: {
      index: number
      warmup: boolean
      weightKg: number
      reps: number | null
      durationSeconds: number | null
    }[]
  }[]
}

export function useSession(id: string) {
  return useQuery({
    queryKey: ['workout', 'session', id],
    queryFn: () => api.get<SessionDetail>(`/workout/sessions/${encodeURIComponent(id)}`),
  })
}

// Elimina una sessione (GYM-006): sparisce da storico, grafici e costanza.
export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/workout/sessions/${encodeURIComponent(id)}`),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: ['workout', 'session', id] })
      return qc.invalidateQueries({ queryKey: ['workout'] })
    },
  })
}

// Esercizi (GYM-007, GYM-009): uno per nome, con immagine e andamento.
export type ExerciseRow = {
  name: string
  key: string
  image: ExerciseImage | null
  group: string | null
  timed: boolean
  sets: number
  sessions: number
  lastDay: string
  best1RMKg: number | null
  bestDurationSeconds: number | null
  trend: number[]
}

export function useExercises(
  params: { q?: string; sort?: 'recent' | 'sets'; limit?: number; incomplete?: boolean } = {},
) {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.sort) search.set('sort', params.sort)
  if (params.limit) search.set('limit', String(params.limit))
  if (params.incomplete) search.set('incomplete', 'true')
  const qs = search.toString()
  return useQuery({
    queryKey: ['workout', 'exercises', params],
    queryFn: () =>
      api
        .get<{ exercises: ExerciseRow[] }>(`/workout/exercises${qs ? `?${qs}` : ''}`)
        .then((r) => r.exercises),
    // Mentre si scrive resta l'elenco di prima.
    placeholderData: keepPreviousData,
  })
}

// Indirizzo della pagina di un esercizio (GYM-008).
export const exercisePath = (key: string) => `/allenamenti/esercizi/${encodeURIComponent(key)}`

// Pagina di un esercizio (GYM-008).
export type ExerciseRange = '3m' | '6m' | '1y' | 'all'

export type ExerciseDetail = {
  name: string
  key: string
  image: ExerciseImage | null
  group: string | null
  timed: boolean
  best1RMKg: number | null
  heaviestKg: number | null
  bestDurationSeconds: number | null
  sessions: number
  range: ExerciseRange
  points: {
    sessionId: string
    day: string
    best1RMKg: number
    volumeKg: number
    bestDurationSeconds: number
    totalDurationSeconds: number
  }[]
  recent: {
    sessionId: string
    day: string
    best1RMKg: number | null
    sets: { warmup: boolean; weightKg: number; reps: number | null; durationSeconds: number | null }[]
  }[]
  records: PersonalRecord[]
}

export function useExercise(key: string, range: ExerciseRange) {
  return useQuery({
    queryKey: ['workout', 'exercise', key, range],
    queryFn: () => api.get<ExerciseDetail>(`/workout/exercises/${encodeURIComponent(key)}?range=${range}`),
    // Cambiando periodo resta il grafico di prima finché arriva il nuovo.
    placeholderData: keepPreviousData,
  })
}

// Gruppo muscolare di un esercizio (GYM-011); null lo toglie.
export function useSetExerciseGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, group }: { name: string; group: string | null }) =>
      api.put<{ name: string; group: string | null }>(
        `/workout/exercises/${encodeURIComponent(name)}/group`,
        {
          group,
        },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workout'] }),
  })
}

// Record personali (GYM-010).
export type RecordKind = 'e1rm' | 'weight' | 'reps' | 'volume' | 'duration'

export type PersonalRecord = {
  kind: RecordKind
  value: number
  weightKg: number | null
  day: string
  sessionId: string
}

export type RecentRecord = PersonalRecord & {
  exercise: { name: string; key: string; image: ExerciseImage | null }
}

export function useRecords() {
  return useQuery({
    queryKey: ['workout', 'records'],
    queryFn: () => api.get<{ records: RecentRecord[] }>('/workout/records').then((r) => r.records),
  })
}
