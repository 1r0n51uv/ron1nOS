// Stato di scadenza (DOC-010): `in scadenza` dal primo preavviso attivo,
// `scaduto` dal giorno dopo la scadenza. Giorni locali Europe/Rome.
import { today } from '../nutrition/dates.ts'

export type ExpiryStatus = 'ok' | 'expiring' | 'expired'
export type Expiry = { status: ExpiryStatus; daysLeft: number } | null

export const WARNINGS = [90, 30, 7] as const

export function expiryOf(expiresOn: string | null, warnings: number[], now = new Date()): Expiry {
  if (!expiresOn) return null
  const daysLeft = Math.round(
    (Date.parse(`${expiresOn}T00:00:00Z`) - Date.parse(`${today(now)}T00:00:00Z`)) / 86_400_000,
  )
  if (daysLeft < 0) return { status: 'expired', daysLeft }
  const first = Math.max(0, ...warnings)
  return { status: daysLeft <= first ? 'expiring' : 'ok', daysLeft }
}
