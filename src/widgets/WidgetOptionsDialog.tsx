import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { LayoutItem } from './layout'
import type { OptionValue, WidgetDef, WidgetOption, WidgetVariant } from './types'
import { resolveOptions } from '../../server/dashboard/catalog.ts'

const VARIANT_LABELS: Record<WidgetVariant, string> = { detailed: 'Dettagliata', compact: 'Compatta' }

// Pannello `Opzioni` del widget (DASH-005): anteprima dal vivo, variante e
// dati mostrati. Ogni scelta vale subito e si salva con il layout.
export function WidgetOptionsDialog({
  item,
  widget,
  onChange,
  onClose,
}: {
  item: LayoutItem
  widget: WidgetDef
  onChange: (item: LayoutItem) => void
  onClose: () => void
}) {
  const variant = item.variant ?? widget.variants[0]
  const options = resolveOptions(widget, item.options)
  const declared = widget.options ?? []
  const set = (key: string, value: OptionValue) =>
    onChange({ ...item, options: { ...item.options, [key]: value } })
  const { min, max } = widget.size

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-w-[880px]">
        <DialogHeader className="flex-row items-baseline gap-3">
          <DialogTitle className="text-[26px]">Opzioni · {widget.title}</DialogTitle>
          <span className="font-mono text-[13px] text-ink-muted">{widget.id}</span>
          <DialogDescription className="sr-only">Variante e dati mostrati dal widget.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-8">
          <div className="flex w-[360px] shrink-0 flex-col">
            <p className="mt-0 mb-2 text-[13px] text-ink-muted">Anteprima</p>
            <div
              aria-hidden="true"
              inert
              data-testid="widget-preview"
              className="pointer-events-none flex overflow-hidden"
              style={{ height: Math.min(item.h * 40 - 16, 440) }}
            >
              <widget.component
                className="min-h-0 flex-1 overflow-hidden"
                variant={variant}
                options={options}
              />
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            {widget.variants.length > 1 && variant ? (
              <Field label="Variante">
                <div role="radiogroup" aria-label="Variante" className="flex flex-wrap gap-2">
                  {widget.variants.map((v) => (
                    <Chip key={v} on={variant === v} onClick={() => onChange({ ...item, variant: v })}>
                      {VARIANT_LABELS[v]}
                    </Chip>
                  ))}
                </div>
              </Field>
            ) : null}
            {declared.map((option) => (
              <OptionField key={option.key} option={option} value={options[option.key]} onChange={set} />
            ))}
            {widget.variants.length <= 1 && declared.length === 0 ? (
              <p className="m-0 text-sm text-ink-muted">Questo widget non ha altre opzioni.</p>
            ) : null}
            <Field label="Dimensione">
              <p className="m-0 text-sm">
                <span className="font-mono">
                  {item.w} × {item.h}
                </span>{' '}
                <span className="text-ink-muted">
                  · da{' '}
                  <span className="font-mono">
                    {min.w} × {min.h}
                  </span>{' '}
                  a{' '}
                  <span className="font-mono">
                    {max.w} × {max.h}
                  </span>
                  , si cambia trascinando l’angolo del widget
                </span>
              </p>
            </Field>
          </div>
        </div>
        <div className="flex justify-between gap-3">
          <Button
            variant="glass"
            onClick={() => onChange({ id: item.id, x: item.x, y: item.y, w: item.w, h: item.h })}
          >
            Ripristina predefinite
          </Button>
          <Button variant="glass" onClick={onClose}>
            Fatto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[13px] text-ink-muted">{label}</p>
      {children}
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'min-h-9 cursor-pointer rounded-full px-3.5 text-[13px] glass-chip',
        on ? 'border-brand-line text-brand-text' : 'text-ink-muted hover:bg-glass-hover',
      )}
    >
      {children}
    </button>
  )
}

function OptionField({
  option,
  value,
  onChange,
}: {
  option: WidgetOption
  value: OptionValue | undefined
  onChange: (key: string, value: OptionValue) => void
}) {
  if (option.type === 'choice') {
    return (
      <Field label={option.label}>
        <div role="radiogroup" aria-label={option.label} className="flex flex-wrap gap-2">
          {option.choices.map((c) => (
            <Chip key={c.value} on={value === c.value} onClick={() => onChange(option.key, c.value)}>
              {c.label}
            </Chip>
          ))}
        </div>
      </Field>
    )
  }
  if (option.type === 'multi') {
    const picked = (value as readonly string[] | undefined) ?? option.default
    return (
      <Field label={option.label}>
        <div role="group" aria-label={option.label} className="flex flex-col gap-2.5">
          {option.choices.map((c) => (
            <label key={c.value} className="flex cursor-pointer items-center gap-3 text-sm">
              <Checkbox
                checked={picked.includes(c.value)}
                onCheckedChange={(checked) =>
                  onChange(
                    option.key,
                    // Nell'ordine del catalogo, non in quello dei clic.
                    option.choices
                      .map((x) => x.value)
                      .filter((v) => (v === c.value ? checked === true : picked.includes(v))),
                  )
                }
              />
              {c.label}
            </label>
          ))}
        </div>
      </Field>
    )
  }
  const count = (value as number | undefined) ?? option.default
  return (
    <Field label={option.label}>
      <div className="flex items-center gap-3">
        <Button
          variant="glass"
          size="icon"
          aria-label={`${option.label}: uno in meno`}
          disabled={count <= option.min}
          onClick={() => onChange(option.key, count - 1)}
        >
          −
        </Button>
        <output aria-label={option.label} className="w-8 text-center font-mono text-lg">
          {count}
        </output>
        <Button
          variant="glass"
          size="icon"
          aria-label={`${option.label}: uno in più`}
          disabled={count >= option.max}
          onClick={() => onChange(option.key, count + 1)}
        >
          +
        </Button>
      </div>
    </Field>
  )
}
