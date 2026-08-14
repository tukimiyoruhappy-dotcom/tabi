/* 旅のしおり — オフライン用サービスワーカー
 *
 * ・アプリ本体（HTML/地図ライブラリ）はキャッシュしておき、圏外でも開けるようにします
 * ・スプレッドシートのデータは常に最新を取りに行き、取れなければ画面側の
 *   localStorage キャッシュが使われます
 */
const VERSION = 'tabi-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // スプレッドシートと地図タイルはキャッシュせず、常にネットワークへ
  if (url.hostname.includes('docs.google.com') ||
      url.hostname.includes('tile.openstreetmap.org') ||
      url.hostname.includes('nominatim.openstreetmap.org')) {
    return;
  }

  // アプリ本体はネットワーク優先・失敗したらキャッシュ
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
