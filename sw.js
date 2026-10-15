/* Almanaque — service worker
   Cambia CACHE_VERSION en cada publicación para que todos reciban la versión nueva
   (ver README). Los juegos se cargan desde su propia URL y no pasan por aquí. */

const CACHE_VERSION = 'v47';
const CACHE = `almanaque-${CACHE_VERSION}`;

// Archivos de la portada que se guardan al instalar.
// Los iconos de los juegos se leen de games.json, no hace falta listarlos.
const ARCHIVOS = [
  './',
  './index.html',
  './styles.css',
  './historial.js',
  './app.js',
  './games.json',
  './manifest.json',
  './icons/almanaque.svg',
  './icons/almanaque-marca-sin-a.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

const FUENTES_CSS = 'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=IM+Fell+DW+Pica:ital@0;1&family=IM+Fell+DW+Pica+SC&display=swap';
const ORIGENES_FUENTES = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
const ESPERA_RED_MS = 3500;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ARCHIVOS.map((url) => new Request(url, { cache: 'reload' })));

    // Iconos de los juegos, según games.json.
    try {
      const respuesta = await cache.match('./games.json');
      const juegos = await respuesta.json();
      await Promise.all(juegos
        .map((j) => j && j.icono)
        .filter(Boolean)
        .map((icono) => cache.add(new Request(icono, { cache: 'reload' })).catch(() => {})));
    } catch (e) { /* no es crítico */ }

    // Tipografías de Google Fonts, para que la portada se vea igual sin conexión.
    try {
      const css = await fetch(FUENTES_CSS);
      if (css.ok) {
        const texto = await css.clone().text();
        await cache.put(FUENTES_CSS, css);
        const urls = [...texto.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]);
        await Promise.all(urls.map((u) => cache.add(u).catch(() => {})));
      }
    } catch (e) { /* sin conexión al instalar: se usarán las fuentes del sistema */ }

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves
      .filter((k) => k.startsWith('almanaque-') && k !== CACHE)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const peticion = event.request;
  if (peticion.method !== 'GET') return;

  const url = new URL(peticion.url);
  const esPortada = url.href.startsWith(self.registration.scope);
  const esFuente = ORIGENES_FUENTES.includes(url.origin);

  if (esFuente) {
    event.respondWith(cachePrimero(event, peticion));
  } else if (esPortada) {
    event.respondWith(redPrimero(peticion));
  }
  // Cualquier otra cosa (los juegos, otras webs) va directa a la red.
});

// Red primero (contenido siempre al día) y, si no hay red o tarda, la copia guardada.
async function redPrimero(peticion) {
  const cache = await caches.open(CACHE);

  const red = fetch(peticion).then((respuesta) => {
    if (respuesta.ok) cache.put(peticion, respuesta.clone());
    return respuesta;
  });

  const guardada = () => cache.match(peticion, { ignoreSearch: true })
    .then((r) => r || (peticion.mode === 'navigate' ? cache.match('./index.html') : undefined));

  try {
    const respuesta = await Promise.race([
      red,
      new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('lenta')), ESPERA_RED_MS))
    ]);
    return respuesta;
  } catch (e) {
    const copia = await guardada();
    if (copia) return copia;
    try {
      return await red; // ni copia ni red rápida: seguimos esperando a la red
    } catch (e2) {
      return Response.error();
    }
  }
}

// Caché primero y actualización en segundo plano (para las tipografías).
async function cachePrimero(event, peticion) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(peticion);
  const red = fetch(peticion).then((respuesta) => {
    if (respuesta.ok || respuesta.type === 'opaque') cache.put(peticion, respuesta.clone());
    return respuesta;
  }).catch(() => undefined);

  if (guardada) {
    event.waitUntil(red);
    return guardada;
  }
  return (await red) || Response.error();
}
