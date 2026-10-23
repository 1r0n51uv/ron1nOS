// Sezioni delle impostazioni (SET-001), nell'ordine del menu. Ogni sezione
// ha il suo indirizzo, `/impostazioni/<id>`.
export const SECTIONS = [
  { id: 'aspetto', label: 'Aspetto' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'moduli', label: 'Moduli' },
  { id: 'navigazione', label: 'Navigazione' },
  { id: 'account', label: 'Account' },
  { id: 'app-ios', label: 'App iOS' },
  { id: 'integrazioni', label: 'Integrazioni' },
  { id: 'formati', label: 'Formati' },
  { id: 'backup', label: 'Backup configurazione' },
  { id: 'informazioni', label: 'Informazioni' },
] as const

export type SectionId = (typeof SECTIONS)[number]['id']

export function findSection(id: string | undefined) {
  return SECTIONS.find((s) => s.id === id)
}

// Moduli con una pagina di impostazioni: `/impostazioni/moduli/<id>`.
export const MODULE_SETTINGS = [{ id: 'nutrizione', label: 'Nutrizione' }] as const
