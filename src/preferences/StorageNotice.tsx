import { usePreferences } from './data'

// Senza database (SET-002) le preferenze sono quelle predefinite e non si salvano.
export function StorageNotice() {
  const { data, isPlaceholderData } = usePreferences()
  if (!data || isPlaceholderData || data.stored) return null
  return (
    <p role="status" className="m-0 text-sm text-ink-muted">
      Preferenze predefinite · senza database le modifiche non si salvano
    </p>
  )
}
