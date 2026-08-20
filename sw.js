// sw.js - Service Worker para Club Kairos

const CACHE_NAME = 'club-kairos-v1';
const STATIC_CACHE = 'club-kairos-static-v1';
const IMAGES_CACHE = 'club-kairos-images-v1';

// Archivos a cachear en la instalación
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './sw.js'
  // Añade aquí otros archivos como CSS o JS externos si los tienes
];

// Evento de instalación
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Cacheando archivos estáticos...');
        return cache.addAll(urlsToCache)
          .catch((err) => {
            console.warn('[SW] Algunos archivos no se pudieron cachear:', err);
          });
      })
      .then(() => {
        console.log('[SW] Instalación completada');
        return self.skipWaiting();
      })
  );
});

// Evento de activación
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== IMAGES_CACHE && cacheName !== CACHE_NAME) {
              console.log('[SW] Eliminando cache antigua:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Activado y tomando control');
        return self.clients.claim();
      })
  );
});

// Estrategia: Cache First (con red como fallback) para páginas
// Y Stale-While-Revalidate para imágenes
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Si es un archivo de imagen (jpeg, png, gif, webp, svg, etc.)
  if (request.destination === 'image' || 
      /\.(jpe?g|png|gif|webp|svg|bmp|ico)$/i.test(url.pathname)) {
    
    event.respondWith(
      caches.open(IMAGES_CACHE)
        .then((cache) => {
          return cache.match(request)
            .then((cachedResponse) => {
              // Si está en cache, devolverlo y actualizar en segundo plano
              const fetchPromise = fetch(request)
                .then((networkResponse) => {
                  // Actualizar cache con la nueva imagen
                  if (networkResponse && networkResponse.status === 200) {
                    cache.put(request, networkResponse.clone());
                  }
                  return networkResponse;
                })
                .catch(() => {
                  // Si falla la red, devolver la cacheada si existe
                  return cachedResponse;
                });

              // Si tenemos cache, devolverla inmediatamente
              if (cachedResponse) {
                // Pero también actualizar en background
                event.waitUntil(fetchPromise);
                return cachedResponse;
              }

              // Si no hay cache, ir a la red
              return fetchPromise;
            });
        })
    );
    return;
  }

  // Para HTML y otros: Cache First con fallback a red
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // Si está en cache, devolverlo
        if (cachedResponse) {
          // Actualizar en background (stale-while-revalidate)
          event.waitUntil(
            fetch(request)
              .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                  caches.open(STATIC_CACHE)
                    .then((cache) => cache.put(request, networkResponse.clone()));
                }
                return networkResponse;
              })
              .catch(() => {})
          );
          return cachedResponse;
        }

        // Si no está en cache, ir a la red
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              // Cachear la respuesta para futuras visitas
              caches.open(STATIC_CACHE)
                .then((cache) => cache.put(request, networkResponse.clone()));
            }
            return networkResponse;
          })
          .catch(() => {
            // Si la red falla y no hay cache, mostrar página offline
            return caches.match('./offline.html')
              .then((offlineResponse) => {
                return offlineResponse || new Response(
                  '<html><body><h1>Sin conexión</h1><p>Club Kairos no está disponible offline</p></body></html>',
                  { headers: { 'Content-Type': 'text/html' } }
                );
              });
          });
      })
  );
});

// Evento de mensaje para comunicación con el cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Service Worker cargado correctamente');
