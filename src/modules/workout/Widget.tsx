import { useEffect, useState } from 'react'

import { SegmentedProgress, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { Button } from '@/components/ui/button'
import { clock, num } from '@/lib/format'
import { isFinished, useCompleteSet, useWorkout } from './data'

function useRestLeft(startedAt: number | null, seconds: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (startedAt == null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [startedAt])
  if (startedAt == null) return 0
  return Math.max(0, seconds - Math.floor((now - startedAt) / 1000))
}

export function WorkoutWidget({ className }: { className?: string }) {
  const { data } = useWorkout()
  const complete = useCompleteSet()
  const restLeft = useRestLeft(data?.restStartedAt ?? null, data?.restSeconds ?? 0)

  if (!data) return <WidgetSkeleton title="Allenamento" className={className} />

  const done = isFinished(data)
  const ex = data.exercises[data.current]

  return (
    <WidgetCard title="Allenamento" meta={data.plan} className={className}>
      {done || !ex ? (
        <div className="text-lg font-semibold">Allenamento completato</div>
      ) : (
        <>
          <div>
            <div className="text-[13px] text-ink-muted">In corso</div>
            <div className="mt-0.5 text-[22px] font-semibold">{ex.name}</div>
            <div className="mt-0.5 font-mono text-[13px] text-ink-muted">
              serie {data.set} di {ex.sets} · {num(ex.weightKg)} kg
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-ink-muted">Riposo</div>
              <div className="font-mono text-[32px] leading-9 font-semibold">
                {clock(restLeft)}
              </div>
            </div>
            <Button onClick={() => complete.mutate()} disabled={complete.isPending}>
              Serie fatta
            </Button>
          </div>
        </>
      )}
      <SegmentedProgress total={data.exercises.length} done={data.current} label="Esercizi completati" />
    </WidgetCard>
  )
}
