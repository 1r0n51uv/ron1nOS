import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { mockDelay } from '@/lib/mock'

export type Exercise = { name: string; sets: number; weightKg: number }
export type WorkoutSession = {
  plan: string
  exercises: Exercise[]
  current: number // indice dell'esercizio in corso
  set: number // serie in corso, da 1
  restSeconds: number
  restStartedAt: number | null // epoch ms
}

const mock: WorkoutSession = {
  plan: 'Push · A',
  exercises: [
    { name: 'Panca piana', sets: 4, weightKg: 70 },
    { name: 'Spinte manubri inclinata', sets: 3, weightKg: 24 },
    { name: 'Military press', sets: 3, weightKg: 45 },
    { name: 'Alzate laterali', sets: 3, weightKg: 10 },
    { name: 'French press', sets: 3, weightKg: 25 },
    { name: 'Push-down al cavo', sets: 3, weightKg: 30 },
  ],
  current: 2,
  set: 2,
  restSeconds: 90,
  restStartedAt: Date.now() - 6_000,
}

// Mock: da sostituire con l'API allenamenti.
export function getWorkoutSession() {
  return mockDelay(mock)
}

export async function completeSet() {
  const ex = mock.exercises[mock.current]
  if (!ex) return mockDelay(mock)
  if (mock.set < ex.sets) mock.set += 1
  else if (mock.current < mock.exercises.length) {
    mock.current += 1
    mock.set = 1
  }
  mock.restStartedAt = mock.current < mock.exercises.length ? Date.now() : null
  return mockDelay(mock, 120)
}

const key = ['workout', 'session']

export function useWorkout() {
  return useQuery({ queryKey: key, queryFn: getWorkoutSession })
}

export function useCompleteSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: completeSet,
    onSuccess: (data) => qc.setQueryData(key, data),
  })
}

export function isFinished(w: WorkoutSession) {
  return w.current >= w.exercises.length
}

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
