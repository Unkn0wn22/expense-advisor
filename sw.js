const CACHE = 'expense-advisor-v4';
const CORE = ['./', 'index.html', 'styles.css', 'app.js', 'model.js', 'advisor.js', 'manifest.json', 'icon.svg'];
const fresh = async (c, u) => { const r = await fetch(new Request(u, { cache: 'reload' })); if (!r.ok) throw new Error(u + ' ' + r.status); await c.put(u, r); };
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => { await Promise.all(CORE.map(u => fresh(c, u))); try { await fresh(c, 'expense_model.json'); } catch (err) {} }));
  self.skipWaiting();
});
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => { if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request))); });
