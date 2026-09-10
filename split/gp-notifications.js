/* split/gp-notifications.js
   =========================
   GROUP PICKS — Push Notifications (foundation)

   Registers firebase-messaging-sw.js, requests browser permission, and
   stores the resulting FCM token on the player's registry doc
   (players/{playerId}.fcmTokens) so a Cloud Function can look it up
   later and send a push. This file only covers opt-in + token storage —
   the actual "notify players when X happens" triggers are separate
   Cloud Functions built on top of this once it's confirmed working.

   ── ONE-TIME SETUP REQUIRED — nothing here works without this ──
   1. Firebase console → Project Settings → Cloud Messaging → Web Push
      certificates → generate a key pair.
   2. Paste that key (starts with a long base64-ish string) into
      GP_VAPID_KEY below.
   Without a real key, gpNotifEnable() rejects with a clear error
   instead of silently doing nothing.

   ── iOS CAVEAT ──
   Safari only delivers Web Push to a site running in standalone
   display mode — i.e. opened from a Home Screen icon, not a regular
   Safari tab. There is no workaround; this is a platform limitation,
   not a bug here. gpNotifNeedsHomeScreenFirst() detects this case so
   the UI can tell the player to add the app to their Home Screen
   before trying to enable notifications.
*/

(function () {
  "use strict";

  const GP_VAPID_KEY = ""; // <-- paste your Web Push certificate key here

  function gpNotifIsIOS() {
    return /iphone|ipad|ipod/i.test(String(navigator.userAgent || ""));
  }

  function gpNotifIsStandalone() {
    try {
      if (window.navigator && window.navigator.standalone === true) return true;
      return !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    } catch {
      return false;
    }
  }

  function gpNotifNeedsHomeScreenFirst() {
    return gpNotifIsIOS() && !gpNotifIsStandalone();
  }

  function gpNotifSupported() {
    try {
      return "Notification" in window
        && "serviceWorker" in navigator
        && typeof firebase !== "undefined"
        && typeof firebase.messaging === "function";
    } catch {
      return false;
    }
  }

  // "default" (not yet asked), "granted", "denied", or "unsupported".
  function gpNotifPermission() {
    if (!gpNotifSupported()) return "unsupported";
    try { return Notification.permission; } catch { return "unsupported"; }
  }

  async function gpNotifEnable(db, playerId) {
    if (!gpNotifSupported()) {
      throw new Error("Push notifications aren't supported in this browser.");
    }
    if (gpNotifNeedsHomeScreenFirst()) {
      throw new Error("Add this page to your Home Screen first (Share → Add to Home Screen), then open it from there and try again.");
    }
    if (!GP_VAPID_KEY) {
      throw new Error("Notifications aren't configured yet — missing VAPID key.");
    }
    if (!playerId) {
      throw new Error("Can't enable notifications without an identity — log in first.");
    }

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("Notification permission wasn't granted.");
    }

    const messaging = firebase.messaging();
    const token = await messaging.getToken({
      vapidKey: GP_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) {
      throw new Error("Couldn't get a notification token from Firebase.");
    }

    await db.collection("players").doc(String(playerId)).set({
      fcmTokens: firebase.firestore.FieldValue.arrayUnion(token),
      fcmTokenUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return token;
  }

  window.GP_Notif = {
    gpNotifSupported,
    gpNotifNeedsHomeScreenFirst,
    gpNotifPermission,
    gpNotifEnable,
  };
})();
