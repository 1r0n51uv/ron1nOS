import { useQuery } from '@tanstack/react-query'

import { mockDelay } from '@/lib/mock'

export type WeightTrend = { unit: 'kg'; days: number; points: number[] }

const mock: WeightTrend = {
  unit: 'kg',
  days: 30,
  points: [82.4, 82.5, 82.1, 81.9, 81.9, 81.5, 81.3, 81.4, 80.9, 80.8, 80.8, 80.4, 80.3, 80.3, 80.1],
}

// Mock: da sostituire con i dati HealthKit esposti dall'API.
export function getWeightTrend() {
  return mockDelay(mock)
}

export function useWeight() {
  return useQuery({ queryKey: ['weight', 'trend'], queryFn: getWeightTrend })
}
