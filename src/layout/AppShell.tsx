import { Outlet } from 'react-router'

import { NavRail } from '@/components/ron1n'
import { railItems } from './nav'

// Layout desktop: NavRail a sinistra, contenuto a destra, filigrana 浪人 dietro.
export function AppShell() {
  return (
    <div className="relative min-h-screen min-w-[1024px] overflow-x-clip">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-[120px] -right-10 font-kanji text-[520px] leading-none font-bold text-white/[0.035]"
      >
        浪人
      </div>

      <div className="relative flex gap-5 p-5">
        <NavRail items={railItems} />
        <main className="flex min-w-0 flex-1 flex-col gap-7 px-2 pt-3 pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
