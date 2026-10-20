import { cn } from '@/lib/utils'

// Anello di avanzamento. `size` fissa le proporzioni del disegno; la misura
// a schermo si può cambiare con className (per esempio più piccolo su iOS).
export function ProgressRing({
  value,
  max = 100,
  size = 132,
  tone = 'brand',
  label,
  sublabel,
  caption,
  ariaLabel,
  className,
}: {
  value: number
  max?: number
  size?: number
  tone?: 'brand' | 'ink'
  label?: string
  sublabel?: string
  caption?: string
  ariaLabel?: string
  className?: string
}) {
  const stroke = Math.round(size * 0.09)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(value, max))
  const mid = size / 2
  const labelSize = Math.round(size * (sublabel ? 0.2 : 0.19))

  const svg = (
    <svg
      className={cn('block shrink-0', className)}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={ariaLabel ?? `${label ?? v} su ${max}`}
    >
      <circle cx={mid} cy={mid} r={r} strokeWidth={stroke} className="fill-none stroke-track" />
      <circle
        cx={mid}
        cy={mid}
        r={r}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${((c * v) / max).toFixed(1)} ${c.toFixed(1)}`}
        transform={`rotate(-90 ${mid} ${mid})`}
        className={cn(
          'fill-none transition-[stroke-dasharray] duration-500',
          tone === 'ink' ? 'stroke-ink' : 'stroke-brand',
        )}
      />
      <text
        x={mid}
        y={sublabel ? mid : mid + labelSize * 0.35}
        textAnchor="middle"
        fontSize={labelSize}
        className="fill-ink font-mono font-semibold"
      >
        {label ?? String(v)}
      </text>
      {sublabel ? (
        <text
          x={mid}
          y={mid + size * 0.15}
          textAnchor="middle"
          fontSize={Math.max(10, Math.round(size * 0.085))}
          className="fill-ink-muted font-mono"
        >
          {sublabel}
        </text>
      ) : null}
    </svg>
  )

  if (!caption) return svg
  return (
    <div>
      {svg}
      <span className="mt-1 block text-center text-xs text-ink-muted">{caption}</span>
    </div>
  )
}
