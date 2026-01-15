// ================= CONFIG =================
const GRID_ROWS = 12;
const GRID_COLS = 12;
const START_MONEY = 300;
const START_GEMS = 0;
const MAX_OFFLINE_HOURS = 8;
const TICK_INTERVAL = 1000;

// ================= RESOURCES =================
const RESOURCES = ["wood","plank","ice","ore","fruit","lava","obsidian"];

// ================= ISLANDS =================
const ISLANDS = [
  {id:0,name:"Startinsel",resources:["wood","plank"]},
  {id:1,name:"Eisinsel",resources:["ice","ore"]},
  {id:2,name:"Vulkaninsel",resources:["lava","obsidian"]},
  {id:3,name:"Dschungelinsel",resources:["fruit","wood"]}
];

// ================= BUILDINGS =================
const BUILDINGS = {
  road:{name:"Straße",cost:5,type:"road"},
  lumberjack:{name:"Holzfäller",cost:50,type:"producer",produces:{wood:1}},
  sawmill:{name:"Sägewerk",cost:120,type:"processor",needs:{wood:1},produces:{plank:1}},
  iceFactory:{name:"Eisfabrik",cost:100,type:"producer",produces:{ice:1}},
  fruitFarm:{name:"Obstfarm",cost:80,type:"producer",produces:{fruit:1}},
  lavaPlant:{name:"Lava-Schmelze",cost:200,type:"producer",produces:{lava:1}},
  obsidianWorkshop:{name:"Obsidian-Werk",cost:250,type:"processor",needs:{lava:1},produces:{obsidian:1}},
  storage:{name:"Lager",cost:80,type:"storage",capacity:50},
  harbor:{name:"Hafen",cost:200,type:"harbor",exportRate:2}
};

// ================= QUESTS =================
const QUESTS = [
  {id:"q1",text:"Produziere 50 Holz",type:"resource",resource:"wood",amount:50,reward:{money:100}},
  {id:"q2",text:"Baue 3 Lager",type:"building",building:"Lager",amount:3,reward:{money:200}},
  {id:"q3",text:"Exportiere 20 Planken",type:"export",resource:"plank",amount:20,reward:{money:300}},
  {id:"q4",text:"Baue 3 Straßen",type:"building",building:"Straße",amount:3,reward:{money:50}},
  {id:"q5",text:"Baue einen Hafen",type:"building",building:"Hafen",amount:1,reward:{money:150}},
  {id:"q6",text:"Produziere 100 Planken",type:"resource",resource:"plank",amount:100,reward:{money:200}},
  {id:"q7",text:"Verkaufe 50 Holz an Händler",type:"trade",resource:"wood",amount:50,reward:{money:200}}
];

// ================= SKILLS =================
const SKILLS = [
  {id:"prodBoost",text:"+10% Produktion",level:0,max:5,cost:50},
  {id:"storageBoost",text:"+50 Lagerkapazität",level:0,max:3,cost:100}
];

// ================= GAME STATE =================
let game = {
  money: START_MONEY,
  gems: START_GEMS,
  prestige: {points:0,multiplier:1},
  islands: [],
  islandIndex: 0,
  unlockedIslands: [0],
  quests: QUESTS.map(q=>({...q,progress:0,completed:false})),
  skills: SKILLS.map(s=>({...s})),
  dailyClaim:0,
  tutorialStep:0,
  lastTime: Date.now(),
  offlineTime:0
};

// ================= INIT ISLANDS =================
function createIslandTiles(){
  return Array.from({length:GRID_ROWS},(_,y)=>Array.from({length:GRID_COLS},(_,x)=>{
    const dist=Math.hypot(x-(GRID_COLS-1)/2,y-(GRID_ROWS-1)/2);
    return {type:dist<6?"land":"water",building:null};
  }));
}

function initIslands(){
  game.islands = ISLANDS.map(i=>({...i,tiles:createIslandTiles(),resources:{}}));
  game.islands.forEach(is=>{
    RESOURCES.forEach(r=>is.resources[r]=0);
    // Anfangslager in der Mitte
    const cx = Math.floor(GRID_COLS/2), cy = Math.floor(GRID_ROWS/2);
    is.tiles[cy][cx].building = {...BUILDINGS.storage,level:1};
  });
}

// ================= SAVE / LOAD =================
function saveGame(){localStorage.setItem("pct_save",JSON.stringify(game));}
function loadGame(){const s=localStorage.getItem("pct_save"); if(s){game=JSON.parse(s);}}
loadGame();

// ================= MAP =================
const mapEl = document.getElementById("map");
let selectedTile = null;

function renderMap(){
  mapEl.innerHTML="";
  const island = game.islands[game.islandIndex];
  const size = 40;
  island.tiles.forEach((row,y)=>{
    row.forEach((cell,x)=>{
      const rect=document.createElementNS("http://www.w3.org/2000/svg","rect");
      rect.setAttribute("x",x*size);
      rect.setAttribute("y",y*size);
      rect.setAttribute("width",size-2);
      rect.setAttribute("height",size-2);
      rect.setAttribute("class","tile "+cell.type);
      rect.onclick=()=>openBuildOverlay(x,y);
      mapEl.appendChild(rect);

      if(cell.building){
        const text=document.createElementNS("http://www.w3.org/2000/svg","text");
        text.setAttribute("x",x*size+size/2);
        text.setAttribute("y",y*size+size/2);
        text.setAttribute("text-anchor","middle");
        text.setAttribute("alignment-baseline","middle");
        text.setAttribute("fill","#000");
        text.setAttribute("font-size","10");
        text.textContent=`${cell.building.name} Lv.${cell.building.level}`;
        mapEl.appendChild(text);
      }
    });
  });

  // Ressourcen UI oben
  const resUI = document.getElementById("resourceUI");
  resUI.innerHTML="";
  const res = game.islands[game.islandIndex].resources;
  Object.keys(res).forEach(r=>{
    if(ISLANDS[game.islandIndex].resources.includes(r)){
      const span=document.createElement("span");
      span.textContent=`${r}: ${Math.floor(res[r])}`;
      span.style.margin="0 5px";
      resUI.appendChild(span);
    }
  });
}

// ================= BUILD / DEMOLISH =================
const overlay = document.getElementById("overlay");
const buildOptions = document.getElementById("buildOptions");
document.getElementById("closeOverlay").onclick = ()=>overlay.classList.add("hidden");

function openBuildOverlay(x,y){
  selectedTile={x,y};
  const cell = game.islands[game.islandIndex].tiles[y][x];
  if(cell.type!=="land") return;

  buildOptions.innerHTML="";
  if(cell.building){
    const demolishBtn = document.createElement("button");
    demolishBtn.textContent=`Abreißen (${cell.building.name})`;
    demolishBtn.onclick=()=>{
      cell.building=null;
      overlay.classList.add("hidden");
      updateUI();
    };
    buildOptions.appendChild(demolishBtn);

    const upgradeBtn = document.createElement("button");
    upgradeBtn.textContent=`Upgrade (Lv.${cell.building.level})`;
    upgradeBtn.onclick=()=>{
      if(game.money<Math.floor(cell.building.cost*1.5)) return alert("Nicht genug Geld!");
      game.money -= Math.floor(cell.building.cost*1.5);
      cell.building.level++;
      overlay.classList.add("hidden");
      updateUI();
    };
    buildOptions.appendChild(upgradeBtn);

  } else {
    Object.keys(BUILDINGS).forEach(k=>{
      const b = BUILDINGS[k];
      if(b.produces){
        const keys = Object.keys(b.produces);
        if(!keys.every(r=>ISLANDS[game.islandIndex].resources.includes(r))) return;
      }
      const btn = document.createElement("button");
      btn.textContent = `${b.name} (${b.cost}💰)`;
      btn.onclick = ()=>{
        if(game.money < b.cost) return alert("Nicht genug Geld!");
        game.money -= b.cost;
        cell.building = {...b,level:1};
        overlay.classList.add("hidden");
        updateUI();
      };
      buildOptions.appendChild(btn);
    });
  }
  overlay.classList.remove("hidden");
}

// ================= QUESTS =================
function checkQuests(){
  const island = game.islands[game.islandIndex];
  game.quests.forEach(q=>{
    if(q.completed) return;
    if(q.type==="resource") q.progress = island.resources[q.resource]||0;
    if(q.type==="building"){
      let cnt=0;
      island.tiles.flat().forEach(t=>{if(t.building&&t.building.name===q.building) cnt++;});
      q.progress=cnt;
    }
    if(q.type==="trade"){} // Verkauf wird über Händler aktualisiert
    if(q.progress>=q.amount){
      q.completed=true;
      game.money += q.reward.money;
      showPopUp(`Quest abgeschlossen: ${q.text} +${q.reward.money}💰`);
    }
  });
}

// ================= SKILL-TREE =================
const skillOverlay = document.getElementById("skillOverlay");
const skillTreeDiv = document.getElementById("skillTree");

document.getElementById("skillBtn").onclick = ()=>{
  renderSkillTree();
  skillOverlay.classList.remove("hidden");
};

document.getElementById("closeSkills").onclick = ()=>skillOverlay.classList.add("hidden");

function renderSkillTree(){
  skillTreeDiv.innerHTML = "";
  game.skills.forEach(skill=>{
    const div = document.createElement("div");
    div.style.margin = "5px 0";
    div.style.border = "1px solid #222";
    div.style.padding = "5px";
    div.style.borderRadius = "5px";
    div.style.background = "#eee";

    const title = document.createElement("span");
    title.textContent = `${skill.text} (Lv.${skill.level}/${skill.max})`;
    div.appendChild(title);

    const btn = document.createElement("button");
    btn.textContent = `Kaufen (${skill.cost}💰)`;
    btn.style.marginLeft="10px";
    btn.onclick = ()=>{
      if(skill.level>=skill.max) return alert("Max Level erreicht!");
      if(game.money < skill.cost) return alert("Nicht genug Geld!");
      game.money -= skill.cost;
      skill.level++;
      applySkillEffects(skill.id);
      renderSkillTree();
      updateUI();
    };
    div.appendChild(btn);
    skillTreeDiv.appendChild(div);
  });
}

function applySkillEffects(skillId){
  if(skillId==="prodBoost"){
    game.prestige.multiplier = 1 + (game.skills.find(s=>s.id==="prodBoost").level*0.1);
  }
}

// ================= HÄNDLER =================
const traders = [
  {id:0,name:"Holz-Händler",wants:"wood",price:5},
  {id:1,name:"Planken-Händler",wants:"plank",price:10},
  {id:2,name:"Obst-Händler",wants:"fruit",price:8},
  {id:3,name:"Eis-Händler",wants:"ice",price:6}
];

let traderOverlay = document.createElement("div");
traderOverlay.className = "overlayBox hidden";
traderOverlay.id = "traderOverlay";
document.body.appendChild(traderOverlay);

function openTrader(){
  const island = game.islands[game.islandIndex];
  traderOverlay.innerHTML = "<h3>Händler</h3>";
  traders.forEach(tr=>{
    if(!ISLANDS[game.islandIndex].resources.includes(tr.wants)) return;
    const div = document.createElement("div");
    div.style.margin="5px 0";
    div.textContent = `${tr.name} kauft ${tr.wants} für ${tr.price}💰 pro Einheit. Du hast: ${island.resources[tr.wants] || 0}`;

    const sellBtn = document.createElement("button");
    sellBtn.textContent = "Verkaufen 10";
    sellBtn.style.marginLeft="10px";
    sellBtn.onclick = ()=>{
      const available = island.resources[tr.wants]||0;
      const sellAmount = Math.min(10,available);
      if(sellAmount<=0) return alert("Keine Ressourcen!");
      island.resources[tr.wants]-=sellAmount;
      const gain = sellAmount*tr.price;
      game.money += gain;
      showPopUp(`Du hast ${sellAmount} ${tr.wants} verkauft +${gain}💰`);

      // Quests aktualisieren
      game.quests.forEach(q=>{
        if(q.completed) return;
        if(q.type==="trade" && q.resource===tr.wants){
          q.progress += sellAmount;
          if(q.progress>=q.amount){
            q.completed=true;
            game.money += q.reward.money;
            showPopUp(`Quest abgeschlossen: ${q.text} +${q.reward.money}💰`);
          }
        }
      });
      updateUI();
      openTrader();
    };
    div.appendChild(sellBtn);
    traderOverlay.appendChild(div);
  });

  const closeBtn = document.createElement("button");
  closeBtn.textContent="Schließen";
  closeBtn.onclick=()=>traderOverlay.classList.add("hidden");
  closeBtn.style.marginTop="10px";
  traderOverlay.appendChild(closeBtn);

  traderOverlay.classList.remove("hidden");
}

// Trader Button
const traderBtn = document.createElement("button");
traderBtn.textContent="Händler";
traderBtn.onclick = openTrader;
document.querySelector("footer").appendChild(traderBtn);

// ================= TUTORIAL =================
const tutorialOverlay = document.getElementById("tutorialOverlay");
const tutorialText = document.getElementById("tutorialText");
const tutorialNext = document.getElementById("tutorialNext");

const tutorialSteps = [
  "Willkommen zu Production Chain Tycoon! Lass uns starten.",
  "Zuerst baue eine Straße neben deinem Lager.",
  "Jetzt baue ein Lager, um Ressourcen zu speichern.",
  "Platziere einen Holzfäller auf der Insel, um Holz zu produzieren.",
  "Super! Produktion startet, sobald Gebäude mit Lager verbunden sind.",
  "Tutorial abgeschlossen! Viel Spaß!"
];

tutorialNext.onclick = ()=>{
  game.tutorialStep++;
  if(game.tutorialStep >= tutorialSteps.length){
    tutorialOverlay.classList.add("hidden");
    localStorage.setItem("tutorialCompleted","true");
  } else tutorialText.textContent = tutorialSteps[game.tutorialStep];
};

// ================= TÄGLICHE BELOHNUNG =================
const dailyOverlay = document.getElementById("dailyOverlay");
const dailyText = document.getElementById("dailyText");
const claimDaily = document.getElementById("claimDaily");
const closeDaily = document.getElementById("closeDaily");

document.getElementById("dailyBtn").onclick = ()=>{
  const last = game.dailyClaim;
  const now = new Date().getDate();
  if(last === now){
    dailyText.textContent = "Du hast die tägliche Belohnung bereits abgeholt!";
    claimDaily.disabled = true;
  } else {
    dailyText.textContent = "Abholung möglich!";
    claimDaily.disabled = false;
  }
  dailyOverlay.classList.remove("hidden");
};

claimDaily.onclick = ()=>{
  game.money += 100;
  game.gems += 1;
  game.dailyClaim = new Date().getDate();
  showPopUp("Tägliche Belohnung: +100💰 +1💎");
  updateUI();
  dailyOverlay.classList.add("hidden");
};

closeDaily.onclick = ()=>dailyOverlay.classList.add("hidden");

// ================= PRESTIGE =================
const prestigeBtn = document.getElementById("prestigeBtn");
prestigeBtn.onclick = ()=>{
  if(confirm("Prestige zurücksetzen? Du verlierst alles für einen Multiplikator.")){
    const gained = Math.floor(game.money/1000);
    game.prestige.points += gained;
    game.prestige.multiplier = 1 + game.prestige.points*0.1;
    startNewGame();
    showPopUp(`Prestige aktiviert! Multiplikator: x${game.prestige.multiplier.toFixed(1)}`);
  }
};

// ================= NEUES SPIEL =================
document.getElementById("newGameBtn").onclick = ()=>{
  if(confirm("Neues Spiel starten? Dein aktueller Fortschritt geht verloren!")){
    startNewGame();
  }
};

function startNewGame(){
  game.money = START_MONEY;
  game.gems = START_GEMS;
  game.prestige = {points:game.prestige.points,multiplier:game.prestige.multiplier};
  game.islandIndex = 0;
  game.unlockedIslands = [0];
  game.skills = SKILLS.map(s=>({...s,level:0}));
  game.quests = QUESTS.map(q=>({...q,progress:0,completed:false}));
  game.dailyClaim = 0;
  game.tutorialStep = 0;
  game.lastTime = Date.now();
  game.offlineTime = 0;

  initIslands();

  if(!localStorage.getItem("tutorialCompleted")){
    startTutorial();
  }

  updateUI();
  saveGame();
}

// ================= GAME LOOP =================
function tick(){
  const now = Date.now();
  const delta = (now - game.lastTime)/1000;
  game.lastTime = now;

  game.islands.forEach(is=>{
    let totalStorage = 0;
    let connected = false;
    is.tiles.flat().forEach(t=>{    if(t.building && t.building.type==="storage") totalStorage += t.building.capacity;
  });

  // Prüfen: Verbindung Lager → Straße (einfache BFS für Nachbarschaft)
  const visited = Array.from({length:GRID_ROWS},()=>Array(GRID_COLS).fill(false));
  const queue = [];
  is.tiles.flat().forEach((t,idx)=>{
    if(t.building && t.building.type==="storage") queue.push({x:idx%GRID_COLS, y:Math.floor(idx/GRID_COLS)});
  });

  while(queue.length>0){
    const {x,y} = queue.shift();
    if(visited[y][x]) continue;
    visited[y][x]=true;
    const neighbors = [
      {x:x+1,y:y},{x:x-1,y:y},{x:x,y:y+1},{x:x,y:y-1}
    ];
    neighbors.forEach(n=>{
      if(n.x>=0 && n.x<GRID_COLS && n.y>=0 && n.y<GRID_ROWS){
        const nb = is.tiles[n.y][n.x];
        if((nb.building && nb.building.type==="road") && !visited[n.y][n.x]){
          queue.push({x:n.x,y:n.y});
        }
      }
    });
  }

  // Produktion
  is.tiles.flat().forEach((t,idx)=>{
    if(!t.building) return;
    if(t.building.type==="producer" || t.building.type==="processor"){
      const x = idx % GRID_COLS, y = Math.floor(idx / GRID_COLS);
      if(!visited[y][x]) return; // Nur verbunden
      Object.keys(t.building.produces||{}).forEach(r=>{
        const amt = t.building.produces[r]*t.building.level*game.prestige.multiplier;
        if((is.resources[r]||0)+amt>totalStorage) return;
        is.resources[r] = (is.resources[r]||0)+amt;
        animateResource(x,y,r,amt);
      });
    }

    // Hafen: Exportieren
    if(t.building.type==="harbor"){
      Object.keys(is.resources).forEach(r=>{
        if(r==="plank"){ // Beispiel: nur Plank exportieren
          const amt = Math.min(t.building.exportRate*t.building.level,is.resources[r]);
          if(amt>0){
            is.resources[r]-=amt;
            game.money += amt*5*game.prestige.multiplier;
            animateShip(x,y);
            // Export-Quest aktualisieren
            game.quests.forEach(q=>{
              if(q.completed) return;
              if(q.type==="export" && q.resource===r){
                q.progress+=amt;
                if(q.progress>=q.amount){
                  q.completed=true;
                  game.money += q.reward.money;
                  showPopUp(`Quest abgeschlossen: ${q.text} +${q.reward.money}💰`);
                }
              }
            });
          }
        }
      });
    }
  });
  checkQuests();
  updateUI();
  saveGame();
}

setInterval(tick,TICK_INTERVAL);

// ================= POP-UP =================
function showPopUp(msg){
  const div=document.createElement("div");
  div.textContent = msg;
  div.style.position="fixed";
  div.style.top="10%";
  div.style.left="50%";
  div.style.transform="translateX(-50%)";
  div.style.padding="10px 20px";
  div.style.background="#222";
  div.style.border="2px solid #fff";
  div.style.borderRadius="8px";
  div.style.color="#fff";
  div.style.zIndex=50;
  document.body.appendChild(div);
  setTimeout(()=>div.remove(),2000);
}

// ================= RESOURCE ANIMATION =================
function animateResource(x,y,resource,amount){
  const size = 40;
  const anim = document.createElement("div");
  anim.textContent = `+${Math.floor(amount)} ${resource}`;
  anim.className = "resourcePop";
  anim.style.left = (x*size)+"px";
  anim.style.top = (y*size-20)+"px";
  document.body.appendChild(anim);
  setTimeout(()=>anim.remove(),1000);
}

// ================= SHIP ANIMATION =================
function animateShip(x,y){
  const size = 40;
  const ship = document.createElement("div");
  ship.className = "ship";
  ship.style.left = (x*size)+"px";
  ship.style.top = (y*size)+"px";
  document.body.appendChild(ship);
  let pos=0;
  const id=setInterval(()=>{
    pos+=5;
    ship.style.left = (x*size+pos)+"px";
    if(pos>300){clearInterval(id); ship.remove();}
  },30);
}

// ================= UI UPDATE =================
function updateUI(){
  document.getElementById("money").textContent="💰 "+Math.floor(game.money);
  document.getElementById("gems").textContent="💎 "+game.gems;
  document.getElementById("prestige").textContent="🔁 x"+game.prestige.multiplier.toFixed(1);
  document.getElementById("islandName").textContent="🏝 "+game.islands[game.islandIndex].name;
  renderMap();
}

// ================= INIT =================
if(!localStorage.getItem("pct_save")) initIslands();
if(!localStorage.getItem("tutorialCompleted")) startTutorial();
updateUI();
