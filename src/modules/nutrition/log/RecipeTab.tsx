import { AlertRow } from '@/components/ron1n'
import { ApiError } from '@/lib/api'
import { num } from '@/lib/format'
import type { Recipe } from '../data'
import { useRecipes } from '../data'

// Una ricetta entra nel pasto in un colpo (NUT-008).
export function RecipeTab({ onAdd }: { onAdd: (recipe: Recipe) => void }) {
  const { data, error } = useRecipes()
  if (error) {
    return (
      <AlertRow
        title="Ricette non disponibili."
        body={error instanceof ApiError ? error.message : 'Backend non raggiungibile'}
      />
    )
  }
  if (!data) return <span className="px-3 text-[13px] text-ink-muted">Carico le ricette…</span>
  if (!data.recipes.length) {
    return (
      <span className="px-3 text-[13px] text-ink-muted">Nessuna ricetta. Si creano in Ricette e spesa.</span>
    )
  }
  return (
    <ul aria-label="Ricette" className="m-0 flex max-h-56 list-none flex-col overflow-y-auto p-0">
      {data.recipes.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onAdd(r)}
            className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[12px] px-3 text-left text-sm hover:bg-glass-hover"
          >
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            <span className="font-mono text-[13px] text-ink-muted">
              {r.items.length} alimenti · {num(r.kcal)} kcal
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
