import { useSearchParams } from 'react-router'

import { AlertRow, WidgetCard } from '@/components/ron1n'
import { WidgetSkeleton } from '@/components/WidgetSkeleton'
import { ApiError } from '@/lib/api'
import { num } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useRecipes } from '../data'
import { RecipeDetail } from './RecipeDetail'
import { RecipeEditor } from './RecipeEditor'

// Pagina /pasti/ricette (NUT-008): elenco delle ricette e la ricetta scelta.
// La lista della spesa arriva con NUT-011.
export function RecipesPage() {
  const [params, setParams] = useSearchParams()
  const { data, error } = useRecipes()
  const selectedId = params.get('ricetta')
  const editing = params.get('modifica') === '1'
  const creating = params.get('nuova') === '1'
  const recipes = data?.recipes ?? []
  const selected = recipes.find((r) => r.id === selectedId) ?? (creating ? undefined : recipes[0])

  const go = (next: Record<string, string>) => setParams(next, { replace: true })

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="eyebrow">Pasti</div>
        <h1 className="m-0 font-display text-[44px] leading-[48px] font-bold">Ricette e spesa</h1>
      </div>

      {!data && error ? (
        <AlertRow
          title="Ricette non disponibili."
          body={error instanceof ApiError ? error.message : 'Backend non raggiungibile'}
        />
      ) : (
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[1_1_320px] flex-col">
            {data ? (
              <WidgetCard title="Ricette" action={{ label: 'Nuova', onClick: () => go({ nuova: '1' }) }}>
                {recipes.length ? (
                  <ul aria-label="Ricette" className="m-0 flex list-none flex-col p-0">
                    {recipes.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          aria-current={r.id === selected?.id && !creating ? 'true' : undefined}
                          onClick={() => go({ ricetta: r.id })}
                          className={cn(
                            'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[12px] px-3 text-left text-sm hover:bg-glass-hover',
                            r.id === selected?.id && !creating && 'bg-glass-strong',
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">{r.name}</span>
                          <span className="font-mono text-[13px] text-ink-muted">{num(r.kcal)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-[13px] text-ink-muted">Nessuna ricetta.</span>
                )}
              </WidgetCard>
            ) : (
              <WidgetSkeleton title="Ricette" />
            )}
          </div>
          <div className="flex min-w-0 flex-[2_1_520px] flex-col">
            {creating ? (
              <RecipeEditor onSaved={(r) => go({ ricetta: r.id })} onCancel={() => go({})} />
            ) : selected && editing ? (
              <RecipeEditor
                key={selected.id}
                recipe={selected}
                onSaved={(r) => go({ ricetta: r.id })}
                onCancel={() => go({ ricetta: selected.id })}
              />
            ) : selected ? (
              <RecipeDetail
                key={selected.id}
                recipe={selected}
                onEdit={() => go({ ricetta: selected.id, modifica: '1' })}
                onDeleted={() => go({})}
              />
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}
