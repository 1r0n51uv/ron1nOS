import type { PreferencesResponse } from './data'
import { backgroundUrl } from './data'

// Aspetto (SET-003): sfondo, vetro e densità diventano attributi di <html>;
// index.css li traduce in variabili CSS, così i componenti non cambiano.
export function applyAppearance(prefs: Pick<PreferencesResponse, 'appearance' | 'backgroundImage'>) {
  const root = document.documentElement
  const { background, glass, density } = prefs.appearance
  // Senza immagine salvata lo sfondo `image` non ha niente da mostrare.
  const image = background === 'image' ? prefs.backgroundImage : null
  root.dataset.background = background === 'image' && !image ? 'brace' : background
  root.dataset.glass = glass
  root.dataset.density = density
  if (image) root.style.setProperty('--bg-image', `url("${backgroundUrl(image)}")`)
  else root.style.removeProperty('--bg-image')
}
