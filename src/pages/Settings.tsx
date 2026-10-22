import { FoodsPanel } from '@/modules/nutrition/settings/FoodsPanel'
import { GoalsPanel } from '@/modules/nutrition/settings/GoalsPanel'
import { SupplementsPanel } from '@/modules/nutrition/settings/SupplementsPanel'
import { UnmatchedPanel } from '@/modules/nutrition/settings/UnmatchedPanel'
import { YazioPanel } from '@/modules/nutrition/settings/YazioPanel'

// Impostazioni: per ora quelle del modulo Nutrizione.
export function Settings() {
  return (
    <>
      <div>
        <div className="eyebrow">ron1nOS</div>
        <h1 className="mt-1.5 mb-0 font-display text-[44px] leading-[48px] font-bold">Impostazioni</h1>
      </div>
      <div className="flex max-w-[960px] flex-col gap-5">
        <YazioPanel />
        <UnmatchedPanel />
        <GoalsPanel />
        <FoodsPanel />
        <SupplementsPanel />
      </div>
    </>
  )
}
