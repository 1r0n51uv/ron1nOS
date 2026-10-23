import { useEffect } from 'react'
import { Outlet } from 'react-router'

import { NavRail } from '@/components/ron1n'
import { applyAppearance } from '@/preferences/appearance'
import { usePreferences } from '@/preferences/data'
import { visibleRailItems } from './nav'

// Layout desktop: NavRail a sinistra, contenuto a destra, filigrana 浪人 dietro.
export function AppShell() {
  // Le preferenze (SET-002) si caricano all'avvio, per tutte le pagine, e
  // l'aspetto (SET-003) segue ogni cambio.
  const prefs = usePreferences().data
  useEffect(() => {
    if (prefs) applyAppearance(prefs)
  }, [prefs])
  return (
    <div className="relative min-h-screen min-w-[1024px] overflow-x-clip">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-[120px] -right-10 font-kanji text-[520px] leading-none font-bold text-white/[0.035]"
      >
        浪人
      </div>

      <div className="relative flex gap-5 p-5">
        <NavRail items={visibleRailItems(prefs?.disabledModules ?? [], prefs?.navOrder)} />
        <main className="flex min-w-0 flex-1 flex-col gap-(--page-gap) px-2 pt-3 pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
