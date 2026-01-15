// ======================
// GRUND-DATEN
// ======================
const MAX_OFFLINE_HOURS = 8;

const ISLANDS = [
  { name: "Startinsel", bonus: { type: null, value: 0 } },
  { name: "Waldinsel", bonus: { type: "wood", value: 0.3 } },
  { name: "Industrieinsel", bonus: { type: "upgrade", value: 0.2 } }
];

const BUILDING_TYPES = {
  wood: {
    name: "Holzfäller",
    cost: 50,
    produces: { wood: 1 }
  },
  plank: {
    name: "Sägewerk",
    cost: 150,
    needs: { wood: 1 },
    produces: { plank: 1 }
  },
  furniture: {
    name: "Möbelfabrik",
    cost: 400,
    needs: { plank: 1 },
    produces: { money: 5 }
  }
};

const MANAGERS = [
  { name: "Produktionsmanager", cost: 500, bonus: 0.25 },
  { name: "Offline-Manager", cost: 800, offlineBonus: 0.5 }
];

// ======================
// GAME STATE
// ======================
let game = {
  money: 0,
  islandIndex: 0,
  islands: [
    { tiles: {}, resources: { wood: 0, plank: 0 } }
  ],
  managers: [],
  lastTime: Date.now()
};

// ======================
// INIT MAP
// ======================
const mapEl = document.getElementById("map");
function createMap() {
  mapEl.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const t = document.createElement("div");
    t.className = "tile";
    t.dataset.id = i;
    mapEl.appendChild(t);
  }
}
createMap();

// ======================
// SAVE / LOAD
// ======================
function saveGame() {
  game.lastTime = Date.now();
  localStorage.setItem("pct_save", JSON.stringify(game));
}

function loadGame() {
  const save = localStorage.getItem("pct_save");
  if (save) {
    game = JSON.parse(save);
    applyOfflineEarnings();
  }
  updateUI();
}

// ======================
// OFFLINE EARNINGS
// ======================
function applyOfflineEarnings() {
  const now = Date.now();
  let diff = (now - game.lastTime) / 1000;
  const max = MAX_OFFLINE_HOURS * 3600;
  diff = Math.min(diff, max);

  let incomePerSecond = calculateIncomePerSecond();
  let offlineBonus = game.managers.some(m => m.offlineBonus) ? 1.5 : 1;

  const earned = Math.floor(incomePerSecond * diff * offlineBonus);
  game.money += earned;

  if (earned > 0) {
    alert(`Willkommen zurück!\nOffline verdient: ${earned} Münzen`);
  }
}

// ======================
// PRODUKTION
// ======================
function calculateIncomePerSecond() {
  let income = 0;
  const island = game.islands[game.islandIndex];

  Object.values(island.tiles).forEach(b => {
    if (b.produces?.money) {
      income += b.produces.money * b.level;
    }
  });

  // Manager Bonus
  game.managers.forEach(m => {
    if (m.bonus) income *= 1 + m.bonus;
  });

  return income;
}

// ======================
// GAME LOOP
// ======================
setInterval(() => {
  const island = game.islands[game.islandIndex];

  // Ressourcenproduktion
  Object.values(island.tiles).forEach(b => {
    // Rohstoffe
    if (b.produces?.wood) island.resources.wood += b.produces.wood * b.level;
    if (b.produces?.plank) {
      if (island.resources.wood >= b.needs.wood) {
        island.resources.wood -= b.needs.wood;
        island.resources.plank += b.produces.plank * b.level;
      }
    }
    if (b.produces?.money) {
      if (!b.needs || island.resources.plank >= b.needs.plank) {
        if (b.needs?.plank) island.resources.plank -= b.needs.plank;
        game.money += b.produces.money * b.level;
      }
    }
  });

  updateUI();
}, 1000);

// ======================
// UI
// ======================
function updateUI() {
  document.getElementById("money").innerText = "💰 " + Math.floor(game.money);
  document.getElementById("islandName").innerText =
    "🏝 " + ISLANDS[game.islandIndex].name;

  const island = game.islands[game.islandIndex];

  document.querySelectorAll(".tile").forEach(tile => {
    const id = tile.dataset.id;
    tile.innerHTML = "";
    const b = island.tiles[id];
    if (b) {
      const el = document.createElement("div");
      el.className = "building";
      el.innerHTML = `${b.name}<br>Lvl ${b.level}`;
      tile.appendChild(el);
    }
  });

  document.getElementById("infoBox").innerText =
    `Rohstoffe: 🌲${island.resources.wood} | 🪵${island.resources.plank}`;
}

// ======================
// BAUEN
// ======================
document.getElementById("buildBtn").onclick = () => {
  let msg = "Gebäude bauen:\n";
  let i = 1;
  const keys = Object.keys(BUILDING_TYPES);
  keys.forEach(k => {
    msg += `${i}. ${BUILDING_TYPES[k].name} (${BUILDING_TYPES[k].cost})\n`;
    i++;
  });

  const choice = prompt(msg);
  const typeKey = keys[choice - 1];
  if (!typeKey) return;

  const tile = prompt("Auf welches Feld? (0-5)");
  const island = game.islands[game.islandIndex];

  if (island.tiles[tile]) return alert("Feld belegt!");
  if (game.money < BUILDING_TYPES[typeKey].cost) return alert("Zu wenig Geld!");

  game.money -= BUILDING_TYPES[typeKey].cost;
  island.tiles[tile] = {
    ...BUILDING_TYPES[typeKey],
    level: 1
  };
  saveGame();
  updateUI();
};

// ======================
// UPGRADES
// ======================
document.getElementById("upgradeBtn").onclick = () => {
  const tile = prompt("Welches Feld upgraden?");
  const island = game.islands[game.islandIndex];
  const b = island.tiles[tile];
  if (!b) return alert("Kein Gebäude!");

  let cost = b.level * 100;

  // Industrieinsel Bonus
  if (ISLANDS[game.islandIndex].bonus.type === "upgrade") {
    cost *= 1 - ISLANDS[game.islandIndex].bonus.value;
  }

  if (game.money < cost) return alert("Zu wenig Geld!");

  game.money -= cost;
  b.level++;
  alert(`${b.name} ist jetzt Level ${b.level}`);
  saveGame();
  updateUI();
};

// ======================
// MANAGER
// ======================
document.getElementById("managerBtn").onclick = () => {
  let msg = "Manager einstellen:\n";
  MANAGERS.forEach((m, i) => {
    msg += `${i + 1}. ${m.name} (${m.cost})\n`;
  });

  const c = prompt(msg);
  const m = MANAGERS[c - 1];
  if (!m) return;

  if (game.money < m.cost) return alert("Zu wenig Geld!");
  game.money -= m.cost;
  game.managers.push(m);
  alert(`${m.name} eingestellt!`);
  saveGame();
};

// ======================
// INSEL WECHSEL
// ======================
document.getElementById("nextIslandBtn").onclick = () => {
  if (game.islandIndex < ISLANDS.length - 1) {
    game.islandIndex++;
    if (!game.islands[game.islandIndex]) {
      game.islands.push({ tiles: {}, resources: { wood: 0, plank: 0 } });
    }
  } else {
    game.islandIndex = 0;
  }
  updateUI();
};

// ======================
// NEUES SPIEL
// ======================
document.getElementById("newGameBtn").onclick = () => {
  if (confirm("Willst du wirklich neu starten?")) {
    localStorage.removeItem("pct_save");
    location.reload();
  }
};

// ======================
loadGame();
