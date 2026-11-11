// La foto di una ricetta (NUT-034). YAZIO dà l'originale (2-4 MB); il suo CDN
// ne serve una versione ridimensionata, pubblica e senza login, di circa 30 KB.
// Un indirizzo che non è di YAZIO resta com'è.
const ORIGINAL = /^https:\/\/images\.yazio\.com\/(.+)$/
const RIDIMENSIONATA = 'https://images.yazio-cdn.com/process/w:684/h:558/rt:fill/f:webp/plain/'

export function recipeImage(url: string | null | undefined): string | null {
  if (!url) return null
  const match = ORIGINAL.exec(url)
  return match ? `${RIDIMENSIONATA}${match[1]}` : url
}
