import * as React from 'react'
import { Progress as ProgressPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

function Progress({
  className,
  value,
  glow,
  tone = 'ink',
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { glow?: boolean; tone?: 'ink' | 'alert' }) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        'relative h-1.5 w-full rounded-bar bg-track',
        glow ? 'overflow-visible' : 'overflow-hidden',
        className,
      )}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          'h-full rounded-bar transition-[width]',
          tone === 'alert' ? 'bg-brand' : 'bg-ink',
          glow && 'shadow-[0_0_12px_var(--brand-glow-soft)]',
        )}
        style={{ width: `${value ?? 0}%` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
