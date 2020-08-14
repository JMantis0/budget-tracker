const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/index.js",
  "/manifest.webmanifest",
  "/styles.css",
  "/icons/icon-72x72.png",
  "/icons/icon-96x96.png",
  "/icons/icon-128x128.png",
  "/icons/icon-144x144.png",
  "/icons/icon-152x152.png",
  "/icons/icon-192x192.png",
  "/icons/icon-384x384.png",
  "/icons/icon-512x512.png",
  "/icons/icon-1600x1600.png",
];

const STATIC_CACHE = "static-cache-v2";
const DATA_CACHE = "data-cache-v1";

// install
self.addEventListener("install", function (evt) {
  console.log("Attempting to install service worker and cache static assets");
  evt.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log("Static files pre-cached successfully!");
      return cache.addAll(FILES_TO_CACHE);
    })
  );

  self.skipWaiting();
});


self.addEventListener("activate", function (evt) {
  console.log("Service worker activating")
  evt.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== STATIC_CACHE && key !== DATA_CACHE) {
            console.log("Removing old cache data", key);
            return caches.delete(key);
          }
        })
        );
      })
      );
      
      self.clients.claim();
});

self.addEventListener("fetch", function (evt) {
  // cache successful requests to the API
  console.log("Fetch event for ", evt.request.url);
  if (evt.request.url.includes("/api/")) {
    evt.respondWith(
      caches
        .open(DATA_CACHE)
        .then((cache) => {
          return fetch(evt.request)
            .then((response) => {
              // If the response was good, clone it and store it in the cache.
              if (response.status === 200) {
                console.log("Adding to data-cache: url - ", evt.request.url);
                cache.put(evt.request.url, response.clone());
              }
              return response;
            })
            .catch((err) => {
              // Network request failed, try to get it from the cache.
              return cache.match(evt.request);
            });
        })
        .catch((err) => console.log(err))
    );

    return;
  }

  //  Static files route through here.
  evt.respondWith(
    caches.match(evt.request).then(function (response) {
      if (response) {
        console.log("Match found in cache... responding with cache for ", evt.request.url);
        return response
      } else {
        console.log("No match in cache, fetching ", evt.request.url);
        return fetch(evt.request);
      }
    })
  );
});
