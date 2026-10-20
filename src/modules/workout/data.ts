import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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
