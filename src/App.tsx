import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router'

import { LoginPage } from '@/auth/LoginPage'
import { RequireAuth } from '@/auth/RequireAuth'
import { AppShell } from '@/layout/AppShell'
import { ComingSoon } from '@/pages/ComingSoon'
import { DocumentPage } from '@/modules/documents/DocumentPage'
import { DocumentsPage } from '@/modules/documents/DocumentsPage'
import { TypesPage } from '@/modules/documents/TypesPage'
import { MealsPage } from '@/modules/nutrition/page/MealsPage'
import { RecipesPage } from '@/modules/nutrition/recipes/RecipesPage'
import { ReportPage } from '@/modules/nutrition/report/ReportPage'
import { TemplatesPage } from '@/modules/nutrition/templates/TemplatesPage'
import { Dashboard } from '@/pages/Dashboard'
import { NutritionSettings, Settings, SettingsSection } from '@/pages/Settings'
import { WorkoutPage } from '@/modules/workout/page/WorkoutPage'
import { ExercisePage } from '@/modules/workout/exercise/ExercisePage'
import { ExerciseListPage } from '@/modules/workout/list/ExerciseListPage'
import { SessionPage } from '@/modules/workout/session/SessionPage'
import { ModuleGate } from '@/preferences/ModuleGate'
import type { ModuleId } from '../server/dashboard/catalog.ts'

// Le pagine dei moduli spenti (SET-005) mostrano `Modulo spento`.
const gate = (module: ModuleId, title: string, page: ReactElement) => (
  <ModuleGate module={module} title={title}>
    {page}
  </ModuleGate>
)

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="pasti" element={gate('nutrition', 'Pasti', <MealsPage />)} />
          <Route path="pasti/ricette" element={gate('nutrition', 'Pasti', <RecipesPage />)} />
          <Route path="pasti/template" element={gate('nutrition', 'Pasti', <TemplatesPage />)} />
          <Route path="pasti/andamento" element={gate('nutrition', 'Pasti', <ReportPage />)} />
          <Route path="allenamenti" element={gate('workout', 'Allenamenti', <WorkoutPage />)} />
          <Route path="allenamenti/sessioni/:id" element={gate('workout', 'Allenamenti', <SessionPage />)} />
          <Route path="allenamenti/esercizi" element={gate('workout', 'Allenamenti', <ExerciseListPage />)} />
          <Route
            path="allenamenti/esercizi/:name"
            element={gate('workout', 'Allenamenti', <ExercisePage />)}
          />
          <Route path="documenti" element={gate('documents', 'Documenti', <DocumentsPage />)} />
          <Route path="documenti/tipi" element={gate('documents', 'Documenti', <TypesPage />)} />
          <Route path="documenti/:id" element={gate('documents', 'Documenti', <DocumentPage />)} />
          <Route path="note" element={gate('notes', 'Note', <ComingSoon title="Note" />)} />
          <Route path="casa" element={gate('home', 'Casa', <ComingSoon title="Casa" />)} />
          <Route
            path="server"
            element={gate('server', 'Server e container', <ComingSoon title="Server e container" />)}
          />
          <Route path="impostazioni" element={<Settings />}>
            <Route index element={<Navigate to="aspetto" replace />} />
            <Route path="moduli/nutrizione" element={<NutritionSettings />} />
            <Route path=":section" element={<SettingsSection />} />
          </Route>
          <Route path="*" element={<ComingSoon title="Pagina non trovata" />} />
        </Route>
      </Route>
    </Routes>
  )
}
