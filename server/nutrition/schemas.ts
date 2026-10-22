// Schemi zod condivisi delle richieste del modulo.
import { z } from 'zod'

import { isDay } from './dates.ts'

export const Day = z.string().refine(isDay, 'data non valida')

export const SLOTS = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'] as const
export const Slot = z.enum(SLOTS)
export type Slot = z.infer<typeof Slot>

// Grammi, kcal e mg: numeri finiti, mai negativi.
export const Amount = z.number().finite().nonnegative()
export const Grams = z.number().finite().positive().max(10_000)
