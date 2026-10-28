import { cn } from '@/lib/utils'

export function SegmentedProgress({ total, done, label }: { total: number; done: number; label?: string }) {
  return (
    <div className="flex gap-1.5" role="img" aria-label={label ?? `${done} di ${total} completati`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-1 flex-1 rounded-[2px]',
            i < done ? 'bg-ink' : i === done ? 'bg-brand' : 'bg-track',
          )}
        />
      ))}
    </div>
  )
}

export function Metric({
  value,
  unit,
  delta,
  size = 'xl',
  className,
}: {
  value: string
  unit?: string
  delta?: string
  size?: 'xl' | 'md'
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline gap-2.5', className)}>
      <span
        className={cn(
          'font-mono font-semibold text-ink',
          size === 'md' ? 'text-[26px] leading-[30px]' : 'text-[40px] leading-[44px]',
        )}
      >
        {value}
      </span>
      {unit ? (
        <span className={cn('text-ink-muted', size === 'md' ? 'text-xs' : 'text-[15px]')}>{unit}</span>
      ) : null}
      {delta ? <span className="ml-auto font-mono text-sm text-ink-muted">{delta}</span> : null}
    </div>
  )
}

export function Sparkline({
  points,
  height = 84,
  ariaLabel = 'Andamento',
  className,
}: {
  points: number[]
  height?: number
  ariaLabel?: string
  className?: string
}) {
  const min = Math.min(...points)
  const span = Math.max(...points) - min || 1
  const n = Math.max(points.length - 1, 1)
  const poly = points
    .map((v, i) => `${((i / n) * 300).toFixed(1)},${(8 + (1 - (v - min) / span) * 84).toFixed(1)}`)
    .join(' ')

  return (
    <svg
      className={cn('block w-full', className)}
      height={height}
      viewBox="0 0 300 100"
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
    >
      <polyline
        points={poly}
        fill="none"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="stroke-ink"
      />
    </svg>
  )
}
