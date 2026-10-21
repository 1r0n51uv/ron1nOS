// Passo 3 (DL-006): i file del torrent come albero di cartelle, con la
// selezione fatta per indice di file (quello che vuole qBittorrent).
import type { DraftFile } from '../data'

export type TreeNode = {
  name: string
  path: string
  size: number
  files: number[] // indici dei file sotto questo nodo
  index?: number // solo per i file
  children: TreeNode[]
}

export function buildTree(files: DraftFile[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', size: 0, files: [], children: [] }
  for (const f of files) {
    const parts = f.path.split('/')
    let node = root
    node.size += f.size
    node.files.push(f.index)
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join('/')
      const leaf = i === parts.length - 1
      let child = leaf ? undefined : node.children.find((c) => c.path === path && c.index === undefined)
      if (!child) {
        child = { name: part, path, size: 0, files: [], children: [], ...(leaf ? { index: f.index } : {}) }
        node.children.push(child)
      }
      child.size += f.size
      child.files.push(f.index)
      node = child
    })
  }
  return root.children
}

export type Check = boolean | 'indeterminate'

export function checkOf(node: TreeNode, selected: ReadonlySet<number>): Check {
  const n = node.files.filter((i) => selected.has(i)).length
  return n === 0 ? false : n === node.files.length ? true : 'indeterminate'
}

// Scegliere una cartella sceglie tutto quello che contiene.
export function toggle(node: TreeNode, selected: ReadonlySet<number>): Set<number> {
  const next = new Set(selected)
  const on = checkOf(node, selected) !== true
  for (const i of node.files) {
    if (on) next.add(i)
    else next.delete(i)
  }
  return next
}

export function selectedSize(files: DraftFile[], selected: ReadonlySet<number>) {
  return files.filter((f) => selected.has(f.index)).reduce((s, f) => s + f.size, 0)
}
