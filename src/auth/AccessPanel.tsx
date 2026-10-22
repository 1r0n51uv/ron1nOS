import { useNavigate } from 'react-router'

import { WidgetCard } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { useLogout, useMe } from './data'

// Accesso in Impostazioni (AUTH-001, AUTH-002): Esci da questo browser o
// da tutti. Con il login spento non compare.
export function AccessPanel() {
  const { data } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()
  if (!data?.enabled) return null

  const out = (everywhere: boolean) =>
    logout.mutate(everywhere, { onSuccess: () => navigate('/login', { replace: true }) })

  return (
    <section aria-label="Accesso">
      <WidgetCard title="Accesso">
        <div className="flex flex-col gap-4">
          <p className="m-0 text-sm text-ink-muted">
            La sessione dura 30 giorni e si rinnova a ogni uso. Esci ovunque chiude anche gli altri browser.
          </p>
          <div className="flex gap-2">
            <Button variant="glass" size="sm" disabled={logout.isPending} onClick={() => out(false)}>
              Esci
            </Button>
            <Button variant="glass" size="sm" disabled={logout.isPending} onClick={() => out(true)}>
              Esci ovunque
            </Button>
          </div>
        </div>
      </WidgetCard>
    </section>
  )
}
