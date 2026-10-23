import { cn } from '@/lib/utils'

// Una scelta tra poche voci, come chip: la scelta è in rosso.
export function RadioChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-8 cursor-pointer rounded-full px-3 text-[13px] glass-chip',
            value === o.value ? 'border-brand-line text-brand-text' : 'text-ink-muted hover:bg-glass-hover',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
