const CACHE_NAME = 'mathjax-cache-v1';
const MATHJAX_URL = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/mml-chtml.js';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.add(MATHJAX_URL);
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url === MATHJAX_URL) {
    event.respondWith(
      caches.match(MATHJAX_URL).then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(MATHJAX_URL, response.clone());
            return response;
          });
        });
      })
    );
  }
});
