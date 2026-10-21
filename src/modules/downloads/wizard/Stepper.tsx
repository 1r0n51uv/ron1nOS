import { cn } from '@/lib/utils'
import { STEPS } from './steps'

// Quattro segmenti: fatti in bianco, quello corrente in rosso, gli altri spenti.
export function Stepper({ current }: { current: number }) {
  return (
    <ol className="m-0 grid list-none grid-cols-4 gap-2 p-0" aria-label="Passi">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-col gap-1.5" aria-current={i === current ? 'step' : undefined}>
          <div
            className={cn(
              'h-1 rounded-[3px]',
              i < current ? 'bg-ink' : i === current ? 'bg-brand' : 'bg-track',
            )}
          />
          <span className={cn('text-xs', i === current ? 'text-ink' : 'text-ink-muted')}>{label}</span>
        </li>
      ))}
    </ol>
  )
}
