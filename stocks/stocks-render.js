// stocks/stocks-render.js
// Stocks tab — placeholder charts (WMT stock + XRP crypto) while the
// real feature set is redesigned. Pulls daily history from /api/history
// (Yahoo Finance chart proxy) and draws a plain canvas line chart.

(function () {
  "use strict";

  const CHARTS = [
    { ticker: "WMT",     label: "Walmart Inc.",   kind: "Stock"  },
    { ticker: "XRP-USD", label: "XRP / USD",      kind: "Crypto" },
  ];

  function fmtPrice(n) {
    if (n === null || n === undefined || isNaN(n)) return "--";
    return n >= 1
      ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  }

  function drawLineChart(canvas, closes) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const pad = 8;
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = (max - min) || 1;
    const up = closes[closes.length - 1] >= closes[0];
    const lineColor = up ? "#22c55e" : "#ef4444";

    const points = closes.map((c, i) => {
      const x = pad + (i / (closes.length - 1)) * (w - pad * 2);
      const y = h - pad - ((c - min) / range) * (h - pad * 2);
      return [x, y];
    });

    // Fill under the line
    ctx.beginPath();
    ctx.moveTo(points[0][0], h - pad);
    points.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(points[points.length - 1][0], h - pad);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, up ? "rgba(34,197,94,0.20)" : "rgba(239,68,68,0.20)");
    grad.addColorStop(1, "rgba(34,197,94,0)");
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  async function fetchHistory(ticker) {
    const res = await fetch(`/api/history?ticker=${encodeURIComponent(ticker)}`);
    if (!res.ok) throw new Error(`History fetch failed (${res.status})`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const closes = result?.indicators?.quote?.[0]?.close;
    if (!result || !Array.isArray(closes)) throw new Error("Malformed history response");
    return closes.filter((c) => typeof c === "number");
  }

  async function loadCard(card) {
    const canvas   = document.getElementById(`stockChart-${card.ticker}`);
    const priceEl  = document.getElementById(`stockPrice-${card.ticker}`);
    const changeEl = document.getElementById(`stockChange-${card.ticker}`);
    const statusEl = document.getElementById(`stockStatus-${card.ticker}`);
    if (!canvas) return;

    try {
      const closes = await fetchHistory(card.ticker);
      if (closes.length < 2) throw new Error("Not enough data points");

      const last  = closes[closes.length - 1];
      const first = closes[0];
      const pct   = ((last - first) / first) * 100;
      const up    = pct >= 0;

      if (priceEl) priceEl.textContent = fmtPrice(last);
      if (changeEl) {
        changeEl.textContent = `${up ? "▲" : "▼"} ${Math.abs(pct).toFixed(2)}% (3mo)`;
        changeEl.className = "stock-change " + (up ? "stock-up" : "stock-down");
      }
      if (statusEl) statusEl.remove();

      drawLineChart(canvas, closes);
    } catch (err) {
      console.error(`[Stocks] Failed to load ${card.ticker}:`, err);
      if (statusEl) statusEl.textContent = "Unable to load chart data.";
    }
  }

  function renderStocks() {
    const content = document.getElementById("content");
    if (!content) return;

    content.innerHTML =
      '<div class="stocks-wrap">' +
        '<div class="stocks-header">' +
          '<div class="stocks-title">📈 Stocks</div>' +
          '<div class="stocks-subtitle">Placeholder charts — more coming later</div>' +
        '</div>' +
        '<div class="stock-card-grid">' +
          CHARTS.map((c) => (
            '<div class="stock-card">' +
              '<div class="stock-card-header">' +
                `<div class="stock-name">${c.label}</div>` +
                `<div class="stock-kind">${c.kind}</div>` +
              '</div>' +
              '<div class="stock-price-row">' +
                `<span class="stock-ticker">${c.ticker}</span>` +
                `<span class="stock-price" id="stockPrice-${c.ticker}">--</span>` +
                `<span class="stock-change" id="stockChange-${c.ticker}"></span>` +
              '</div>' +
              '<div class="stock-canvas-wrap">' +
                `<canvas id="stockChart-${c.ticker}"></canvas>` +
                `<div class="stock-status" id="stockStatus-${c.ticker}">Loading chart...</div>` +
              '</div>' +
            '</div>'
          )).join("") +
        '</div>' +
      '</div>';

    CHARTS.forEach(loadCard);
  }

  window.renderStocks = renderStocks;
  console.log("[Stocks] Render module loaded (placeholder charts).");
})();
