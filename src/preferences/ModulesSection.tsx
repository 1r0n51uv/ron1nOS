import { Link } from 'react-router'

import { WidgetCard } from '@/components/ron1n'
import { Switch } from '@/components/ui/switch'
import { MODULE_SETTINGS } from '@/pages/settings/sections'
import { MODULE_LABELS } from '@/widgets/registry'
import { MODULES } from '../../server/dashboard/catalog.ts'
import { usePreferences, useUpdatePreferences } from './data'

// Impostazioni › Moduli (SET-005): interruttore per modulo e, se ce l'ha,
// il link alle sue impostazioni. Dashboard e Impostazioni non sono moduli
// e restano sempre accese.
export function ModulesSection() {
  const prefs = usePreferences().data
  const update = useUpdatePreferences()
  if (!prefs) return null
  const disabled = prefs.disabledModules
  const failed = update.isError ? update.variables?.disabledModules : undefined

  return (
    <WidgetCard title="Moduli accesi">
      <p className="m-0 text-sm text-ink-muted">
        Un modulo spento sparisce da barra, dashboard e catalogo dei widget, e le sue API non rispondono. I
        dati restano.
      </p>
      <ul aria-label="Moduli" className="m-0 flex list-none flex-col p-0">
        {MODULES.map((module) => {
          const on = !disabled.includes(module)
          const label = MODULE_LABELS[module]
          const settings = MODULE_SETTINGS.find((m) => m.module === module)
          const error = failed && failed.includes(module) === on
          return (
            <li
              key={module}
              className="flex flex-col gap-1 border-t border-glass-border py-3 first:border-t-0"
            >
              <div className="flex items-center gap-4">
                <Switch
                  checked={on}
                  aria-label={label}
                  onCheckedChange={(checked) =>
                    update.mutate({
                      disabledModules: checked ? disabled.filter((m) => m !== module) : [...disabled, module],
                    })
                  }
                />
                <span className="flex-1 text-sm">{label}</span>
                {!on ? <span className="text-[13px] text-ink-muted">spento</span> : null}
                {settings ? (
                  <Link
                    to={`/impostazioni/moduli/${settings.id}`}
                    aria-label={`Impostazioni · ${label}`}
                    className="text-[13px] text-ink-muted no-underline hover:text-ink"
                  >
                    Impostazioni ›
                  </Link>
                ) : null}
              </div>
              {error ? (
                <p role="alert" className="m-0 text-sm text-brand-text">
                  {label} · modifica non salvata, riprova
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </WidgetCard>
  )
}
