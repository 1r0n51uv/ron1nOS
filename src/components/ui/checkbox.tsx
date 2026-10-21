import * as React from 'react'
import { CheckIcon, MinusIcon } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

// Casella del mockup: piena in rosso se scelta, bordo rosso con il meno
// se parziale (checked="indeterminate").
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer grid size-[18px] shrink-0 cursor-pointer place-content-center rounded-[5px] border-[1.5px] border-white/35 bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-brand-line disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-on-brand data-[state=indeterminate]:border-brand data-[state=indeterminate]:text-brand',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="group grid place-content-center">
        <CheckIcon className="size-3 stroke-3 group-data-[state=indeterminate]:hidden" />
        <MinusIcon className="hidden size-3 stroke-3 group-data-[state=indeterminate]:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
