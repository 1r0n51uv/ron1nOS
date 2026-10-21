import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { fileSize } from '@/lib/format'
import type { Draft } from '../data'
import type { TreeNode } from './tree'
import { buildTree, checkOf, selectedSize, toggle } from './tree'

function FolderIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-ink-muted"
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  )
}

function Rows({
  nodes,
  depth,
  selected,
  onChange,
}: {
  nodes: TreeNode[]
  depth: number
  selected: ReadonlySet<number>
  onChange: (next: Set<number>) => void
}) {
  return nodes.map((node) => (
    <li key={node.path + (node.index ?? '')} className="flex flex-col gap-0.5">
      <label
        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm hover:bg-glass"
        style={{ paddingLeft: 12 + depth * 30 }}
      >
        <Checkbox
          checked={checkOf(node, selected)}
          onCheckedChange={() => onChange(toggle(node, selected))}
          aria-label={node.name}
        />
        {node.index === undefined ? <FolderIcon /> : null}
        <span
          className={`min-w-0 flex-1 truncate ${node.index === undefined ? 'font-medium' : ''}`}
          title={node.path}
        >
          {node.name}
        </span>
        <span className="font-mono text-xs text-ink-muted">{fileSize(node.size)}</span>
      </label>
      {node.children.length ? (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          <Rows nodes={node.children} depth={depth + 1} selected={selected} onChange={onChange} />
        </ul>
      ) : null}
    </li>
  ))
}

// Passo 3 (DL-006): albero dei file con caselle, Tutti e Nessuno, totale.
export function FilesStep({
  draft,
  selected,
  onChange,
}: {
  draft: Draft
  selected: ReadonlySet<number>
  onChange: (next: Set<number>) => void
}) {
  const tree = useMemo(() => buildTree(draft.files), [draft.files])
  const total = selectedSize(draft.files, selected)
  return (
    <>
      <div className="flex gap-2">
        <Button variant="glass" size="sm" onClick={() => onChange(new Set(draft.files.map((f) => f.index)))}>
          Tutti
        </Button>
        <Button variant="glass" size="sm" onClick={() => onChange(new Set())}>
          Nessuno
        </Button>
      </div>
      <ul
        aria-label="File del torrent"
        className="m-0 flex max-h-[300px] list-none flex-col gap-0.5 overflow-y-auto rounded-[20px] border border-glass-border bg-glass p-2"
      >
        <Rows nodes={tree} depth={0} selected={selected} onChange={onChange} />
      </ul>
      <div className="flex items-center justify-between font-mono text-[13px]">
        <span className="text-ink-muted">SELEZIONATI</span>
        <span>
          {selected.size} file · {fileSize(total)} su {fileSize(draft.size)}
        </span>
      </div>
    </>
  )
}
