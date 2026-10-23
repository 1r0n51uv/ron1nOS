import type { ReactNode } from 'react'

import { Icon } from '@/components/ron1n'
import { cn } from '@/lib/utils'
import type { ExerciseImage } from '../data'

// La foto di un esercizio (GYM-014): in bianco e nero e scurita, così
// l'unico colore resta l'accento rosso, con il testo sopra su una
// sfumatura scura. Senza immagine, un riquadro neutro con l'icona della
// palestra e l'invito a sceglierla.
export function ExercisePhoto({
  name,
  image,
  className,
  compact = false,
  children,
}: {
  name: string
  image: ExerciseImage | null
  className?: string
  // Miniatura: senza immagine solo l'icona, senza etichetta.
  compact?: boolean
  children?: ReactNode
}) {
  return (
    <div className={cn('relative isolate overflow-hidden rounded-[16px] bg-glass-strong', className)}>
      {image ? (
        <img
          src={image.url}
          alt={name}
          loading="lazy"
          className="absolute inset-0 -z-10 size-full object-cover brightness-[0.55] grayscale"
        />
      ) : (
        <div className="absolute inset-0 -z-10 flex flex-col items-center justify-center gap-1.5 text-ink-muted">
          <Icon name="gym" size={compact ? 18 : 26} />
          {compact ? null : <span className="text-xs">Scegli immagine</span>}
        </div>
      )}
      {children ? (
        <div className="flex size-full flex-col justify-end bg-linear-to-t from-black/80 via-black/30 to-transparent p-3">
          {children}
        </div>
      ) : null}
    </div>
  )
}
