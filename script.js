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

function showTab(tab) {
  const content = document.getElementById("content");
  content.innerHTML = "";

  if (tab === "scores") {
    loadScores();
  } else if (tab === "wagers") {
    content.innerHTML = "<h2>Friendly Wagers Coming Soon</h2>";
  } else if (tab === "shop") {
    content.innerHTML = "<h2>Shop Updates Coming Soon</h2>";
  }
}

async function loadScores() {
  const content = document.getElementById("content");
  content.innerHTML = "<h2>Loading...</h2>";

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const date = `${yyyy}${mm}${dd}`;

  try {
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${date}`
    );
    const data = await response.json();

    content.innerHTML = "<h2>Men's College Basketball</h2>";

    data.events.forEach(event => {
      const competition = event.competitions[0];
      const home = competition.competitors.find(t => t.homeAway === "home");
      const away = competition.competitors.find(t => t.homeAway === "away");

      const div = document.createElement("div");
      div.className = "game";
      div.innerHTML = `
        <strong>${away.team.displayName}</strong> ${away.score || 0}
        <br/>
        <strong>${home.team.displayName}</strong> ${home.score || 0}
        <br/>
        <small>${event.status.type.detail}</small>
      `;
      content.appendChild(div);
    });

  } catch (error) {
    content.innerHTML = "Error loading scores.";
  }
}
