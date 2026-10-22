import { Navigate, Outlet, useLocation } from 'react-router'

import { isUnauthenticated, useMe } from './data'

// Senza sessione valida ogni pagina porta a /login e poi si torna qui
// (AUTH-001). Con il backend spento la dashboard si mostra lo stesso:
// ogni widget dice il suo errore.
export function RequireAuth() {
  const { error, isPending } = useMe()
  const location = useLocation()
  if (isPending) return null
  if (isUnauthenticated(error)) {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />
  }
  return <Outlet />
}
