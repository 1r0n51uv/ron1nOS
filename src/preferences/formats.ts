import type { Preferences } from '../../server/preferences/schema.ts'

// Formati (SET-010): peso ed energia cambiano solo la visualizzazione, i
// dati restano in kg e kcal. Il fuso orario vale per le ore mostrate.
export type Formats = Preferences['formats']

export const KJ_PER_KCAL = 4.184
export const LB_PER_KG = 2.20462262

export function toEnergy(kcal: number, unit: Formats['energyUnit']) {
  return unit === 'kJ' ? kcal * KJ_PER_KCAL : kcal
}

export function toWeight(kg: number, unit: Formats['weightUnit']) {
  return unit === 'lb' ? kg * LB_PER_KG : kg
}

export function makeFormats(f: Formats) {
  return {
    ...f,
    energy: (kcal: number) => toEnergy(kcal, f.energyUnit),
    weight: (kg: number) => toWeight(kg, f.weightUnit),
  }
}

export type FormatTools = ReturnType<typeof makeFormats>
