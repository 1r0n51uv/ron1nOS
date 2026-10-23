import { WidgetCard } from '@/components/ron1n'
import { num } from '@/lib/format'
import type { Preferences } from './data'
import { usePreferences, useUpdatePreferences } from './data'
import { Row, Segmented } from './fields'
import { makeFormats } from './formats'

type Formats = Preferences['formats']

const WEIGHT: [Formats['weightUnit'], string][] = [
  ['kg', 'kg'],
  ['lb', 'lb'],
]

const ENERGY: [Formats['energyUnit'], string][] = [
  ['kcal', 'kcal'],
  ['kJ', 'kJ'],
]

// Tutti i fusi che il browser conosce, con quello scelto anche se manca.
function timeZones(current: string) {
  const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  return all.includes(current) ? all : [current, ...all]
}

// Impostazioni › Formati (SET-010): fuso orario e unità. Le unità
// cambiano solo come si leggono i numeri: i dati restano in kg e kcal.
export function FormatsSection() {
  const prefs = usePreferences().data
  const update = useUpdatePreferences()
  if (!prefs) return null
  const { formats } = prefs
  const set = (patch: Partial<Formats>) => update.mutate({ formats: patch })
  const failed = update.isError ? (update.variables?.formats ?? {}) : {}
  const fmt = makeFormats(formats)

  return (
    <WidgetCard title="Fuso orario e unità">
      <p className="m-0 text-sm text-ink-muted">
        Valgono per tutti i dispositivi. I dati restano salvati in kg e kcal.
      </p>

      <Row label="Fuso orario" hint="Per le ore mostrate nei moduli." error={'timeZone' in failed}>
        <select
          aria-label="Fuso orario"
          value={formats.timeZone}
          onChange={(e) => set({ timeZone: e.target.value })}
          className="h-11 max-w-[260px] cursor-pointer rounded-full border border-glass-border bg-glass px-4 font-mono text-sm text-ink"
        >
          {timeZones(formats.timeZone).map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </Row>

      <Row
        label="Peso"
        hint={`Peso corporeo e carichi · 80 kg = ${num(fmt.weight(80), 1)} ${formats.weightUnit}`}
        error={'weightUnit' in failed}
      >
        <Segmented
          label="Peso"
          options={WEIGHT}
          value={formats.weightUnit}
          onChange={(weightUnit) => set({ weightUnit })}
        />
      </Row>

      <Row
        label="Energia"
        hint={`Calorie dei pasti · 2000 kcal = ${num(fmt.energy(2000))} ${formats.energyUnit}`}
        error={'energyUnit' in failed}
      >
        <Segmented
          label="Energia"
          options={ENERGY}
          value={formats.energyUnit}
          onChange={(energyUnit) => set({ energyUnit })}
        />
      </Row>

      <Row label="Lingua" hint="Per ora ron1nOS parla solo italiano." error={false}>
        <span aria-label="Lingua" className="text-sm">
          Italiano
        </span>
      </Row>
    </WidgetCard>
  )
}
