import type { ReactNode } from 'react'

import { Icon, WidgetCard } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { num } from '@/lib/format'

// Pulsante a icona con il suo nome anche come tooltip (DES-005). Il tooltip sta
// su un involucro: su un pulsante disabilitato Radix non lo mostrerebbe.
function IconAction({
  label,
  disabled,
  onClick,
  icon,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  icon: 'minus' | 'plus'
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button variant="glass" size="icon" aria-label={label} disabled={disabled} onClick={onClick}>
            <Icon name={icon} size={18} />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

// Contatore del giorno con − e + (NUT-012, NUT-013): + aggiunge una dose,
// − annulla l'ultima voce. La barra c'è solo con un obiettivo.
export function TrackerCard({
  title,
  unit,
  value,
  target,
  addLabel,
  undoLabel,
  canUndo,
  busy,
  failed,
  onAdd,
  onUndo,
  children,
}: {
  title: string
  unit: string
  value: number
  target: number | null
  addLabel: string
  undoLabel: string
  canUndo: boolean
  busy: boolean
  failed: boolean
  onAdd: () => void
  onUndo: () => void
  children: ReactNode
}) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0
  const text = target ? `${num(value)} di ${num(target)} ${unit}` : `${num(value)} ${unit}`

  return (
    <section aria-label={title}>
      <WidgetCard title={title} meta={target ? `obiettivo ${num(target)} ${unit}` : undefined}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <IconAction label={undoLabel} disabled={busy || !canUndo} onClick={onUndo} icon="minus" />
            <div className="font-mono text-[28px] leading-8 font-semibold">
              <span>{num(value)}</span> <span className="text-[15px] text-ink-muted">{unit}</span>
            </div>
            <IconAction label={addLabel} disabled={busy} onClick={onAdd} icon="plus" />
          </div>
          {target ? <Progress value={pct} aria-label={`${title} ${text}`} /> : null}
          <p className="m-0 text-[12px] text-ink-muted">{children}</p>
          {failed ? (
            <p role="alert" className="m-0 text-[13px] text-brand-text">
              {title} non salvata. Riprova.
            </p>
          ) : null}
        </div>
      </WidgetCard>
    </section>
  )
}
