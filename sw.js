importScripts('config.js');

const CACHE_NAME = 'zikir-takip-' + CACHE_VERSION;
const ASSETS_CORE = [
    './',
    './index.html', './kuran.html',
    './data.js', './maps.js',
    './config.js',
    './manifest.json'
];

const ASSETS_EXTERNAL = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://cdn.tailwindcss.com'
];

// 1. YÜKLEME (INSTALL)
self.addEventListener('install', (e) => {
    self.skipWaiting();

    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Kritik dosyalar önbelleğe alınıyor...');
            // Önce kritik dosyaları yükle (Hata verirse durur, bu doğru)
            return cache.addAll(ASSETS_CORE).then(() => {
                console.log('[SW] Harici kaynaklar deneniyor...');
                // Harici kaynakları "no-cors" modunda veya normal deniyoruz
                // cache.addAll tek bir hata olursa patlar, o yüzden map ile tek tek deniyoruz
                return Promise.all(
                    ASSETS_EXTERNAL.map(url => {
                        return fetch(url, { mode: 'no-cors' }) // no-cors ile opaque response almayı dene
                            .then(response => {
                                if (response) return cache.put(url, response);
                            })
                            .catch(err => console.log('[SW] Harici kaynak yüklenemedi (Önemsiz):', url));
                    })
                );
            });
        })
    );
});

// 2. AKTİFLEŞTİRME VE TEMİZLİK (ACTIVATE)
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList.map((key) => {
                    // Eğer cache adı bizim şu anki CACHE_NAME ile aynı değilse sil (Eski sürümleri temizle)
                    if (key !== CACHE_NAME) {
                        console.log('[SW] Eski önbellek siliniyor:', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    // Sayfanın kontrolünü hemen ele al (Yenilemeye gerek kalmadan)
    return self.clients.claim();
});

// 3. YAKALAMA VE GÖSTERME (FETCH - NETWORK FIRST)
self.addEventListener('fetch', (e) => {
    // Sadece http/https isteklerini işle (chrome-extension vb. hataları önlemek için)
    if (!e.request.url.startsWith('http')) return;

    e.respondWith(
        // ÖNCE İNTERNETE GİT (En güncelini al)
        fetch(e.request)
            .then((response) => {
                // Geçerli bir cevap geldiyse
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }

                // Güncel cevabı alıp önbelleğe de kopyala (Bir dahaki sefere internet yoksa bunu kullanır)
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(e.request, responseToCache);
                });

                return response;
            })
            .catch(() => {
                // İNTERNET YOKSA VEYA HATA VARSA ÖNBELLEKTEN VER
                return caches.match(e.request);
            })
    );
});
