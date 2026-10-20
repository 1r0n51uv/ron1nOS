import { Route, Routes } from 'react-router'

import { AppShell } from '@/layout/AppShell'
import { ComingSoon } from '@/pages/ComingSoon'
import { Dashboard } from '@/pages/Dashboard'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="pasti" element={<ComingSoon title="Pasti" />} />
        <Route path="allenamenti" element={<ComingSoon title="Allenamenti" />} />
        <Route path="note" element={<ComingSoon title="Note" />} />
        <Route path="casa" element={<ComingSoon title="Casa" />} />
        <Route path="server" element={<ComingSoon title="Server e container" />} />
        <Route path="impostazioni" element={<ComingSoon title="Impostazioni" />} />
        <Route path="*" element={<ComingSoon title="Pagina non trovata" />} />
      </Route>
    </Routes>
  )
}
