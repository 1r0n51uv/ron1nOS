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
        tag: 'glass-chip self-start px-2.5 py-1 text-[11px] leading-[14px] font-medium tracking-[0.1em] uppercase',
        // StatusPill: stato di un sistema, con il punto davanti.
        pill: 'glass-chip h-12 bg-glass px-[18px] text-[13px]',
        'pill-sm': 'glass-chip h-9 bg-glass px-3 text-[11px] tracking-[0.08em]',
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
