// ================= CONFIG =================
const GRID_ROWS=8;
const GRID_COLS=8;
const START_MONEY=300;
const START_GEMS=0;
const MAX_OFFLINE_HOURS=8;
const TICK_INTERVAL=1000;

// ================= RESOURCES =================
const RESOURCES=["wood","plank","ice","ore","fruit","lava","obsidian"];

// ================= ISLANDS =================
const ISLANDS=[
  {id:0,name:"Startinsel",resources:["wood","plank"],x:0,y:0},
  {id:1,name:"Eisinsel",resources:["ice","ore"],x:250,y:50},
  {id:2,name:"Vulkaninsel",resources:["lava","obsidian"],x:450,y:200},
  {id:3,name:"Dschungelinsel",resources:["fruit","wood"],x:150,y:300}
];

// ================= BUILDINGS =================
const BUILDINGS={
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
const QUESTS=[
  {id:"q1",text:"Produziere 50 Holz",type:"resource",resource:"wood",amount:50,reward:{money:100}},
  {id:"q2",text:"Baue 3 Lager",type:"building",building:"Lager",amount:3,reward:{money:200}},
  {id:"q3",text:"Exportiere 20 Planken",type:"export",resource:"plank",amount:20,reward:{money:300}}
];

// ================= SKILLS =================
const SKILLS=[
  {id:"prodBoost",text:"+10% Produktion",level:0,max:5},
  {id:"harborBoost",text:"+10% Hafenverkauf",level:0,max:5},
  {id:"storageBoost",text:"+50 Lagerkapazität",level:0,max:3}
];

// ================= MANAGERS =================
const MANAGERS=[
  {id:"builder",name:"Bauleiter",skills:[{id:"cheapRoads",text:"Straßen -20% Kosten",level:0,max:3}]},
  {id:"economist",name:"Ökonom",skills:[{id:"sellBoost",text:"+10% Hafenverkauf",level:0,max:5}]}
];

// ================= GAME STATE =================
let game={
  money:START_MONEY,
  gems:START_GEMS,
  prestige:{points:0,multiplier:1},
  islands:[],
  islandIndex:0,
  unlockedIslands:[0],
  resources:{},
  quests:QUESTS.map(q=>({...q,progress:0,completed:false})),
  skills:SKILLS.map(s=>({...s})),
  managers:JSON.parse(JSON.stringify(MANAGERS)),
  dailyClaim:0,
  tutorialStep:0,
  lastTime:Date.now(),
  achievements:{},
  offlineTime:0
};

// ================= INIT ISLANDS =================
function createIslandTiles(){
  return Array.from({length:GRID_ROWS},(_,y)=>Array.from({length:GRID_COLS},(_,x)=>{
    const dist=Math.hypot(x-(GRID_COLS-1)/2,y-(GRID_ROWS-1)/2);
    return {type:dist<3.5?"land":"water",building:null};
  }));
}

function initGame(){
  game.islands=ISLANDS.map(i=>({...i,tiles:createIslandTiles(),resources:{}}));
  game.islands.forEach(is=>{
    RESOURCES.forEach(r=>is.resources[r]=0);
  });
  Object.keys(game.resources).forEach(r=>game.resources[r]=0);
}
initGame();

// ================= MAP =================
const mapEl=document.getElementById("map");
function renderMap(){
  mapEl.innerHTML="";
  const island=game.islands[game.islandIndex];
  const size=50;
  island.tiles.forEach((row,y)=>{
    row.forEach((cell,x)=>{
      const rect=document.createElementNS("http://www.w3.org/2000/svg","rect");
      rect.setAttribute("x",x*size);
      rect.setAttribute("y",y*size);
      rect.setAttribute("width",size-2);
      rect.setAttribute("height",size-2);
      rect.setAttribute("class","tile "+cell.type);
      rect.onclick=()=>openOverlay(x,y);
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
}

// ================= BUILDING =================
const overlay=document.getElementById("overlay");
const buildOptions=document.getElementById("buildOptions");
let selectedTile=null;

function openOverlay(x,y){
  selectedTile={x,y};
  const cell=game.islands[game.islandIndex].tiles[y][x];
  if(cell.type!=="land") return;
  buildOptions.innerHTML="";
  Object.keys(BUILDINGS).forEach(k=>{
    const b=BUILDINGS[k];
    const btn=document.createElement("button");
    btn.innerText=`${b.name} (${b.cost}💰)`;
    btn.onclick=()=>placeBuilding(k);
    buildOptions.appendChild(btn);
  });
  overlay.classList.remove("hidden");
}

document.getElementById("closeOverlay").onclick=()=>overlay.classList.add("hidden");

function placeBuilding(key){
  const {x,y}=selectedTile;
  const cell=game.islands[game.islandIndex].tiles[y][x];
  if(cell.building) return alert("Feld belegt!");
  const b=BUILDINGS[key];
  if(game.money<b.cost) return alert("Nicht genug Geld!");
  game.money-=b.cost;
  cell.building={...b,level:1};
  overlay.classList.add("hidden");
  updateUI();
}

// ================= QUESTS =================
const questOverlay=document.getElementById("questOverlay");
document.getElementById("questBtn").onclick=()=>{
  const list=document.getElementById("questList");
  list.innerHTML="";
  game.quests.forEach(q=>{
    const div=document.createElement("div");
    div.textContent=`${q.completed?"✅":"❌"} ${q.text} (${Math.floor(q.progress)}/${q.amount})`;
    list.appendChild(div);
  });
  questOverlay.classList.remove("hidden");
};
document.getElementById("closeQuest").onclick=()=>questOverlay.classList.add("hidden");

function checkQuests(){
  game.quests.forEach(q=>{
    if(q.completed) return;
    if(q.type==="resource") q.progress=game.resources[q.resource]||0;
    if(q.type==="building"){
      let cnt=0;
      game.islands.forEach(is=>is.tiles.flat().forEach(t=>{if(t.building&&t.building.name===q.building) cnt++;}));
      q.progress=cnt;
    }
    if(q.progress>=q.amount){
      q.completed=true;
      game.money+=q.reward.money;
      alert(`Quest abgeschlossen: ${q.text} +${q.reward.money}💰`);
    }
  });
}

// ================= SKILL TREE =================
const skillOverlay=document.getElementById("skillOverlay");
document.getElementById("skillBtn").onclick=()=>{
  const tree=document.getElementById("skillTree");
  tree.innerHTML="";
  game.skills.forEach(s=>{
    const btn=document.createElement("button");
    btn.textContent=`${s.text} Lv.${s.level}/${s.max}`;
    btn.onclick=()=>{
      if(s.level>=s.max) return;
      if(game.gems<1) return alert("Du brauchst 💎!");
      game.gems--; s.level++; updateUI();
    };
    tree.appendChild(btn);
  });
  skillOverlay.classList.remove("hidden");
};
document.getElementById("closeSkills").onclick=()=>skillOverlay.classList.add("hidden");

// ================= DAILY =================
const dailyOverlay=document.getElementById("dailyOverlay");
document.getElementById("dailyBtn").onclick=()=>{
  const last=new Date(game.dailyClaim);
  const now=new Date();
  if(last.toDateString()===now.toDateString()){
    document.getElementById("dailyText").textContent="Bereits abgeholt heute!";
    document.getElementById("claimDaily").disabled=true;
  }else{
    document.getElementById("dailyText").textContent="💰 +100 Münzen";
    document.getElementById("claimDaily").disabled=false;
  }
  dailyOverlay.classList.remove("hidden");
};
document.getElementById("closeDaily").onclick=()=>dailyOverlay.classList.add("hidden");
document.getElementById("claimDaily").onclick=()=>{
  game.money+=100; game.dailyClaim=Date.now(); updateUI(); dailyOverlay.classList.add("hidden");
};

// ================= TUTORIAL =================
const tutorialOverlay=document.getElementById("tutorialOverlay");
const tutorialSteps=[
  "Willkommen zum Tutorial! Wir zeigen dir die Basics.",
  "Schritt 1: Klicke auf ein Landfeld, um deinen Holzfäller zu platzieren.",
  "Schritt 2: Baue ein Lager neben dem Holzfäller, damit Ressourcen gespeichert werden.",
  "Schritt 3: Baue eine Straße, damit deine Gebäude verbunden sind.",
  "Schritt 4: Baue einen Hafen und exportiere deine Planken.",
  "Tutorial beendet! Jetzt kannst du frei spielen."
];
document.getElementById("tutorialNext").onclick=()=>{
  game.tutorialStep++;
  if(game.tutorialStep>=tutorialSteps.length){
    tutorialOverlay.classList.add("hidden"); game.tutorialStep=0;
    localStorage.setItem("tutorialDone","1");
    saveGame(); return;
  }
  document.getElementById("tutorialText").textContent=tutorialSteps[game.tutorialStep];
};
function startTutorial(){
  if(localStorage.getItem("tutorialDone")) return;
  tutorialOverlay.classList.remove("hidden");
  document.getElementById("tutorialText").textContent=tutorialSteps[0];
}
startTutorial();

// ================= ISLAND SWITCH =================
document.getElementById("nextIsland").onclick=()=>{
  game.islandIndex=(game.islandIndex+1)%game.islands.length;updateUI();
};
document.getElementById("prevIsland").onclick=()=>{
  game.islandIndex=(game.islandIndex-1+game.islands.length)%game.islands.length;updateUI();
};

// ================= PRESTIGE =================
document.getElementById("prestigeBtn").onclick=()=>{
  if(confirm("Willst du Prestige starten? Alle Inseln werden zurückgesetzt, aber Einkommen wird multipliziert.")){
    game.prestige.multiplier+=0.5;
    initGame();
    updateUI();
  }
};

// ================= NEW GAME =================
document.getElementById("newGameBtn").onclick=()=>{
  if(confirm("Willst du neu starten?")){
    localStorage.clear();
    location.reload();
  }
};

// ================= SAVE/LOAD =================
function saveGame(){ localStorage.setItem("pct_save",JSON.stringify(game)); }
function loadGame(){ const s=localStorage.getItem("pct_save"); if(s){game=JSON.parse(s);} }
loadGame();

// ================= GAME LOOP =================
function tick(){
  const now=Date.now();
  const delta=(now-game.lastTime)/1000;
  game.lastTime=now;

  // PRODUKTION
  game.islands.forEach(is=>{
    is.tiles.flat().forEach(t=>{
      if(!t.building) return;
      if(t.building.type==="producer"){
        Object.keys(t.building.produces).forEach(r=>{
          const amt=t.building.produces[r]*t.building.level*game.prestige.multiplier;
          is.resources[r]+=amt;
          game.resources[r]=(game.resources[r]||0)+amt;
        });
      }
      if(t.building.type==="processor"){
        const canProcess=Object.keys(t.building.needs).every(r=>is.resources[r]>=t.building.needs[r]);
        if(canProcess){
          Object.keys(t.building.needs).forEach(r=>is.resources[r]-=t.building.needs[r]);
          Object.keys(t.building.produces).forEach(r=>{
            const amt=t.building.produces[r]*t.building.level*game.prestige.multiplier;
            is.resources[r]+=amt;
            game.resources[r]=(game.resources[r]||0)+amt;
          });
        }
      }
      if(t.building.type==="harbor"){
        Object.keys(is.resources).forEach(r=>{
          if(r==="plank"){
            const amt=Math.min(t.building.exportRate*t.building.level,is.resources[r]);
            is.resources[r]-=amt;
            game.money+=amt*5*game.prestige.multiplier;
          }
        });
      }
    });
  });

  checkQuests();
  updateUI();
  saveGame();
}
setInterval(tick,TICK_INTERVAL);

// ================= UI =================
function updateUI(){
  document.getElementById("money").textContent="💰 "+Math.floor(game.money);
  document.getElementById("gems").textContent="💎 "+game.gems;
  document.getElementById("prestige").textContent="🔁 x"+game.prestige.multiplier.toFixed(1);
  document.getElementById("islandName").textContent="🏝 "+game.islands[game.islandIndex].name;
  renderMap();
}
updateUI();
