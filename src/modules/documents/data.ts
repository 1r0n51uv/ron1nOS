import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, ApiError } from '@/lib/api'

// Modulo Documenti (docs/specs/documents.md). Le rotte stanno sotto
// /api/v1/documents; la logica (validazione, cambio di tipo, scadenze) è
// tutta nel backend.
const BASE = '/documents'

export type FieldKind = 'text' | 'date' | 'code'
export type TypeField = { key: string; label: string; kind: FieldKind; copyable: boolean }

export type DocumentType = {
  id: string
  key: string | null
  name: string
  icon: string
  preset: boolean
  fields: TypeField[]
  documents: number
}

export type Expiry = { status: 'ok' | 'expiring' | 'expired'; daysLeft: number } | null

export type ExtraField = { label: string; value: string }

export type FileLabel = 'fronte' | 'retro' | 'pagina' | 'altro'
export const FILE_LABELS: FileLabel[] = ['fronte', 'retro', 'pagina', 'altro']

export type DocumentFile = {
  id: string
  name: string
  mime: string
  size: number
  label: FileLabel
  position: number
  hasThumb: boolean
  createdAt: string
}

export type DocumentSummary = {
  id: string
  typeId: string | null
  typeName: string | null
  typeIcon: string | null
  title: string
  holder: string
  expiresOn: string | null
  expiry: Expiry
  tags: string[]
  pinnedAt: string | null
  files: number
  thumbFileId: string | null
  firstFile: { mime: string; size: number } | null
  updatedAt: string
}

export type Document = {
  id: string
  typeId: string | null
  type: Pick<DocumentType, 'id' | 'name' | 'icon' | 'fields'> | null
  title: string
  holder: string
  expiresOn: string | null
  expiry: Expiry
  warnings: number[]
  tags: string[]
  pinnedAt: string | null
  fields: Record<string, string>
  extra: ExtraField[]
  notes: string
  files: DocumentFile[]
  createdAt: string
  updatedAt: string
}

export type DocumentInput = {
  typeId: string | null
  title: string
  holder: string
  expiresOn: string | null
  warnings: number[]
  tags: string[]
  pinned: boolean
  fields: Record<string, string>
  extra: ExtraField[]
  notes: string
}

export type DocumentFilter = { q?: string; type?: string; holder?: string }

const query = (filter: DocumentFilter) => {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filter)) if (v) params.set(k, v)
  const s = params.toString()
  return s ? `?${s}` : ''
}

// Indirizzo di un allegato: inline per l'anteprima, download per scaricarlo.
export function fileUrl(
  documentId: string,
  fileId: string,
  opts: { thumb?: boolean; download?: boolean } = {},
) {
  const params = new URLSearchParams()
  if (opts.thumb) params.set('variant', 'thumb')
  if (opts.download) params.set('download', '1')
  const s = params.toString()
  return `/api/v1${BASE}/documents/${documentId}/files/${fileId}${s ? `?${s}` : ''}`
}

// Caricamento con avanzamento (DOC-011): fetch non lo dà, XMLHttpRequest sì.
function uploadFile(documentId: string, file: File, label: FileLabel, onProgress?: (ratio: number) => void) {
  return new Promise<DocumentFile>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/v1${BASE}/documents/${documentId}/files`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    xhr.onload = () => {
      let body: Record<string, unknown> = {}
      try {
        body = JSON.parse(xhr.responseText) as Record<string, unknown>
      } catch {
        // risposta senza JSON
      }
      if (xhr.status === 201) resolve(body as DocumentFile)
      else
        reject(
          new ApiError(
            String(body.error ?? 'http_error'),
            String(body.message ?? `HTTP ${xhr.status}`),
            xhr.status,
            body,
          ),
        )
    }
    xhr.onerror = () => reject(new ApiError('network', 'Backend non raggiungibile', 0))
    const form = new FormData()
    form.append('file', file)
    form.append('label', label)
    xhr.send(form)
  })
}

export const documentsSource = {
  types: () => api.get<DocumentType[]>(`${BASE}/types`),
  holders: () => api.get<string[]>(`${BASE}/holders`),
  list: (filter: DocumentFilter) => api.get<DocumentSummary[]>(`${BASE}/documents${query(filter)}`),
  get: (id: string) => api.get<Document>(`${BASE}/documents/${id}`),
  create: (input: Partial<DocumentInput>) => api.post<Document>(`${BASE}/documents`, input),
  update: (id: string, patch: Partial<DocumentInput>) =>
    api.patch<Document>(`${BASE}/documents/${id}`, patch),
  remove: (id: string) => api.delete<void>(`${BASE}/documents/${id}`),
  upload: uploadFile,
  updateFile: (id: string, fileId: string, patch: { label?: FileLabel; position?: number }) =>
    api.patch<DocumentFile>(`${BASE}/documents/${id}/files/${fileId}`, patch),
  removeFile: (id: string, fileId: string) => api.delete<void>(`${BASE}/documents/${id}/files/${fileId}`),
}

const KEY = ['documents']

export function useDocumentTypes() {
  return useQuery({ queryKey: [...KEY, 'types'], queryFn: () => documentsSource.types() })
}

export function useHolders() {
  return useQuery({ queryKey: [...KEY, 'holders'], queryFn: () => documentsSource.holders() })
}

export function useDocuments(filter: DocumentFilter = {}) {
  return useQuery({ queryKey: [...KEY, 'list', filter], queryFn: () => documentsSource.list(filter) })
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    queryFn: () => documentsSource.get(id!),
    enabled: !!id,
  })
}

function useInvalidate() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: KEY })
}

export function useCreateDocument() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: Partial<DocumentInput>) => documentsSource.create(input),
    onSuccess: invalidate,
  })
}

export function useUpdateDocument(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<DocumentInput>) => documentsSource.update(id, patch),
    onSuccess: (doc) => {
      client.setQueryData([...KEY, 'detail', id], doc)
      return client.invalidateQueries({ queryKey: KEY })
    },
  })
}

export function useDeleteDocument() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => documentsSource.remove(id),
    onSuccess: (_, id) => {
      client.removeQueries({ queryKey: [...KEY, 'detail', id] })
      return client.invalidateQueries({ queryKey: KEY })
    },
  })
}

export function useUpdateFile(id: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ fileId, ...patch }: { fileId: string; label?: FileLabel; position?: number }) =>
      documentsSource.updateFile(id, fileId, patch),
    onSuccess: invalidate,
  })
}

export function useDeleteFile(id: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (fileId: string) => documentsSource.removeFile(id, fileId),
    onSuccess: invalidate,
  })
}

export { useInvalidate as useRefreshDocuments }
