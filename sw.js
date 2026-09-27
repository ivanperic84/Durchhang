/* Service Worker — macht die Anwendung offline verfügbar.
 *
 * Die App ist eine einzige HTML-Datei; der Zwischenspeicher ist entsprechend
 * klein. Strategie:
 *   HTML und eigene Skripte (.js)
 *         → «network first»: online immer die neueste Fassung, offline die
 *           zwischengespeicherte. Verhindert, dass nach einer Aktualisierung
 *           eine veraltete Datei hängen bleibt — und dass eine neue Seite
 *           mit einem alten Rechenkern (rechenkern.js) zusammentrifft.
 *   Rest  → «cache first»: Icons und Schriften (fonts/) ändern sich praktisch nie.
 *
 * CACHE_VERSION bei jeder Veröffentlichung erhöhen — alte Zwischenspeicher
 * werden beim Aktivieren automatisch entfernt.
 */
const CACHE_VERSION = 'durchhang-v3.16.2';

/* Bestandteile der Anwendung. Relative Pfade, damit es sowohl unter
   /Durchhang/ auf GitHub Pages als auch in einem Unterordner funktioniert. */
const APP_DATEIEN = [
  './',
  './index.html',
  './rechenkern.js',
  './export3d.js',
  './abschnitt.js',
  './fahrdrahthoehe.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './favicon-32.png',
  './icon.svg',
  './apple-touch-icon.png',
  './fonts/inter-latin-wght-normal.woff2',
  './fonts/inter-latin-ext-wght-normal.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // Einzeln ablegen: eine fehlende Datei darf die Installation nicht scheitern lassen
    await Promise.all(APP_DATEIEN.map(async pfad => {
      try { await cache.add(new Request(pfad, { cache: 'reload' })); }
      catch (err) { console.warn('[SW] nicht zwischengespeichert:', pfad, err.message); }
    }));
    // Bewusst KEIN skipWaiting() hier: die neue Fassung wartet, bis der Nutzer
    // im Hinweis «Jetzt laden» drückt. Sonst würde eine bereits laufende Seite
    // mitten im Betrieb von einem neuen Service Worker übernommen.
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen
      .filter(n => n.startsWith('durchhang-') && n !== CACHE_VERSION)
      .map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const istHtml = req.mode === 'navigate' ||
                  (req.headers.get('accept') || '').includes('text/html');
  const istEigenesSkript = url.origin === self.location.origin &&
                           url.pathname.endsWith('.js');

  if (istHtml || istEigenesSkript) {
    // Netz zuerst, Zwischenspeicher als Rückfall
    e.respondWith((async () => {
      try {
        const antwort = await fetch(req);
        // Nur Erfolgreiches ablegen — sonst landet eine 404- oder 500-Seite
        // im Zwischenspeicher und wird offline dauerhaft ausgeliefert.
        if (antwort.ok) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(req, antwort.clone());
        }
        return antwort;
      } catch (err) {
        if (istEigenesSkript) return (await caches.match(req)) ||
               new Response('', { status: 504 });
        return (await caches.match(req)) ||
               (await caches.match('./index.html')) ||
               (await caches.match('./')) ||
               new Response('Offline und nicht zwischengespeichert.',
                            { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }

  // Übriges: Zwischenspeicher zuerst, sonst Netz (und dann ablegen)
  e.respondWith((async () => {
    const treffer = await caches.match(req);
    if (treffer) return treffer;
    try {
      const antwort = await fetch(req);
      // Nur Eigenes dauerhaft ablegen (Schriften liegen seit v3.1 in fonts/)
      const ablegen = url.origin === self.location.origin;
      if (ablegen && (antwort.ok || antwort.type === 'opaque')) {
        const cache = await caches.open(CACHE_VERSION);
        cache.put(req, antwort.clone());
      }
      return antwort;
    } catch (err) {
      return new Response('', { status: 504 });
    }
  })());
});

/* Erlaubt der Seite, eine wartende neue Fassung sofort zu übernehmen. */
self.addEventListener('message', e => {
  if (e.data === 'jetzt-aktualisieren') self.skipWaiting();
});
