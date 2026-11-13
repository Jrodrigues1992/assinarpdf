const APP = 'assinar-pdf-v1';
const LIBS = 'libs-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k !== APP && k !== LIBS && k !== 'shared-pdf') await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // PDF recebido pelo botão Compartilhar
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const form = await req.formData();
        const file = form.get('pdf');
        if (file) {
          const cache = await caches.open('shared-pdf');
          await cache.put(self.registration.scope + 'shared-file', new Response(file, {
            headers: {
              'Content-Type': 'application/pdf',
              'X-Filename': encodeURIComponent(file.name || 'documento.pdf')
            }
          }));
        }
      } catch (err) {}
      return Response.redirect(self.registration.scope + '?shared=1', 303);
    })());
    return;
  }

  if (req.method !== 'GET') return;

  // Bibliotecas (cdnjs): guarda para funcionar offline
  if (url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith((async () => {
      const cache = await caches.open(LIBS);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  // Arquivos do app: tenta a rede primeiro, usa o guardado se estiver offline
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(APP)).put(req, res.clone());
        return res;
      } catch (err) {
        return (await caches.match(req, { ignoreSearch: true })) || Response.error();
      }
    })());
  }
});
