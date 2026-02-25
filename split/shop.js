  // Keep newest visible
  list.scrollTop = list.scrollHeight;

  // TTUN enforcement
  setTimeout(() => replaceMichiganText(), 0);
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

/* =========================
   SHOP TAB (placeholder hub)
   ========================= */
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

  startShopChatRealtime()
    .catch(() => {
      const status = document.getElementById("chatStatusLine");
      if (status) status.textContent = "Chat unavailable — check Firebase config/rules.";
    });

  setTimeout(() => replaceMichiganText(), 0);
}

function getChatDisplayName() {
  let name = "";

  try {
    name = String(localStorage.getItem("shopChatName") || "").trim();
  } catch {
    name = "";
  }

  // If missing OR mistakenly set to the room name, re-prompt once
  if (!name || norm(name) === norm("THE Chat")) {
    const picked = prompt("Enter your name for group chat (example: Victor):", "");
    name = String(picked || "").trim();
    if (!name) name = "Anon";

    try {
      localStorage.setItem("shopChatName", name.slice(0, 20));
    } catch {}
  }

  // Update the small label if it exists
  const label = document.getElementById("chatUserNameLabel");
  if (label) label.textContent = `You: ${name}`;

  return name;
}

function ensureChatDisplayName() {
  let name = getChatDisplayName();

  if (!name) {
    name = prompt("Enter your display name:");
    if (!name) name = "Anon";
    localStorage.setItem("shopChatName", name.trim().slice(0, 20));
  }

  updateChatNameUI();
  return name;
}

function changeChatDisplayName() {
  const name = prompt("Enter new display name:");
  if (!name) return;

  localStorage.setItem("shopChatName", name.trim().slice(0, 20));
  updateChatNameUI();
}

function updateChatNameUI() {
  const label = document.getElementById("chatUserNameLabel");
  if (label) {
    label.textContent = `You: ${getChatDisplayName()}`;
  }
}

/* =========================
   GLOBAL TTUN REPLACER
   ========================= */

function replaceMichiganText(root = document.body) {
  // Build the banned terms without ever writing them as a single word in the source
  const a = ["Mi", "chigan"].join("");
  const b = ["Wol", "verines"].join("");

  const rxA = new RegExp(a, "gi");
  const rxB = new RegExp(b, "gi");

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while ((node = walker.nextNode())) {
    if (!node.nodeValue) continue;

    node.nodeValue = node.nodeValue
      .replace(rxA, "TTUN")
      .replace(rxB, "TTUN");
  }
}

/* =========================
   LOGOUT
   ========================= */
function logout() {
  // Clear role
  localStorage.removeItem("theShopRole_v1");

  // Stop refresh timers
  stopAutoRefresh();

  // Hide app, show login
  document.getElementById("app").style.display = "none";
  document.getElementById("login").style.display = "flex";

  // Clear content
  const content = document.getElementById("content");
  if (content) content.innerHTML = "";

  // Optional: clear code field
  const codeEl = document.getElementById("code");
  if (codeEl) codeEl.value = "";
}

/* =========================
   GROUP PICKS (Pick'em Slate)
   - Admin builds slate from ESPN games
   - Admin publishes slate
   - Everyone sees slate
   - Users submit home/away pick
   - Locks at game start (rules enforce it)
   ========================= */

function getRole() {
  return (localStorage.getItem(ROLE_KEY) || "guest").trim();
}

function slateIdFor(leagueKey, dateYYYYMMDD) {
  return `${leagueKey}__${dateYYYYMMDD}`;
}

function isPgaLeagueKey(k) {
  return String(k || "").toLowerCase() === "pga";
}

function fmtKickoff(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function kickoffMsFromEvent(ev) {
  const comp = ev?.competitions?.[0];
  const iso = ev?.date || comp?.date || "";
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function getMatchupNamesFromEvent(ev) {
  const comp = ev?.competitions?.[0];
  const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
  const home = competitors.find(c => c.homeAway === "home");
  const away = competitors.find(c => c.homeAway === "away");
  const homeName = getTeamDisplayNameUI(home?.team) || "Home";
  const awayName = getTeamDisplayNameUI(away?.team) || "Away";
  const iso = ev?.date || comp?.date || "";
  return { homeName, awayName, iso };
}

async function gpGetPublishedSlate(db, leagueKey, dateYYYYMMDD) {
  const q = db.collection("pickSlates")
    .where("leagueKey", "==", leagueKey)
    .where("dateYYYYMMDD", "==", dateYYYYMMDD)
    .where("published", "==", true)
    .limit(1);

  const snap = await q.get();
  if (snap.empty) return null;

  const doc0 = snap.docs[0];
  return { id: doc0.id, ...doc0.data() };
}

async function gpGetSlateGames(db, slateId) {
  const snap = await db.collection("pickSlates").doc(slateId).collection("games").get();
  const list = [];
  snap.forEach(d => list.push({ id: d.id, ...d.data() }));

  // sort by startTime if present
  list.sort((a,b) => {
    const at = a?.startTime?.toMillis ? a.startTime.toMillis() : 0;
    const bt = b?.startTime?.toMillis ? b.startTime.toMillis() : 0;
    return at - bt;
  });

  return list;
}

async function gpGetMyPicksMap(db, slateId, uid) {
  const snap = await db.collection("pickSlates").doc(slateId)
    .collection("picks").doc(uid)
    .collection("games")
    .get();

  const map = {};
  snap.forEach(d => map[d.id] = d.data());
  return map;
}

async function gpSaveMyPick(db, slateId, uid, eventId, side) {
  const ref = db.collection("pickSlates").doc(slateId)
    .collection("picks").doc(uid)
