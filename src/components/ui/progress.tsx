import * as React from 'react'
import { Progress as ProgressPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

function Progress({
  className,
  value,
  glow,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { glow?: boolean }) {
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
          'h-full rounded-bar bg-brand transition-[width]',
          glow && 'shadow-[0_0_12px_var(--brand-glow-soft)]',
        )}
        style={{ width: `${value ?? 0}%` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
