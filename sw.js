/* ירח דבש · עדי ונתנאל — Service Worker
   מטרה: שהאתר ייפתח מלא גם בלי רשת (טיסות, רכבות בהרים, אזורים בלי קליטה). */
const VERSION   = 'hm-v11';
const SHELL     = VERSION + '-shell';
const FONTS     = VERSION + '-fonts';
const TILES     = VERSION + '-tiles';
const TILE_CAP  = 400;                       // תקרה כדי לא לנפח את האחסון
const SHELL_URLS = ['./', './index.html'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await c.addAll(SHELL_URLS.map(u => new Request(u, {cache: 'reload'})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function trim(cacheName, cap) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  if (keys.length > cap) await Promise.all(keys.slice(0, keys.length - cap).map(k => c.delete(k)));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 1. הדף עצמו — מהמטמון מיד, ורענון ברקע לביקור הבא
  if (req.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('.html'))) {
    e.respondWith((async () => {
      const c = await caches.open(SHELL);
      const cached = await c.match('./index.html') || await c.match('./');
      const net = fetch(req).then(r => { if (r && r.ok) c.put('./index.html', r.clone()); return r; })
                            .catch(() => null);
      return cached || (await net) || new Response('<h1>אין חיבור</h1>', {headers:{'Content-Type':'text/html; charset=utf-8'}});
    })());
    return;
  }

  // 2. גופנים — מהמטמון קודם, הם לא משתנים
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(FONTS);
      const hit = await c.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }
      catch (_) { return hit || Response.error(); }
    })());
    return;
  }

  // 3. אריחי מפה — מה שכבר נצפה יישאר זמין אופליין
  if (/basemaps\.cartocdn\.com$/.test(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(TILES);
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const r = await fetch(req);
        if (r && (r.ok || r.type === 'opaque')) { c.put(req, r.clone()); trim(TILES, TILE_CAP); }
        return r;
      } catch (_) { return hit || Response.error(); }
    })());
    return;
  }

  // 4. כל השאר (למשל שערי מטבע) — רשת בלבד, הדף כבר יודע ליפול למטמון שלו
});
