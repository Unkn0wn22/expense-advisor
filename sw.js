const CACHE = 'expense-advisor-v3';
const CORE = ['./', 'index.html', 'styles.css', 'app.js', 'model.js', 'advisor.js', 'manifest.json', 'icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(async c => { await c.addAll(CORE); try { await c.add('expense_model.json'); } catch (err) {} })); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => { if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request))); });
