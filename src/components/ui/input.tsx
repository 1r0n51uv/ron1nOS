import * as React from 'react'

import { cn } from '@/lib/utils'

// Campo di testo in vetro, come nel wizard Aggiungi e nei mockup Nutrizione.
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'min-h-11 w-full min-w-0 rounded-[14px] border border-glass-border bg-glass-strong px-3.5 text-[15px] text-ink outline-none placeholder:text-ink-muted/60 focus-visible:border-brand-line disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-brand-line',
        type === 'number' &&
          '[appearance:textfield] font-mono [&::-webkit-inner-spin-button]:appearance-none',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
