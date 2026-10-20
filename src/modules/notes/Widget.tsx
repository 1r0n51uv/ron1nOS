import { WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { Badge } from '@/components/ui/badge'
import { usePinnedNote } from './data'

export function NotesWidget({ className }: { className?: string }) {
  const { data, isPending } = usePinnedNote()
  if (isPending) return <WidgetSkeleton title="Nota fissata" className={className} />

  return (
    <WidgetCard title="Nota fissata" action={{ label: '+ Nuova', to: '/note' }} className={className}>
      {data ? (
        <>
          <div className="text-lg font-semibold">{data.title}</div>
          <p className="m-0 text-sm leading-[1.6] text-ink-muted">{data.body}</p>
          <div className="flex flex-wrap gap-2">
            {data.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
        </>
      ) : (
        <div className="text-sm text-ink-muted">Nessuna nota fissata.</div>
      )}
    </WidgetCard>
  )
}
