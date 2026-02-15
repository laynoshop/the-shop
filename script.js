let refreshIntervalId = null;
let currentTab = null;

function checkCode() {
  const code = document.getElementById("code").value;
  if (code === "2026") {
    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";
    showTab("scores");
  } else {
    alert("Wrong code");
  }
}

function setActiveTabButton(tab) {
  document.querySelectorAll(".tabs button").forEach(btn => btn.classList.remove("active"));
  const map = { scores: 0, wagers: 1, shop: 2 };
  const idx = map[tab];
  const btn = document.querySelectorAll(".tabs button")[idx];
  if (btn) btn.classList.add("active");
}

function stopAutoRefresh() {
  if (refreshIntervalId) clearInterval(refreshIntervalId);
  refreshIntervalId = null;
}

function startAutoRefresh() {
  stopAutoRefresh();
  // refresh every 20 seconds while on Scores
  refreshIntervalId = setInterval(() => {
    if (currentTab === "scores") loadScores(false);
  }, 20000);
}

function showTab(tab) {
  currentTab = tab;
  setActiveTabButton(tab);

  stopAutoRefresh();

  const content = document.getElementById("content");
  content.innerHTML = "";

  if (tab === "scores") {
    loadScores(true);
    startAutoRefresh();
  } else if (tab === "wagers") {
    content.innerHTML = `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Friendly Wagers</h2>
            <span class="badge">v0.1</span>
          </div>
        </div>
        <div class="subline">
          <div>Coming next</div>
          <div>Invite-only</div>
        </div>
      </div>
      <div class="notice">We’ll add “pick a winner” wagers after the scoreboard polish.</div>
    `;
  } else if (tab === "shop") {
    content.innerHTML = `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Shop Updates</h2>
            <span class="badge">v0.1</span>
          </div>
        </div>
        <div class="subline">
          <div>Photos + notes</div>
          <div>Buckeye build</div>
        </div>
      </div>
      <div class="notice">We’ll add a post feed (text + photos) after wagers.</div>
    `;
  }
}

function formatDateYYYYMMDD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function statusClassFromState(state) {
  // ESPN states commonly: "pre", "in", "post"
  if (state === "in") return "status-live";
  if (state === "post") return "status-final";
  if (state === "pre") return "status-up";
  return "status-other";
}

function statusLabelFromState(state, detail) {
  if (state === "in") return `LIVE • ${detail}`;
  if (state === "post") return `FINAL`;
  if (state === "pre") return `${detail}`;
  return detail || "STATUS";
}

async function loadScores(showLoading) {
  const content = document.getElementById("content");
  const now = new Date();
  const date = formatDateYYYYMMDD(now);
  const updatedTime = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (showLoading) {
    content.innerHTML = `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Scores</h2>
            <span class="badge">NCAAM</span>
          </div>
          <button class="smallBtn" onclick="loadScores(true)">Refresh</button>
        </div>
        <div class="subline">
          <div>Men’s College Basketball</div>
          <div>Loading…</div>
        </div>
      </div>
      <div class="notice">Grabbing today’s games…</div>
    `;
  }

  try {
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${date}`
    );
    const data = await response.json();

    const events = Array.isArray(data.events) ? data.events : [];

    // Build header
    content.innerHTML = `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Scores</h2>
            <span class="badge">The Shop</span>
          </div>
          <button class="smallBtn" onclick="loadScores(true)">Refresh</button>
        </div>
        <div class="subline">
          <div>Men’s College Basketball</div>
          <div>Updated ${updatedTime}</div>
        </div>
      </div>
    `;

    if (events.length === 0) {
      content.innerHTML += `<div class="notice">No games found for today.</div>`;
      return;
    }

    // Grid
    const grid = document.createElement("div");
    grid.className = "grid";

    events.forEach(event => {
      const competition = event?.competitions?.[0];
      if (!competition) return;

      const home = competition.competitors.find(t => t.homeAway === "home");
      const away = competition.competitors.find(t => t.homeAway === "away");

      const state = event?.status?.type?.state || "unknown";
      const detail = event?.status?.type?.detail || "Status unavailable";
      const pillClass = statusClassFromState(state);
      const pillText = statusLabelFromState(state, detail);

      const homeScore = home?.score ? parseInt(home.score, 10) : (state === "pre" ? "" : "0");
      const awayScore = away?.score ? parseInt(away.score, 10) : (state === "pre" ? "" : "0");

      const homeName = home?.team?.displayName || "Home";
      const awayName = away?.team?.displayName || "Away";

      const card = document.createElement("div");
      card.className = "game";

      card.innerHTML = `
        <div class="gameHeader">
          <div class="statusPill ${pillClass}">${pillText}</div>
        </div>

        <div class="teamRow">
          <div class="teamLeft">
            <div class="teamName">${awayName}</div>
            <div class="teamMeta">Away</div>
          </div>
          <div class="score">${awayScore}</div>
        </div>

        <div class="teamRow">
          <div class="teamLeft">
            <div class="teamName">${homeName}</div>
            <div class="teamMeta">Home</div>
          </div>
          <div class="score">${homeScore}</div>
        </div>

        <div class="footerLine">
          <div>${competition?.status?.type?.shortDetail || ""}</div>
          <div style="color: rgba(187,0,0,0.9); font-weight:900;">⬤</div>
        </div>
      `;

      grid.appendChild(card);
    });

    content.appendChild(grid);

  } catch (error) {
    content.innerHTML = `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Scores</h2>
            <span class="badge">The Shop</span>
          </div>
          <button class="smallBtn" onclick="loadScores(true)">Retry</button>
        </div>
        <div class="subline">
          <div>Men’s College Basketball</div>
          <div>Error</div>
        </div>
      </div>
      <div class="notice">Couldn’t load scores right now.</div>
    `;
  }
}
