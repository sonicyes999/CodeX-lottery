const state = {
  participants: [],
  prizes: [],
  winners: []
};

const $ = (id) => document.getElementById(id);

const THEME_KEY = "lottery_theme";

const DEMO_PARTICIPANTS = [
  "王小明,001,1",
  "陳小華,002,3",
  "林小美,003,2",
  "張大華,004,5",
  "李小安,005,2",
  "吳小婷,006,1"
].join("\n");

const DEMO_PRIZES = ["頭獎,1", "二獎,2", "三獎,3"].join("\n");

function initTheme() {
  const select = $("themeSelect");
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) {
    document.body.setAttribute("data-theme", saved);
    select.value = saved;
  }

  const onThemeChange = (theme) => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  };

  select.addEventListener("input", (e) => onThemeChange(e.target.value));
  select.addEventListener("change", (e) => onThemeChange(e.target.value));
}

function parseParticipants(raw) {
  return raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, idx) => {
      const [name, id, weightRaw] = line.split(",").map((v) => (v || "").trim());
      if (!name || !id) {
        throw new Error(`第 ${idx + 1} 行格式錯誤，需包含 姓名,編號`);
      }
      const weight = Math.max(1, Number(weightRaw || "1"));
      if (!Number.isFinite(weight)) {
        throw new Error(`第 ${idx + 1} 行權重無效`);
      }
      return { name, id, weight };
    });
}

function parsePrizes(raw) {
  return raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, idx) => {
      const [name, countRaw] = line.split(",").map((v) => (v || "").trim());
      if (!name || !countRaw) {
        throw new Error(`獎項第 ${idx + 1} 行格式錯誤，需為 獎項名稱,名額`);
      }
      const count = Number(countRaw);
      if (!Number.isInteger(count) || count <= 0) {
        throw new Error(`獎項第 ${idx + 1} 行名額必須為正整數`);
      }
      return { name, count };
    });
}

function weightedPick(pool) {
  const total = pool.reduce((sum, p) => sum + p.weight, 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return pool[pool.length - 1];
}

function simplePick(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function runDraw({ allowRepeat, useWeight }) {
  if (state.participants.length === 0) throw new Error("請先載入參與者");
  if (state.prizes.length === 0) throw new Error("請先載入獎項");

  const available = [...state.participants];
  const winners = [];

  for (const prize of state.prizes) {
    const prizeWinners = [];
    for (let i = 0; i < prize.count; i += 1) {
      if (available.length === 0) {
        throw new Error("可抽名單不足，請啟用重複中獎或減少名額");
      }

      const picked = useWeight ? weightedPick(available) : simplePick(available);
      prizeWinners.push(picked);

      if (!allowRepeat) {
        const index = available.findIndex((p) => p.id === picked.id);
        if (index >= 0) available.splice(index, 1);
      }
    }

    winners.push({ prize: prize.name, people: prizeWinners });
  }

  return winners;
}

function winnersToText(winners) {
  const lines = [];
  winners.forEach((group) => {
    lines.push(`【${group.prize}】`);
    group.people.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.name} (${p.id}) 權重=${p.weight}`);
    });
    lines.push("");
  });
  return lines.join("\n").trim();
}

function toCsv(rows, headers) {
  const escape = (v) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const head = headers.join(",");
  const body = rows.map((r) => headers.map((h) => escape(r[h])).join(",")).join("\n");
  return `${head}\n${body}`;
}

function download(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

function loadDemoData() {
  $("participantsInput").value = DEMO_PARTICIPANTS;
  $("prizesInput").value = DEMO_PRIZES;

  state.participants = parseParticipants(DEMO_PARTICIPANTS);
  state.prizes = parsePrizes(DEMO_PRIZES);

  $("participantsSummary").textContent = `已載入 ${state.participants.length} 位參與者（測試資料）`;
  const totalSeats = state.prizes.reduce((n, p) => n + p.count, 0);
  $("prizesSummary").textContent = `已載入 ${state.prizes.length} 個獎項，總名額 ${totalSeats}（測試資料）`;
  $("status").textContent = "✅ 已載入預設測試資料，可直接抽獎";
}

function bindEvents() {
  $("loadParticipantsBtn").addEventListener("click", () => {
    try {
      state.participants = parseParticipants($("participantsInput").value);
      $("participantsSummary").textContent = `已載入 ${state.participants.length} 位參與者`;
      $("status").textContent = "";
    } catch (err) {
      $("status").textContent = `❌ ${err.message}`;
    }
  });

  $("loadDemoBtn").addEventListener("click", () => {
    try {
      loadDemoData();
    } catch (err) {
      $("status").textContent = `❌ ${err.message}`;
    }
  });

  $("loadPrizesBtn").addEventListener("click", () => {
    try {
      state.prizes = parsePrizes($("prizesInput").value);
      const totalSeats = state.prizes.reduce((n, p) => n + p.count, 0);
      $("prizesSummary").textContent = `已載入 ${state.prizes.length} 個獎項，總名額 ${totalSeats}`;
      $("status").textContent = "";
    } catch (err) {
      $("status").textContent = `❌ ${err.message}`;
    }
  });

  $("drawAllBtn").addEventListener("click", () => {
    try {
      state.winners = runDraw({
        allowRepeat: $("allowRepeat").checked,
        useWeight: $("useWeight").checked
      });
      const text = winnersToText(state.winners);
      $("resultOutput").textContent = text;
      $("status").textContent = "✅ 抽獎完成";
    } catch (err) {
      $("status").textContent = `❌ ${err.message}`;
    }
  });

  $("copyParticipantsBtn").addEventListener("click", async () => {
    const text = $("participantsInput").value.trim();
    if (!text) return;
    await copyText(text);
    $("status").textContent = "✅ 已複製參與者名單";
  });

  $("copyWinnersBtn").addEventListener("click", async () => {
    if (!state.winners.length) return;
    await copyText(winnersToText(state.winners));
    $("status").textContent = "✅ 已複製中獎名單";
  });

  $("downloadParticipantsBtn").addEventListener("click", () => {
    if (!state.participants.length) return;
    const csv = toCsv(state.participants, ["name", "id", "weight"]);
    download("participants.csv", csv);
    $("status").textContent = "✅ 已下載參與者名單";
  });

  $("downloadWinnersBtn").addEventListener("click", () => {
    if (!state.winners.length) return;
    const rows = [];
    state.winners.forEach((w) => {
      w.people.forEach((p) => {
        rows.push({ prize: w.prize, name: p.name, id: p.id, weight: p.weight });
      });
    });
    const csv = toCsv(rows, ["prize", "name", "id", "weight"]);
    download("winners.csv", csv);
    $("status").textContent = "✅ 已下載中獎名單";
  });

  $("resetBtn").addEventListener("click", () => {
    state.participants = [];
    state.prizes = [];
    state.winners = [];
    $("participantsSummary").textContent = "";
    $("prizesSummary").textContent = "";
    $("resultOutput").textContent = "尚未抽獎";
    $("status").textContent = "已清除資料";
  });
}

initTheme();
bindEvents();
loadDemoData();
