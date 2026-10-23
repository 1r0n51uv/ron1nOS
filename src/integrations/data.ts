import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { Integration, IntegrationId } from '../../server/integrations.ts'

// Servizi esterni (SET-009): GET /api/v1/integrations e
// POST /api/v1/integrations/{id}/check, contratto in api/openapi.yaml.
export type { Integration, IntegrationId }

export function getIntegrations() {
  return api.get<{ integrations: Integration[] }>('/integrations').then((r) => r.integrations)
}

export function checkIntegration(id: IntegrationId) {
  return api.post<Integration>(`/integrations/${id}/check`)
}

// La sorgente passa da un oggetto così i test possono sostituirla.
export const source = { getIntegrations, checkIntegration }

const key = ['integrations']

export function useIntegrations() {
  return useQuery({ queryKey: key, queryFn: () => source.getIntegrations() })
}

// `Verifica`: la riga si aggiorna con il controllo appena fatto.
export function useCheckIntegration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: IntegrationId) => source.checkIntegration(id),
    onSuccess: (fresh) =>
      queryClient.setQueryData<Integration[]>(key, (list) =>
        list?.map((i) => (i.id === fresh.id ? fresh : i)),
      ),
  })
}
