import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

// Pulsante a pillola con stato premuto: filtri, tipi, preavvisi.
export function Chip({
  pressed,
  onClick,
  children,
  small,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
  small?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-full border font-sans',
        small ? 'h-8 px-3 text-[13px]' : 'h-9 px-3.5 text-[13px]',
        pressed
          ? 'border-brand-line bg-glass-strong text-ink'
          : 'border-glass-border bg-transparent text-ink-muted hover:bg-glass-hover',
      )}
    >
      {children}
    </button>
  )
}
