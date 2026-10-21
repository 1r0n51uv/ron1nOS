import * as React from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col gap-4', className)} {...props} />
}

// Pillola di vetro con le schede dentro, come nei mockup del wizard.
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'inline-flex w-fit gap-1 rounded-full border border-glass-border bg-glass p-1',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'min-h-10 cursor-pointer rounded-full border border-transparent bg-transparent px-5 font-sans text-sm font-medium text-ink-muted transition-[background,color] outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-line disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-glass-border data-[state=active]:bg-glass-hover data-[state=active]:text-ink',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content data-slot="tabs-content" className={cn('outline-none', className)} {...props} />
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
