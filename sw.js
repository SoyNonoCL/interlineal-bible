// Service worker: caché del armazón de la app + caché bajo demanda de los datos bíblicos.
const SHELL = 'il-shell-v13', DATA = 'il-data-v2';
const SHELL_FILES = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/morph.js', 'js/store.js', 'js/epub.js', 'js/i18n.js', 'js/config.js', 'js/refworks.js', 'lecturas.json', 'js/pdfbible.js', 'js/principios.js', 'js/bienvenida.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/favicon-64.png', 'data/meta.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => ![SHELL, DATA].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/data/bibles/')) return;   // catálogo de Biblias: la app las guarda en IndexedDB; no se duplican en caché
  const isData = url.pathname.includes('/data/') || url.pathname.includes('/fonts/');
  if (isData) {
    // datos y fuentes: primero caché, luego red (y se guardan)
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(DATA).then(c => c.put(e.request, cp)); }
      return r;
    })));
  } else {
    // armazón: red primero para recibir actualizaciones, caché si no hay conexión
    // «no-cache»: revalida con el servidor (GitHub Pages guarda 10 min en el navegador); responde 304 si no cambió
    const net = e.request.mode === 'navigate' ? fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(e.request, { cache: 'no-cache' });
    e.respondWith(net.then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(SHELL).then(c => c.put(e.request, cp)); }
      return r;
    }).catch(() => caches.match(e.request).then(h => h || caches.match('index.html'))));
  }
});
