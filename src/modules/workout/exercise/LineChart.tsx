import { shortDay } from '@/lib/format'
import { cn } from '@/lib/utils'

// Grafico a linea di un esercizio (GYM-008): un punto per sessione, il
// più alto in rosso. Sotto, primo e ultimo giorno; a sinistra massimo e
// minimo già formattati.
export function LineChart({
  points,
  format,
  label,
  height = 200,
}: {
  points: { sessionId: string; day: string; value: number }[]
  format: (value: number) => string
  label: string
  height?: number
}) {
  if (!points.length) {
    return <div className="text-sm text-ink-muted">Nessuna sessione nel periodo.</div>
  }
  const values = points.map((p) => p.value)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const n = Math.max(points.length - 1, 1)
  const xy = points.map((p, i) => ({
    x: points.length === 1 ? 300 : (i / n) * 600,
    y: 10 + (1 - (p.value - min) / span) * 180,
    top: p.value === max,
  }))
  const first = points[0]!
  const last = points.at(-1)!

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        <div className="flex flex-col justify-between py-1 text-right font-mono text-xs text-ink-muted">
          <span>{format(max)}</span>
          <span>{format(min)}</span>
        </div>
        <div className="relative flex-1" style={{ height }}>
          <svg
            className="absolute inset-0 block size-full"
            viewBox="0 0 600 200"
            preserveAspectRatio="none"
            role="img"
            aria-label={`${label}: da ${format(first.value)} a ${format(last.value)}, massimo ${format(max)}`}
          >
            <polyline
              points={xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="stroke-ink/60"
            />
          </svg>
          {/* I punti fuori dall'SVG, così restano tondi a ogni larghezza. */}
          {xy.map((p, i) => (
            <span
              key={points[i]!.sessionId}
              aria-hidden="true"
              className={cn(
                'absolute -translate-1/2 rounded-full',
                p.top ? 'size-2.5 bg-brand' : 'size-1.5 bg-ink',
              )}
              style={{ left: `${(p.x / 600) * 100}%`, top: `${(p.y / 200) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-between pl-12 font-mono text-xs text-ink-muted">
        <span>{shortDay(first.day)}</span>
        {points.length > 1 ? <span>{shortDay(last.day)}</span> : null}
      </div>
    </div>
  )
}
