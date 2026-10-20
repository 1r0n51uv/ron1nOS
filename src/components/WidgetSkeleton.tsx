import { WidgetCard } from '@/components/ron1n'
import { Skeleton } from '@/components/ui/skeleton'

export function WidgetSkeleton({ title, className }: { title: string; className?: string }) {
  return (
    <WidgetCard title={title} className={className}>
      <div aria-busy="true" aria-label={`${title}: caricamento`} className="flex flex-col gap-3">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </WidgetCard>
  )
}
