import * as React from 'react'
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-2.5 rounded-full font-mono whitespace-nowrap text-ink',
  {
    variants: {
      variant: {
        // Tag: etichetta maiuscola dentro un pannello.
        tag: 'self-start px-2.5 py-1 text-[11px] leading-[14px] font-medium tracking-[0.1em] uppercase glass-chip',
        // StatusPill: stato di un sistema, con il punto davanti.
        pill: 'h-12 bg-glass px-[18px] text-[13px] glass-chip',
        'pill-sm': 'h-9 bg-glass px-3 text-[11px] tracking-[0.08em] glass-chip',
      },
    },
    defaultVariants: {
      variant: 'tag',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'

  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
