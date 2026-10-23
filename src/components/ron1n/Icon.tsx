import { cn } from '@/lib/utils'

// Set di icone del design system: griglia 24, tratto 1,8, estremità tonde.
const ICONS = {
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  meals: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-3 4-3 7h3v11',
  gym: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12',
  notes: 'M5 3h10l4 4v14H5zM9 12h6M9 16h6',
  home: 'M3 11l9-7 9 7v10H3zM10 21v-6h4v6',
  light: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
  server: 'M3 4h18v7H3zM3 13h18v7H3zM7 7.5h.01M7 16.5h.01',
  settings:
    'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 21a2 2 0 0 0 4 0',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-3.5-3.5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  play: 'M7 4l13 8-13 8z',
  check: 'M20 6L9 17l-5-5',
  restart: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
  download: 'M12 4v12M7 11l5 5 5-5M5 20h14',
  container: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  documents: 'M3 5h18v14H3zM7 10h4M7 14h10M15 9h2v2h-2z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  close: 'M6 6l12 12M18 6L6 18',
} as const

export type IconName = keyof typeof ICONS

export function Icon({
  name,
  size = 22,
  label,
  className,
}: {
  name: IconName
  size?: number
  label?: string
  className?: string
}) {
  return (
    <svg
      className={cn('block shrink-0', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={ICONS[name]} />
    </svg>
  )
}
