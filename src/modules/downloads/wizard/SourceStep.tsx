import { useState } from 'react'

import { AlertRow } from '@/components/ron1n'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { SourceState } from './source'
import { linkLabel, parseLink, readTorrentFile } from './source'

// Passo 1 (DL-004): un file .torrent oppure un link, magnet o URL.
export function SourceStep({
  value,
  onChange,
}: {
  value: SourceState
  onChange: (next: SourceState) => void
}) {
  const [over, setOver] = useState(false)
  const link = value.link.trim() ? parseLink(value.link) : null

  async function pick(file: File | undefined) {
    if (!file) return
    const copy = await readTorrentFile(file)
    onChange({ ...value, file: copy ?? file, fileError: !copy })
  }

  return (
    <Tabs value={value.tab} onValueChange={(tab) => onChange({ ...value, tab: tab as SourceState['tab'] })}>
      <TabsList aria-label="Sorgente">
        <TabsTrigger value="file">File</TabsTrigger>
        <TabsTrigger value="link">Link</TabsTrigger>
      </TabsList>

      <TabsContent value="file" className="flex flex-col gap-3">
        <label
          className={cn(
            'flex h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[20px] border-[1.5px] border-dashed border-white/20 bg-glass text-center transition-colors',
            over && 'border-brand-line bg-brand-tint-faint',
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            void pick(e.dataTransfer.files[0])
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="text-ink-muted"
          >
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5" />
            <path d="M12 17v-6M9 14l3-3 3 3" />
          </svg>
          {value.file ? (
            <span className="max-w-[80%] truncate font-mono text-sm">{value.file.name}</span>
          ) : (
            <span className="text-base font-medium">Trascina qui un file .torrent</span>
          )}
          <span className="text-[13px] text-ink-muted">
            {value.file ? null : 'oppure '}
            <span className="text-brand-text">
              {value.file ? 'scegli un altro file' : 'scegli dal disco'}
            </span>
            {' · un file, fino a 10 MB'}
          </span>
          {/* Niente accept: iOS e Android non conoscono il tipo dei .torrent e
              li mostrano non selezionabili. Il controllo lo fa pick. */}
          <input
            type="file"
            aria-label="File .torrent"
            className="sr-only"
            onChange={(e) => {
              // La lettura parte subito, prima di svuotare il campo.
              void pick(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
        {value.fileError ? (
          <AlertRow title="File torrent non valido." body="Il file non è un torrent o supera 10 MB." />
        ) : (
          <div className="text-[13px] text-ink-muted">
            Puoi anche incollare un link magnet o un URL in qualunque punto: si apre la scheda Link.
          </div>
        )}
      </TabsContent>

      <TabsContent value="link" className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
          Link magnet o URL di un .torrent
          <input
            type="text"
            value={value.link}
            onChange={(e) => onChange({ ...value, link: e.target.value })}
            placeholder="magnet:?xt=urn:btih:… oppure https://…/file.torrent"
            spellCheck={false}
            autoComplete="off"
            className="min-h-11 rounded-[14px] border border-glass-border bg-glass-strong px-3.5 font-mono text-[13px] text-ink outline-none placeholder:text-ink-muted/60 focus-visible:border-brand-line"
          />
        </label>
        {value.link.trim() ? (
          link ? (
            <span className="font-mono text-xs text-ink-muted">{linkLabel(link)}</span>
          ) : (
            <AlertRow
              title="Link non valido."
              body="Serve un link magnet o l’URL http(s) di un file .torrent."
            />
          )
        ) : null}
      </TabsContent>
    </Tabs>
  )
}
