// ================= CONFIG =================
const GRID_ROWS = 8;
const GRID_COLS = 8;
const START_MONEY = 300;
const START_GEMS = 0;
const MAX_OFFLINE_HOURS = 8;
const TICK_INTERVAL = 1000;

// ================= RESOURCES =================
const RESOURCES = ["wood", "plank", "ice", "ore", "fruit", "lava", "obsidian"];

// ================= ISLANDS =================
const ISLANDS = [
  {id:0,name:"Startinsel",resources:["wood","plank"],x:0,y:0},
  {id:1,name:"Eisinsel",resources:["ice","ore"],x:250,y:50},
  {id:2,name:"Vulkaninsel",resources:["lava","obsidian"],x:450,y:200},
  {id:3,name:"Dschungelinsel",resources:["fruit","wood"],x:150,y:300}
];

// ================= BUILDINGS =================
const BUILDINGS = {
  road: {name:"Straße",cost:5,type:"road"},
  lumberjack: {name:"Holzfäller",cost:50,type:"producer",produces:{wood:1}},
  sawmill: {name:"Sägewerk",cost:120,type:"processor",needs:{wood:1},produces:{plank:1}},
  iceFactory: {name:"Eisfabrik",cost:100,type:"producer",produces:{ice:1}},
  fruitFarm: {name:"Obstfarm",cost:80,type:"producer",produces:{fruit:1}},
  lavaPlant: {name:"Lava-Schmelze",cost:200,type:"producer",produces:{lava:1}},
  obsidianWorkshop: {name:"Obsidian-Werk",cost:250,type:"processor",needs:{lava:1},produces:{obsidian:1}},
  storage: {name:"Lager",cost:80,type:"storage",capacity:50},
  harbor: {name:"Hafen",cost:200,type:"harbor",exportRate:2}
};

// ================= QUESTS =================
const QUESTS = [
  {id:"q1",text:"Produziere 50 Holz",type:"resource",resource:"wood",amount:50,reward:{money:100}},
  {id:"q2",text:"Baue 3 Lager",type:"building",building:"Lager",amount:3,reward:{money:200}},
  {id:"q3",text:"Exportiere 20 Planken",type:"export",resource:"plank",amount:20,reward:{money:300}},
  {id:"q4",text:"Baue 3 Straßen",type:"building",building:"Straße",amount:3,reward:{money:50}},
  {id:"q5",text:"Baue einen Hafen",type:"building",building:"Hafen",amount:1,reward:{money:150}}
];

// ================= SKILLS =================
const SKILLS = [
  {id:"prodBoost",text:"+10% Produktion",level:0,max:5},
  {id:"harborBoost",text:"+10% Hafenverkauf",level:0,max:5},
  {id:"storageBoost",text:"+50 Lagerkapazität",level:0,max:3}
];

// ================= MANAGERS =================
const MANAGERS = [
  {id:"builder",name:"Bauleiter",skills:[{id:"cheapRoads",text:"Straßen -20% Kosten",level:0,max:3}]},
  {id:"economist",name:"Ökonom",skills:[{id:"sellBoost",text:"+10% Hafenverkauf",level:0,max:5}]}
];

// ================= GAME STATE =================
let game = {
  money: START_MONEY,
  gems: START_GEMS,
  prestige: {points:0, multiplier:1},
  islands: [],
  islandIndex: 0,
  unlockedIslands: [0],
  resources: {},
  quests: QUESTS.map(q => ({...q, progress:0, completed:false})),
  skills: SKILLS.map(s => ({...s})),
  managers: JSON.parse(JSON.stringify(MANAGERS)),
  dailyClaim: 0,
  tutorialStep: 0,
  lastTime: Date.now(),
  achievements: {},
  offlineTime: 0
};

// ================= INIT ISLANDS =================
function createIslandTiles() {
  return Array.from({length:GRID_ROWS}, (_,y)=>Array.from({length:GRID_COLS}, (_,x)=>{
    const dist=Math.hypot(x-(GRID_COLS-1)/2,y-(GRID_ROWS-1)/2);
    return {type: dist<3.5?"land":"water", building:null};
  }));
}

function initGame() {
  game.islands = ISLANDS.map(i => ({...i, tiles:createIslandTiles(), resources:{}}));
  game.islands.forEach(is => RESOURCES.forEach(r=>is.resources[r]=0));
  RESOURCES.forEach(r => game.resources[r]=0);
}
initGame();

// ================= MAP =================
const mapEl = document.getElementById("map");
function renderMap() {
  mapEl.innerHTML="";
  const island = game.islands[game.islandIndex];
  const size = 50;

  island.tiles.forEach((row,y)=>{
    row.forEach((cell,x)=>{
      const rect=document.createElementNS("http://www.w3.org/2000/svg","rect");
      rect.setAttribute("x",x*size);
      rect.setAttribute("y",y*size);
      rect.setAttribute("width",size-2);
      rect.setAttribute("height",size-2);
      rect.setAttribute("class","tile "+cell.type);
      rect.onclick = () => openBuildOverlay(x,y);
      mapEl.appendChild(rect);

      if(cell.building){
        const text=document.createElementNS("http://www.w3.org/2000/svg","text");
        text.setAttribute("x", x*size+size/2);
        text.setAttribute("y", y*size+size/2);
        text.setAttribute("text-anchor","middle");
        text.setAttribute("alignment-baseline","middle");
        text.setAttribute("fill","#000");
        text.setAttribute("font-size","10");
        text.textContent = `${cell.building.name} Lv.${cell.building.level}`;
        mapEl.appendChild(text);
      }
    });
  });
}

// ================= BUILD / DEMOLISH =================
const overlay = document.getElementById("overlay");
const buildOptions = document.getElementById("buildOptions");
let selectedTile = null;

function openBuildOverlay(x,y) {
  selectedTile = {x,y};
  const cell = game.islands[game.islandIndex].tiles[y][x];
  if(cell.type !== "land") return;

  buildOptions.innerHTML="";
  if(cell.building) {
    // Option zum Abreißen
    const demolishBtn = document.createElement("button");
    demolishBtn.textContent = `Abreißen (${cell.building.name})`;
    demolishBtn.onclick = () => {
      cell.building = null;
      overlay.classList.add("hidden");
      updateUI();
    };
    buildOptions.appendChild(demolishBtn);

    // Upgrade
    const upgradeBtn = document.createElement("button");
    upgradeBtn.textContent = `Upgrade (Lv.${cell.building.level})`;
    upgradeBtn.onclick = () => {
      if(game.money < Math.floor(cell.building.cost*1.5)) return alert("Nicht genug Geld!");
      game.money -= Math.floor(cell.building.cost*1.5);
      cell.building.level++;
      overlay.classList.add("hidden");
      updateUI();
    };
    buildOptions.appendChild(upgradeBtn);

  } else {
    // Bauen
    Object.keys(BUILDINGS).forEach(k=>{
      const b = BUILDINGS[k];
      const btn = document.createElement("button");
      btn.textContent = `${b.name} (${b.cost}💰)`;
      btn.onclick = () => {
        if(game.money < b.cost) return alert("Nicht genug Geld!");
        game.money -= b.cost;
        cell.building = {...b, level:1};
        overlay.classList.add("hidden");
        updateUI();
      };
      buildOptions.appendChild(btn);
    });
  }

  overlay.classList.remove("hidden");
}
document.getElementById("closeOverlay").onclick = ()=>overlay.classList.add("hidden");

// ================= QUESTS / ACHIEVEMENTS =================
const questOverlay = document.getElementById("questOverlay");
document.getElementById("questBtn").onclick=()=>{
  const list=document.getElementById("questList");
  list.innerHTML="";
  game.quests.forEach(q=>{
    const div=document.createElement("div");
    div.textContent = `${q.completed?"✅":"❌"} ${q.text} (${Math.floor(q.progress)}/${q.amount})`;
    list.appendChild(div);
  });
  questOverlay.classList.remove("hidden");
};
document.getElementById("closeQuest").onclick=()=>questOverlay.classList.add("hidden");

function checkQuests() {
  game.quests.forEach(q=>{
    if(q.completed) return;
    if(q.type==="resource") q.progress = game.resources[q.resource]||0;
    if(q.type==="building") {
      let cnt=0;
      game.islands.forEach(is=>is.tiles.flat().forEach(t=>{if(t.building&&t.building.name===q.building) cnt++;}));
      q.progress=cnt;
    }
    if(q.progress>=q.amount){
      q.completed=true;
      game.money += q.reward.money;
      showPopUp(`Quest abgeschlossen: ${q.text} +${q.reward.money}💰`);
    }
  });
}

// ================= PRODUKTION & ANIMATION =================
function tick(){
  const now = Date.now();
  const delta = (now - game.lastTime)/1000;
  game.lastTime = now;

  game.islands.forEach(is=>{
    is.tiles.flat().forEach(t=>{
      if(!t.building) return;

      // PRODUCER
      if(t.building.type==="producer"){
        Object.keys(t.building.produces).forEach(r=>{
          const amt = t.building.produces[r]*t.building.level*game.prestige.multiplier;
          is.resources[r] += amt;
          game.resources[r] = (game.resources[r]||0) + amt;
          animateResource(t, r, amt);
        });
      }

      // PROCESSOR
      if(t.building.type==="processor"){
        const canProcess = Object.keys(t.building.needs).every(r=>is.resources[r]>=t.building.needs[r]);
        if(canProcess){
          Object.keys(t.building.needs).forEach(r=>is.resources[r]-=t.building.needs[r]);
          Object.keys(t.building.produces).forEach(r=>{
            const amt = t.building.produces[r]*t.building.level*game.prestige.multiplier;
            is.resources[r] += amt;
            game.resources[r] = (game.resources[r]||0)+amt;
            animateResource(t, r, amt);
          });
        }
      }

      // HAFEN
      if(t.building.type==="harbor"){
        Object.keys(is.resources).forEach(r=>{
          if(r==="plank"){
            const amt = Math.min(t.building.exportRate*t.building.level,is.resources[r]);
            is.resources[r]-=amt;
            game.money += amt*5*game.prestige.multiplier;
            animateShip(t);
          }
        });
      }
    });
  });

  checkQuests();
  updateUI();
  saveGame();
}
setInterval(tick, TICK_INTERVAL);

// ================= UI =================
function updateUI(){
  document.getElementById("money").textContent="💰 "+Math.floor(game.money);
  document.getElementById("gems").textContent="💎 "+game.gems;
  document.getElementById("prestige").textContent="🔁 x"+game.prestige.multiplier.toFixed(1);
  document.getElementById("islandName").textContent="🏝 "+game.islands[game.islandIndex].name;
  renderMap();
}

// ================= SIMPLE ANIMATION =================
function animateResource(tile, resource, amount){
  // kurze Pop-Up Animation
  const anim = document.createElement("div");
  anim.textContent = `+${Math.floor(amount)} ${resource}`;
  anim.style.position = "absolute";
  anim.style.left = Math.random()*300+"px";
  anim.style.top = Math.random()*300+"px";
  anim.style.color = "#fff";
  anim.style.fontWeight = "bold";
  document.body.appendChild(anim);
  setTimeout(()=>anim.remove(),800);
}
function animateShip(tile){
  const ship = document.createElement("div");
  ship.className="ship";
  ship.style.left = "0px"; ship.style.top="0px";
  document.body.appendChild(ship);
  let pos=0;
  const id = setInterval(()=>{
    pos+=5;
    ship.style.left=pos+"px";
    if(pos>300){clearInterval(id); ship.remove();}
  },30);
}

// ================= SAVE / LOAD =================
function saveGame(){ localStorage.setItem("pct_save",JSON.stringify(game)); }
function loadGame(){ const s=localStorage.getItem("pct_save"); if(s){game=JSON.parse(s);} }
loadGame();

// ================= POP-UP =================
function showPopUp(msg){
  const div = document.createElement("div");
  div.textContent = msg;
  div.style.position="fixed";
  div.style.top="10%";
  div.style.left="50%";
  div.style.transform="translateX(-50%)";
  div.style.padding="10px 20px";
  div.style.background="#222";
  div.style.border="2px solid #fff";
  div.style.borderRadius="8px";
  div.style.zIndex=50;
  document.body.appendChild(div);
  setTimeout(()=>div.remove(),2000);
}

// ================= INIT =================
updateUI();
