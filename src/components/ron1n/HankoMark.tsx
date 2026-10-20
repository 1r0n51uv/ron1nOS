import { cn } from '@/lib/utils'

// Sigillo Hanko · Fasce: quadrato rosso, cornice, katana con il filo
// scheggiato, impugnatura a fasce, 浪 e 人 negli angoli, 龍 in filigrana.
const BLADE =
  'M12 38 Q220 45 400 42 L400 57 L394.7 57.1 L392.3 55.5 L389.9 57.1 L385.9 57.1 L381.3 55.8 L376.7 57.2 L372.6 57.2 L371.5 54 L369 57.2 L360.1 57.3 L356.1 55 L354.8 57.3 L346.4 57.3 L342.3 56.4 L336.6 57.3 L330.2 57.2 L328.7 56 L325.8 57.2 L316.6 57.2 L314.3 55.8 L312.2 57.1 L307.1 57.1 L302.3 52.5 L300.1 57 L295.9 57 L289.6 53 L286.8 56.9 L278.1 56.7 L275.4 53.2 L269.1 56.6 L262.9 56.5 L256.4 52.5 L253.4 56.3 L247.7 56.2 L243.2 53.2 L241.5 56 L236.1 55.9 L233.4 49.9 L232.3 55.8 L225.9 55.6 L223.4 52 L218.8 55.4 L211.4 55.2 L208.9 54.1 L203.8 55 L198.7 54.8 L194.7 51.4 L188.5 54.5 L185.4 54.4 L183.7 52.6 L181.4 54.2 L173.4 53.9 L169.6 51.8 L164.9 53.6 L154.3 53.1 L149.2 49.1 L143.8 52.7 L138.4 52.4 L136.9 51.4 L133 52.2 L123.9 51.7 L121.6 47.9 L114.8 51.3 L110.4 51.1 L108.9 48.5 L104.7 50.8 L99.6 50.5 L94.8 48.5 L89.6 49.9 L85.3 49.7 L82.7 46 L74.8 49.1 L70.8 48.8 L65.6 46.7 L61.1 48.2 L42 47 Q20 45 12 38 Z'

const STRIPES: [number, number][] = [
  [450, 41.5], [467, 41.5], [484, 41.5], [501, 41.5],
  [518, 41], [535, 41], [552, 41], [569, 40.5],
]

export function HankoMark({
  size = 36,
  inverted = false,
  decorative = false,
  title = 'Logo Ron1n',
  className,
}: {
  size?: number
  inverted?: boolean
  decorative?: boolean
  title?: string
  className?: string
}) {
  const base = inverted ? 'var(--on-brand)' : 'var(--brand)'
  const ink = inverted ? 'var(--brand)' : 'var(--on-brand)'
  const kanji = (opacity: number) => ({
    fill: ink,
    fillOpacity: opacity,
    fontFamily: 'var(--font-kanji)',
    fontWeight: 700,
  })

  return (
    <svg
      className={cn('block shrink-0', className)}
      width={size}
      height={size}
      viewBox="0 0 230 230"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : title}
    >
      <rect x={4} y={4} width={222} height={222} rx={28} style={{ fill: base }} />
      <text x={115} y={178} textAnchor="middle" fontSize={176} style={kanji(inverted ? 0.1 : 0.08)}>
        龍
      </text>
      <rect x={16} y={16} width={198} height={198} rx={18} strokeWidth={4} style={{ fill: 'none', stroke: ink }} />
      <g transform="translate(115 115) rotate(-45) scale(0.4 0.7) translate(-302 -49)">
        <path d={BLADE} style={{ fill: ink }} />
        <path d="M402 42 L413 41.5 L413 57 L402 57 Z" style={{ fill: ink }} />
        <ellipse cx={424} cy={49.5} rx={8.5} ry={23} style={{ fill: ink }} />
        <path d="M440 41.5 L582 40.5 L582 57.5 L440 57.5 Z" style={{ fill: ink }} />
        {STRIPES.map(([x, y]) => (
          <polygon key={x} points={`${x},${y} ${x + 7},${y} ${x + 1},57.5 ${x - 6},57.5`} style={{ fill: base }} />
        ))}
        <rect x={582} y={39.5} width={10} height={19} rx={3} style={{ fill: ink }} />
      </g>
      <text x={28} y={80} fontSize={46} style={kanji(1)}>
        浪
      </text>
      <text x={156} y={204} fontSize={46} style={kanji(1)}>
        人
      </text>
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display text-[20px] leading-6 font-bold tracking-[0.04em]', className)}>
      ron<span className="text-brand">1</span>nOS
    </span>
  )
}
