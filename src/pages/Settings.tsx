import type { ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, useParams } from 'react-router'

import { WidgetCard } from '@/components/ron1n'
import { AccountSection } from '@/auth/AccountSection'
import { IntegrationsSection } from '@/integrations/IntegrationsSection'
import { cn } from '@/lib/utils'
import { FoodsPanel } from '@/modules/nutrition/settings/FoodsPanel'
import { GoalsPanel } from '@/modules/nutrition/settings/GoalsPanel'
import { SupplementsPanel } from '@/modules/nutrition/settings/SupplementsPanel'
import { UnmatchedPanel } from '@/modules/nutrition/settings/UnmatchedPanel'
import { YazioPanel } from '@/modules/nutrition/settings/YazioPanel'
import { AppearanceSection } from '@/preferences/AppearanceSection'
import { StorageNotice } from '@/preferences/StorageNotice'
import { ModulesSection } from '@/preferences/ModulesSection'
import { DashboardPanel } from '@/widgets/DashboardPanel'
import { findSection, SECTIONS } from './settings/sections'

// Impostazioni (SET-001): a sinistra il menu delle sezioni, a destra una
// sezione alla volta. Le sezioni sono rotte figlie, vedi App.tsx.
export function Settings() {
  return (
    <>
      <div>
        <div className="eyebrow">ron1nOS</div>
        <h1 className="mt-1.5 mb-0 font-display text-[44px] leading-[48px] font-bold">Impostazioni</h1>
      </div>
      <StorageNotice />
      <div className="flex items-start gap-6">
        <nav aria-label="Sezioni delle impostazioni" className="flex w-[220px] shrink-0 flex-col gap-0.5">
          {SECTIONS.map((s) => (
            <NavLink
              key={s.id}
              to={`/impostazioni/${s.id}`}
              className={({ isActive }) =>
                cn(
                  'flex h-11 items-center rounded-[14px] px-3.5 text-sm no-underline',
                  isActive
                    ? 'bg-glass-strong font-semibold text-ink'
                    : 'text-ink-muted hover:bg-glass hover:text-ink',
                )
              }
            >
              {s.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex max-w-[920px] min-w-0 flex-1 flex-col gap-5">
          <Outlet />
        </div>
      </div>
    </>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="m-0 font-display text-[22px] font-semibold">{children}</h2>
}

// Una sezione dal suo indirizzo; un indirizzo sconosciuto riporta ad Aspetto.
export function SettingsSection() {
  const { section } = useParams()
  const found = findSection(section)
  if (!found) return <Navigate to="/impostazioni/aspetto" replace />
  return (
    <>
      <SectionTitle>{found.label}</SectionTitle>
      {found.id === 'aspetto' ? (
        <AppearanceSection />
      ) : found.id === 'dashboard' ? (
        <DashboardPanel />
      ) : found.id === 'moduli' ? (
        <ModulesSection />
      ) : found.id === 'integrazioni' ? (
        <IntegrationsSection />
      ) : found.id === 'account' ? (
        <AccountSection />
      ) : (
        <WidgetCard title="In arrivo">
          <p className="m-0 text-sm text-ink-muted">Questa sezione non ha ancora impostazioni.</p>
        </WidgetCard>
      )}
    </>
  )
}

// Moduli › Nutrizione: YAZIO, alimenti non abbinati, obiettivi, alimenti e integratori.
export function NutritionSettings() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <Link to="/impostazioni/moduli" className="text-sm text-ink-muted no-underline hover:text-ink">
          Moduli
        </Link>
        <SectionTitle>Nutrizione</SectionTitle>
      </div>
      <YazioPanel />
      <UnmatchedPanel />
      <GoalsPanel />
      <FoodsPanel />
      <SupplementsPanel />
    </>
  )
}
