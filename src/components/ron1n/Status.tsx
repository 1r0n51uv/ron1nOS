import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Gli stati non si leggono solo dal colore: OK è un punto tondo chiaro,
// problema è un quadratino rosso.
export function StatusDot({ tone = 'ok', className }: { tone?: 'ok' | 'alert'; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'size-2 shrink-0',
        tone === 'alert' ? 'rounded-[2px] bg-brand' : 'rounded-full bg-ink',
        className,
      )}
    />
  )
}

export function StatusPill({
  tone = 'ok',
  size = 'default',
  children,
}: {
  tone?: 'ok' | 'alert'
  size?: 'default' | 'small'
  children: ReactNode
}) {
  return (
    <Badge variant={size === 'small' ? 'pill-sm' : 'pill'}>
      <StatusDot tone={tone} />
      {children}
    </Badge>
  )
}

export function AlertRow({
  title,
  body,
  actionLabel,
  onAction,
  pending,
}: {
  title: string
  body?: string
  actionLabel?: string
  onAction?: () => void
  pending?: boolean
}) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-[18px] border border-brand-line bg-brand-tint-faint px-3.5 py-3"
    >
      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[2px] bg-brand" />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-sm leading-[18px] text-ink">{title}</div>
        {body ? <div className="text-xs leading-4 text-ink-muted">{body}</div> : null}
      </div>
      {actionLabel ? (
        <Button variant="glass" size="sm" onClick={onAction} disabled={pending}>
          {pending ? 'Avvio…' : actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

export function ToggleTile({
  name,
  meta,
  on,
  onChange,
}: {
  name: string
  meta?: string
  on: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cn(
        'flex min-h-24 w-full cursor-pointer flex-col items-start gap-2.5 rounded-tile border p-3.5 text-left font-sans text-ink shadow-[inset_0_1px_0_var(--glass-highlight)] transition-colors',
        on ? 'border-brand-line bg-brand-tint' : 'border-glass-border bg-glass hover:bg-glass-strong',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-2.5 rounded-full',
          on ? 'bg-brand' : 'bg-glass-hover shadow-[inset_0_0_0_1px_var(--ink-muted)]',
        )}
      />
      <span className="text-sm leading-[18px] font-semibold">{name}</span>
      {meta ? <span className="text-xs leading-4 text-ink-muted">{meta}</span> : null}
    </button>
  )
}
