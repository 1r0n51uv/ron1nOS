// Service worker di ron1nOS (PWA-001): serve a rendere l'app installabile e a
// mostrare la schermata di avvio anche senza rete. Non tiene in cache né le
// API né i dati: solo la pagina di avvio, ripresa dalla rete quando c'è.
const SHELL = 'ron1nos-shell-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.add('/')))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || request.mode !== 'navigate') return
  // Rete per prima: dopo un aggiornamento la pagina nuova arriva subito.
  event.respondWith(
    fetch(request).catch(() => caches.match('/').then((cached) => cached ?? Response.error())),
  )
})
