/* firebase-messaging-sw.js
   =========================
   Firebase Cloud Messaging service worker. Must live at the site root
   (not under split/) so its default scope covers the whole origin —
   that's what lets it receive a push while the app itself isn't open.

   Runs in its own worker global scope, separate from the page, so it
   can't read window.FIREBASE_CONFIG from boot.js — the config is
   duplicated here on purpose. Same project, so it changes exactly when
   FIREBASE_CONFIG in split/boot.js does.
*/
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBK09tMYLKcDLTMLVn2gYpsezCJAax0Y9Y",
  authDomain: "the-shop-chat.firebaseapp.com",
  projectId: "the-shop-chat",
  storageBucket: "the-shop-chat.firebasestorage.app",
  messagingSenderId: "98648984848",
  appId: "1:98648984848:web:c4e876c8acdb00d8ba2995"
});

const messaging = firebase.messaging();

// Fires when a push arrives while the app isn't in the foreground —
// the normal case for a phone with the app closed. A push that arrives
// while the app IS open and focused is instead delivered to the page
// itself (not this handler); Cloud Functions always sends a
// `notification` payload, so the browser shows it automatically even
// without this handler, but defining it lets us control the icon.
messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || "The Shop";
  const body  = payload?.notification?.body  || "";
  self.registration.showNotification(title, {
    body,
    icon: "/buckeye-O.png",
    badge: "/buckeye-O.png",
    data: payload?.data || {},
  });
});

// Tapping the notification focuses an existing tab if one's open,
// otherwise opens a new one at the root.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});
