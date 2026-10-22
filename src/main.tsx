import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'

import { TooltipProvider } from '@/components/ui/tooltip'
import { isUnauthenticated, ME_KEY } from '@/auth/data'
import App from './App.tsx'
import './index.css'

const queryClient: QueryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  // Sessione scaduta mentre la pagina è aperta: si ricontrolla /auth/me e
  // RequireAuth porta al login.
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (isUnauthenticated(error) && query.queryKey !== ME_KEY) {
        void queryClient.invalidateQueries({ queryKey: ME_KEY })
      }
    },
  }),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
