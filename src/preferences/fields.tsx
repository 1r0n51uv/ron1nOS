import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

// Righe di Impostazioni con etichetta, spiegazione e controllo a destra,
// condivise da Aspetto (SET-003) e Formati (SET-010).
export function Row({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint: string
  error: boolean
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-t border-glass-border pt-4">
      <div className="flex flex-col gap-1">
        <span className="font-semibold">{label}</span>
        <span className="text-[13px] text-ink-muted">{hint}</span>
        {error ? (
          <span role="alert" className="text-sm text-brand-text">
            {label} non salvato · riprova
          </span>
        ) : null}
      </div>
      {children}
    </div>
  )
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: [T, string][]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex shrink-0 gap-1 rounded-full border border-glass-border bg-glass p-1"
    >
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={cn(
            'h-9 cursor-pointer rounded-full border-0 px-4 text-sm',
            value === id ? 'bg-glass-hover text-ink' : 'bg-transparent text-ink-muted hover:text-ink',
          )}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
