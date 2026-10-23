import type { CSSProperties, ReactNode } from 'react'
import { useRef } from 'react'

import { WidgetCard } from '@/components/ron1n'
import { cn } from '@/lib/utils'
import { Row, Segmented } from './fields'
import type { Preferences } from './data'
import { backgroundUrl, useBackgroundImage, usePreferences, useUpdatePreferences } from './data'

type Appearance = Preferences['appearance']

// Le sfumature pronte, nell'ordine del mockup; `image` è a parte.
const BACKGROUNDS: { id: Exclude<Appearance['background'], 'image'>; label: string; swatch: string }[] = [
  {
    id: 'brace',
    label: 'Brace (predefinito)',
    swatch:
      'radial-gradient(90px 60px at 15% 0%, rgba(255,42,42,0.30), transparent 70%), radial-gradient(90px 60px at 100% 80%, rgba(110,110,130,0.30), transparent 70%), #070707',
  },
  {
    id: 'nebbia',
    label: 'Nebbia',
    swatch: 'radial-gradient(100px 70px at 50% 120%, rgba(110,110,130,0.40), transparent 70%), #070707',
  },
  { id: 'grafite', label: 'Grafite', swatch: 'linear-gradient(160deg, #141416, #070707 70%)' },
  { id: 'nero', label: 'Nero', swatch: '#070707' },
]

const GLASS: [Appearance['glass'], string][] = [
  ['light', 'Leggero'],
  ['medium', 'Medio'],
  ['strong', 'Intenso'],
]

const DENSITY: [Appearance['density'], string][] = [
  ['comfortable', 'Comoda'],
  ['compact', 'Compatta'],
]

// Impostazioni › Aspetto (SET-003): ogni scelta vale subito, si vede
// nell'anteprima e in tutta l'interfaccia, e si salva da sola.
export function AppearanceSection() {
  const prefs = usePreferences().data
  const update = useUpdatePreferences()
  const { upload, remove } = useBackgroundImage()
  const file = useRef<HTMLInputElement>(null)
  if (!prefs) return null
  const { appearance, backgroundImage } = prefs
  const set = (patch: Partial<Appearance>) => update.mutate({ appearance: patch })
  const failed = update.isError ? (update.variables?.appearance ?? {}) : {}

  return (
    <WidgetCard title="Tema scuro, un solo rosso">
      <p className="m-0 text-sm text-ink-muted">
        Le scelte valgono per tutti i dispositivi e si salvano da sole.
      </p>

      <Field
        label="Sfondo"
        hint="immagine: JPEG, PNG o WebP fino a 5 MB"
        error={
          upload.isError
            ? upload.error.message
            : remove.isError
              ? 'Immagine non tolta · riprova'
              : 'background' in failed
                ? 'Sfondo non salvato · riprova'
                : null
        }
      >
        <div role="radiogroup" aria-label="Sfondo" className="flex flex-wrap gap-4">
          {BACKGROUNDS.map((b) => (
            <Swatch
              key={b.id}
              label={b.label}
              on={appearance.background === b.id}
              style={{ background: b.swatch }}
              onClick={() => set({ background: b.id })}
            />
          ))}
          {backgroundImage ? (
            <Swatch
              label="Immagine"
              on={appearance.background === 'image'}
              style={{ background: `center / cover url("${backgroundUrl(backgroundImage)}")` }}
              onClick={() => set({ background: 'image' })}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={file}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Immagine di sfondo"
            className="sr-only"
            onChange={(e) => {
              const picked = e.target.files?.[0]
              if (picked) upload.mutate(picked)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            disabled={upload.isPending}
            onClick={() => file.current?.click()}
            className="h-9 cursor-pointer rounded-full px-3.5 text-[13px] text-ink glass-chip hover:bg-glass-hover disabled:opacity-50"
          >
            {upload.isPending ? 'Caricamento…' : backgroundImage ? 'Cambia immagine' : 'Carica immagine'}
          </button>
          {backgroundImage ? (
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
              className="h-9 cursor-pointer rounded-full border-0 bg-transparent px-2 text-[13px] text-ink-muted hover:text-ink"
            >
              Togli immagine
            </button>
          ) : null}
        </div>
      </Field>

      <Row label="Vetro" hint="Sfocatura e trasparenza dei pannelli." error={'glass' in failed}>
        <Segmented
          label="Vetro"
          options={GLASS}
          value={appearance.glass}
          onChange={(glass) => set({ glass })}
        />
      </Row>

      <Row label="Densità" hint="Spaziature di card e griglia." error={'density' in failed}>
        <Segmented
          label="Densità"
          options={DENSITY}
          value={appearance.density}
          onChange={(density) => set({ density })}
        />
      </Row>

      <Field label="Anteprima">
        <div
          aria-hidden="true"
          data-testid="appearance-preview"
          className="grid grid-cols-3 gap-(--grid-gap) rounded-tile border border-glass-border p-(--card-gap)"
        >
          <div className="h-14 rounded-xl glass-panel" />
          <div className="h-14 rounded-xl glass-panel" />
          <div className="h-14 rounded-xl glass-panel" />
          <div className="col-span-2 h-14 rounded-xl glass-panel" />
          <div className="h-14 rounded-xl glass-panel" />
        </div>
      </Field>
    </WidgetCard>
  )
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-glass-border pt-4">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-semibold">{label}</span>
        {hint ? <span className="text-[13px] text-ink-muted">{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <p role="alert" className="m-0 text-sm text-brand-text">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function Swatch({
  label,
  on,
  style,
  onClick,
}: {
  label: string
  on: boolean
  style: CSSProperties
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'flex cursor-pointer flex-col gap-2 border-0 bg-transparent p-0 text-left text-[13px]',
        on ? 'text-ink' : 'text-ink-muted',
      )}
    >
      <span
        className={cn(
          'block h-[84px] w-[132px] rounded-control border border-glass-border',
          on && 'outline-2 outline-offset-3 outline-brand outline-solid',
        )}
        style={style}
      />
      {label}
    </button>
  )
}
