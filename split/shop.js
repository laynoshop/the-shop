// split/shop.js
// Shop tab + Firebase chat only. Keep this file self-contained and syntax-clean.

(function () {
  "use strict";

  const CHAT_ROOM_ID = "main";
  let chatUnsub = null;
  let chatReady = false;

  // ---------- tiny helpers ----------
  function norm(s) {
    return String(s || "").trim().toLowerCase();
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[c]));
  }

  function sanitizeTTUNText(str) {
    // If shared.js already provides replaceMichiganText logic, we can just do a simple replace here too.
    const a = ["Mi", "chigan"].join("");
    const b = ["Wol", "verines"].join("");
    return String(str || "").replace(new RegExp(a, "gi"), "TTUN").replace(new RegExp(b, "gi"), "TTUN");
  }

  // ---------- Firebase init/auth ----------
  async function ensureFirebaseChatReady() {
    if (chatReady) return;

    if (!window.firebase || !firebase.initializeApp) {
      throw new Error("Firebase SDK not loaded. Check index_split.html script tags.");
    }

    if (!window.FIREBASE_CONFIG) {
      throw new Error("FIREBASE_CONFIG missing. Check split/boot.js loads first.");
    }

    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }

    const auth = firebase.auth();
    if (!auth.currentUser) {
      await auth.signInAnonymously();
    }

    chatReady = true;
  }
  window.ensureFirebaseChatReady = ensureFirebaseChatReady;

  // ---------- Name / UI ----------
  function getChatDisplayName() {
    const key = "theShopChatName_v1";
    let name = "";
    try { name = String(localStorage.getItem(key) || "").trim(); } catch {}

    if (!name) {
      const picked = prompt("Chat name (shown to the group):", "") || "";
      name = String(picked).trim().slice(0, 30);
      if (name) {
        try { localStorage.setItem(key, name); } catch {}
      }
    }

    name = (name || "Anon").slice(0, 30);

    const label = document.getElementById("chatUserNameLabel");
    if (label) label.textContent = `You: ${name}`;

    return name;
  }

  function ensureChatDisplayName() {
    const n = getChatDisplayName();
    updateChatNameUI();
    return n;
  }

  function changeChatDisplayName() {
    const key = "theShopChatName_v1";
    const picked = prompt("Chat name (shown to the group):", "") || "";
    const name = String(picked).trim().slice(0, 30);
    if (!name) return;
    try { localStorage.setItem(key, name); } catch {}
    updateChatNameUI();
  }
  window.changeChatDisplayName = changeChatDisplayName;

  function updateChatNameUI() {
    const label = document.getElementById("chatUserNameLabel");
    if (label) label.textContent = `You: ${getChatDisplayName()}`;
  }

  function setChatConnectionStatus(isConnected) {
    const dot = document.getElementById("chatStatusDot");
    const text = document.getElementById("chatStatusText");
    if (!dot || !text) return;

    dot.classList.toggle("online", !!isConnected);
    dot.classList.toggle("offline", !isConnected);
    text.textContent = isConnected ? "Connected" : "Disconnected";
  }

  // ---------- realtime listener ----------
  function stopShopChatRealtime() {
    if (typeof chatUnsub === "function") chatUnsub();
    chatUnsub = null;
  }

  async function startShopChatRealtime() {
    ensureChatDisplayName();
    await ensureFirebaseChatReady();
    stopShopChatRealtime();

    const status = document.getElementById("chatStatusLine");
    if (status) status.textContent = "Loading chat…";

    const db = firebase.firestore();

    const q = db
      .collection("rooms")
      .doc(CHAT_ROOM_ID)
      .collection("messages")
      .orderBy("ts", "desc")
      .limit(50);

    let firstLoadDone = false;

    chatUnsub = q.onSnapshot(
      (snap) => {
        const items = [];
        snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
        items.reverse(); // oldest -> newest

        renderShopChatMessages(items);

        setChatConnectionStatus(true);

        if (!firstLoadDone) {
          firstLoadDone = true;
          if (status) status.textContent = "";
        } else {
          if (status) status.textContent = "";
        }
      },
      (error) => {
        console.error("Chat listener error:", error);
        setChatConnectionStatus(false);
        if (status) status.textContent = "Chat unavailable — try again.";
      }
    );
  }

  function renderShopChatMessages(items) {
    const list = document.getElementById("chatList");
    if (!list) return;

    const myName = getChatDisplayName();

    const html = (items || []).map(m => {
      const sender = escapeHtml(sanitizeTTUNText(m?.name || "Anon"));
      const text = escapeHtml(sanitizeTTUNText(m?.text || ""));

      const t = m?.ts?.toDate ? m.ts.toDate() : null;
      const time = t ? t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";

      const isMine = norm(m?.name) === norm(myName);

      return `
        <div class="chatMsgWrap ${isMine ? "mine" : ""}">
          <div class="chatMsgName">${sender}</div>
          <div class="chatMsgBubble ${isMine ? "mine" : ""}">
            <div class="chatMsgText">${text}</div>
            ${time ? `<div class="chatMsgTime">${escapeHtml(time)}</div>` : ``}
          </div>
        </div>
      `;
    }).join("");

    list.innerHTML = html || `<div class="notice">No messages yet. Start it up.</div>`;
    list.scrollTop = list.scrollHeight;

    // TTUN enforcement (use shared if available)
    setTimeout(() => { try { window.replaceMichiganText && window.replaceMichiganText(list); } catch {} }, 0);
  }

  async function sendShopChatMessage() {
    const input = document.getElementById("chatInput");
    if (!input) return;

    const raw = String(input.value || "").trim();
    if (!raw) return;

    const text = sanitizeTTUNText(raw).slice(0, 500);
    input.value = "";

    await ensureFirebaseChatReady();

    const db = firebase.firestore();
    const name = getChatDisplayName();

    await db
      .collection("rooms")
      .doc(CHAT_ROOM_ID)
      .collection("messages")
      .add({
        name: sanitizeTTUNText(name).slice(0, 30),
        text,
        ts: firebase.firestore.FieldValue.serverTimestamp()
      });
  }
  window.sendShopChatMessage = sendShopChatMessage;

  // ---------- Shop tab ----------
  function renderShop() {
    const content = document.getElementById("content");

    content.innerHTML = `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Shop</h2>
            <span class="badge">Hub</span>
          </div>
        </div>
        <div class="subline">
          <div>Tools for the shop</div>
          <div>Private</div>
        </div>
      </div>

      <div class="notice">
        <div style="font-weight:800; letter-spacing:0.5px;">GROUP CHAT</div>
        <div id="chatStatusLine" style="margin-top:6px; opacity:0.85;">Loading chat…</div>

        <div id="chatRoomTitle" class="chatRoomTitle">
          <span id="chatRoomName">THE Chat</span>
          <span class="chatStatusWrap">
            • <span id="chatStatusDot" class="chatStatusDot"></span>
            <span id="chatStatusText">Connecting...</span>
          </span>
        </div>

        <div style="margin-top:12px;">
          <div class="chatNameRow">
            <span id="chatUserNameLabel"></span>
            <button onclick="changeChatDisplayName()" class="chatNameBtn">Change</button>
          </div>
          <div id="chatList" style="max-height:52vh; overflow:auto;"></div>
        </div>

        <div style="margin-top:12px; display:flex; gap:8px;">
          <input id="chatInput" type="text" placeholder="Type a message…" style="flex:1;" />
          <button class="smallBtn" id="chatSendBtn">Send</button>
        </div>

        <div style="margin-top:10px; opacity:0.7; font-size:12px;">
          One room • Real-time • Buckeye energy
        </div>
      </div>
    `;

    startShopChatRealtime().catch(() => {
      const status = document.getElementById("chatStatusLine");
      if (status) status.textContent = "Chat unavailable — check Firebase config/rules.";
    });

    // TTUN enforcement
    setTimeout(() => { try { window.replaceMichiganText && window.replaceMichiganText(content); } catch {} }, 0);
  }
  window.renderShop = renderShop;

  // One click handler for the send button (no inline onclick needed)
  document.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!btn) return;
    if (btn.id === "chatSendBtn") sendShopChatMessage();
  });

})();