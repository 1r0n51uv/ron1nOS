import { Route, Routes } from 'react-router'

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
import { Settings } from '@/pages/Settings'
import { WorkoutPage } from '@/modules/workout/page/WorkoutPage'

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="pasti" element={<MealsPage />} />
          <Route path="pasti/ricette" element={<RecipesPage />} />
          <Route path="pasti/template" element={<TemplatesPage />} />
          <Route path="pasti/andamento" element={<ReportPage />} />
          <Route path="allenamenti" element={<WorkoutPage />} />
          <Route path="documenti" element={<DocumentsPage />} />
          <Route path="documenti/tipi" element={<TypesPage />} />
          <Route path="documenti/:id" element={<DocumentPage />} />
          <Route path="note" element={<ComingSoon title="Note" />} />
          <Route path="casa" element={<ComingSoon title="Casa" />} />
          <Route path="server" element={<ComingSoon title="Server e container" />} />
          <Route path="impostazioni" element={<Settings />} />
          <Route path="*" element={<ComingSoon title="Pagina non trovata" />} />
        </Route>
      </Route>
    </Routes>
  )
}
