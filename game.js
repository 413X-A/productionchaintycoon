// ================= CONFIG =================
const GRID_SIZE=6;
const START_MONEY=300;
const MAX_OFFLINE_HOURS=8;

// ================= WELT =================
const WORLD_ISLANDS=[
  {id:0,name:"Startinsel",x:40,y:80,cost:0},
  {id:1,name:"Holzinsel",x:180,y:60,cost:500},
  {id:2,name:"Industrieinsel",x:100,y:160,cost:1500},
  {id:3,name:"Mega-Insel",x:220,y:170,cost:5000}
];

// ================= BUILDINGS =================
const BUILDINGS={
  road:{name:"Straße",cost:5,type:"road"},
  lumberjack:{name:"Holzfäller",cost:50,type:"producer",produces:{wood:1}},
  sawmill:{name:"Sägewerk",cost:120,type:"processor",needs:{wood:1},produces:{plank:1}},
  storage:{name:"Lager",cost:80,type:"storage",capacity:50},
  harbor:{name:"Hafen",cost:200,type:"harbor",exportRate:2}
};

// ================= ACHIEVEMENTS =================
const ACHIEVEMENTS=[
  {id:"money1k",text:"Verdiene 1.000 Münzen",check:g=>g.totalEarned>=1000},
  {id:"firstHarbor",text:"Baue deinen ersten Hafen",check:g=>g.stats.harbors>=1},
  {id:"threeIslands",text:"Besitze 3 Inseln",check:g=>g.islands.length>=3}
];

// ================= MANAGER =================
const MANAGERS=[
  {id:"builder",name:"Bauleiter",skills:[
    {id:"cheapRoads",text:"Straßen -20% Kosten",level:0,max:3},
    {id:"fastBuild",text:"+1 Bau pro Tick",level:0,max:2}
  ]},
  {id:"economist",name:"Ökonom",skills:[
    {id:"sellBoost",text:"+10% Hafenverkauf",level:0,max:5}
  ]}
];

// ================= GAME STATE =================
let game={
  money:START_MONEY,
  gems:0,
  totalEarned:0,

  islandIndex:0,
  islands:[],
  unlockedIslands:[0],

  stats:{harbors:0},
  achievements:{},

  prestige:{points:0,multiplier:1},

  aiManager:{enabled:false},

  managers:JSON.parse(JSON.stringify(MANAGERS)),

  lastTime:Date.now()
};

// ================= INIT =================
function createIsland(){
  return{
    grid:Array.from({length:GRID_SIZE},()=>Array.from({length:GRID_SIZE},()=>null)),
    resources:{wood:0,plank:0}
  };
}
function initGame(){game.islands=[createIsland()];}
initGame();

// ================= MAP =================
const mapEl=document.getElementById("map");
function renderMap(){
  mapEl.innerHTML="";
  for(let y=0;y<GRID_SIZE;y++){
    for(let x=0;x<GRID_SIZE;x++){
      const t=document.createElement("div");
      t.className="tile";
      t.dataset.x=x;t.dataset.y=y;
      t.onclick=()=>openOverlay(x,y);
      mapEl.appendChild(t);
    }
  }
}
renderMap();

// ================= OVERLAY BUILD =================
const overlay=document.getElementById("overlay");
const buildOptions=document.getElementById("buildOptions");
let selectedTile=null;

function openOverlay(x,y){
  selectedTile={x,y};
  buildOptions.innerHTML="";
  Object.keys(BUILDINGS).forEach(k=>{
    const b=BUILDINGS[k];
    let cost=b.cost;
    const cheap=getSkill("builder","cheapRoads");
    if(b.type==="road") cost=Math.floor(cost*(1-0.2*cheap));
    const btn=document.createElement("button");
    btn.innerText=`${b.name} (${cost}💰)`;
    btn.onclick=()=>placeBuilding(k,cost);
    buildOptions.appendChild(btn);
  });
  overlay.classList.remove("hidden");
}
document.getElementById("closeOverlay").onclick=()=>overlay.classList.add("hidden");

// ================= PLACE =================
function placeBuilding(key,cost){
  const {x,y}=selectedTile;
  const island=game.islands[game.islandIndex];
  if(island.grid[y][x]) return alert("Feld belegt!");
  if(game.money<cost) return alert("Nicht genug Geld!");
  game.money-=cost;
  const b=BUILDINGS[key];
  island.grid[y][x]={...b,level:1};
  if(b.type==="harbor") game.stats.harbors++;
  overlay.classList.add("hidden");
  updateUI();saveGame();
}

// ================= ROAD CONNECTION =================
function hasRoadConnection(x,y,island){
  const visited=new Set();
  const stack=[{x,y}];
  while(stack.length){
    const p=stack.pop();const k=`${p.x},${p.y}`;
    if(visited.has(k)) continue;visited.add(k);
    if(p.x===0||p.y===0||p.x===GRID_SIZE-1||p.y===GRID_SIZE-1) return true;
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>{
      const nx=p.x+d[0],ny=p.y+d[1];
      if(nx<0||ny<0||nx>=GRID_SIZE||ny>=GRID_SIZE) return;
      const c=island.grid[ny][nx];
      if(c&&c.type==="road") stack.push({x:nx,y:ny});
    });
  }
  return false;
}

// ================= PRODUCTION =================
function tickProduction(){
  game.islands.forEach(island=>{
    let storage=0;
    island.grid.flat().forEach(b=>{if(b&&b.type==="storage") storage+=b.capacity*b.level;});
    for(let y=0;y<GRID_SIZE;y++){
      for(let x=0;x<GRID_SIZE;x++){
        const b=island.grid[y][x];
        if(!b) continue;
        if(!hasRoadConnection(x,y,island)) continue;

        if(b.type==="producer"){
          island.resources.wood=Math.min(storage,island.resources.wood+b.produces.wood*b.level);
        }
        if(b.type==="processor"){
          if(island.resources.wood>=b.needs.wood){
            island.resources.wood-=b.needs.wood;
            island.resources.plank=Math.min(storage,island.resources.plank+b.produces.plank*b.level);
          }
        }
        if(b.type==="harbor"){
          let sell=Math.min(b.exportRate*b.level,island.resources.plank);
          island.resources.plank-=sell;
          const eco=getSkill("economist","sellBoost");
          const mult=1+eco*0.1;
          const earned=sell*5*game.prestige.multiplier*mult;
          game.money+=earned;
          game.totalEarned+=earned;
        }
      }
    }
  });
}

// ================= TRANSPORT + SHIPS =================
const ships=[];
function spawnShip(fromId,toId){
  const ship=document.createElement("div");
  ship.className="ship";
  document.getElementById("worldInner").appendChild(ship);
  const from=WORLD_ISLANDS.find(i=>i.id===fromId);
  const to=WORLD_ISLANDS.find(i=>i.id===toId);
  ship.style.left=from.x+"px";ship.style.top=from.y+"px";
  ships.push({el:ship,fx:from.x,fy:from.y,tx:to.x,ty:to.y,t:0});
}
function animateShips(){
  ships.forEach(s=>{
    s.t+=0.01;
    if(s.t>=1){s.el.remove();s.dead=true;return;}
    const x=s.fx+(s.tx-s.fx)*s.t;
    const y=s.fy+(s.ty-s.fy)*s.t;
    s.el.style.left=x+"px";s.el.style.top=y+"px";
  });
  for(let i=ships.length-1;i>=0;i--) if(ships[i].dead) ships.splice(i,1);
}

// Transport alle 30s von Insel 0 -> 1
setInterval(()=>{
  if(game.islands.length<2) return;
  const a=game.islands[0],b=game.islands[1];
  const amt=Math.min(5,a.resources.plank);
  if(amt<=0) return;
  a.resources.plank-=amt;b.resources.plank+=amt;
  spawnShip(0,1);
},30000);

// ================= OFFLINE =================
function applyOfflineEarnings(){
  const now=Date.now();
  let diff=(now-game.lastTime)/1000;
  diff=Math.min(diff,MAX_OFFLINE_HOURS*3600);
  let ips=0;
  game.islands.forEach(i=>{
    i.grid.flat().forEach(b=>{
      if(b&&b.type==="harbor") ips+=b.exportRate*b.level*5*game.prestige.multiplier;
    });
  });
  const earned=Math.floor(ips*diff);
  if(earned>0){
    game.money+=earned;game.totalEarned+=earned;
    alert(`Offline verdient: ${earned} Münzen`);
  }
}

// ================= ACHIEVEMENTS =================
function checkAchievements(){
  ACHIEVEMENTS.forEach(a=>{
    if(!game.achievements[a.id]&&a.check(game)){
      game.achievements[a.id]=true;
      alert("🏆 Erfolg: "+a.text);
    }
  });
}

// ================= PRESTIGE =================
function openPrestige(){
  const pts=Math.floor(game.totalEarned/5000);
  document.getElementById("prestigeInfo").innerText=
    `Du bekommst ${pts} Prestige-Punkte.\nJeder Punkt = +10% Einkommen.`;
  document.getElementById("prestigeOverlay").classList.remove("hidden");
  document.getElementById("doPrestige").onclick=()=>{
    if(pts<=0) return alert("Noch kein Prestige!");
    game.prestige.points+=pts;
    game.prestige.multiplier=1+game.prestige.points*0.1;
    localStorage.removeItem("pct_save");
    location.reload();
  };
}
document.getElementById("prestigeBtn").onclick=openPrestige;
document.getElementById("closePrestige").onclick=()=>document.getElementById("prestigeOverlay").classList.add("hidden");

// ================= WORLD MAP =================
let worldScale=1;
const worldInner=document.getElementById("worldInner");

function renderWorld(){
  worldInner.innerHTML="";
  WORLD_ISLANDS.forEach(i=>{
    const unlocked=game.unlockedIslands.includes(i.id);
    const d=document.createElement("div");
    d.className="islandIcon"+(unlocked?"":" islandLocked");
    d.style.left=i.x+"px";d.style.top=i.y+"px";
    d.innerText=i.id+1;
    d.onclick=()=>{
      if(unlocked){
        game.islandIndex=game.unlockedIslands.indexOf(i.id);
        updateUI();
      }else{
        if(game.money<i.cost) return alert("Nicht genug Geld!");
        game.money-=i.cost;
        game.unlockedIslands.push(i.id);
        game.islands.push(createIsland());
        alert("🏝 Freigeschaltet: "+i.name);
        renderWorld();updateUI();
      }
    };
    worldInner.appendChild(d);
  });
}
document.getElementById("worldBtn").onclick=()=>{
  renderWorld();
  document.getElementById("worldOverlay").classList.remove("hidden");
};
document.getElementById("closeWorld").onclick=()=>document.getElementById("worldOverlay").classList.add("hidden");
document.getElementById("zoomIn").onclick=()=>{worldScale+=0.2;worldInner.style.transform=`scale(${worldScale})`;};
document.getElementById("zoomOut").onclick=()=>{worldScale=Math.max(.6,worldScale-.2);worldInner.style.transform=`scale(${worldScale})`;};

// ================= MANAGERS =================
function getSkill(managerId,skillId){
  const m=game.managers.find(m=>m.id===managerId);
  if(!m) return 0;
  const s=m.skills.find(s=>s.id===skillId);
  return s?s.level:0;
}

document.getElementById("managerBtn").onclick=()=>{
  const list=document.getElementById("managerList");
  list.innerHTML="";
  game.managers.forEach(m=>{
    const h=document.createElement("h4");h.innerText=m.name;list.appendChild(h);
    m.skills.forEach(s=>{
      const b=document.createElement("button");
      b.innerText=`${s.text} (Lv.${s.level}/${s.max})`;
      b.onclick=()=>{
        if(s.level>=s.max) return;
        if(game.gems<1) return alert("Du brauchst 💎!");
        game.gems--;s.level++;updateUI();saveGame();
      };
      list.appendChild(b);
    });
  });
  document.getElementById("managerOverlay").classList.remove("hidden");
};
document.getElementById("closeManagers").onclick=()=>document.getElementById("managerOverlay").classList.add("hidden");

// ================= PREMIUM =================
document.getElementById("shopBtn").onclick=()=>document.getElementById("shopOverlay").classList.remove("hidden");
document.getElementById("closeShop").onclick=()=>document.getElementById("shopOverlay").classList.add("hidden");
document.getElementById("buyGemsSmall").onclick=()=>{
  game.gems+=50;alert("💎 +50 (Demo)");updateUI();saveGame();
};

// ================= ISLAND SWITCH =================
document.getElementById("nextIsland").onclick=()=>{
  game.islandIndex=(game.islandIndex+1)%game.islands.length;updateUI();
};
document.getElementById("prevIsland").onclick=()=>{
  game.islandIndex=(game.islandIndex-1+game.islands.length)%game.islands.length;updateUI();
};

// ================= UI =================
function updateUI(){
  document.getElementById("money").innerText="💰 "+Math.floor(game.money);
  document.getElementById("gems").innerText="💎 "+game.gems;
  document.getElementById("islandName").innerText="🏝 Insel "+(game.islandIndex+1);
  const island=game.islands[game.islandIndex];
  document.querySelectorAll(".tile").forEach(t=>{
    const x=+t.dataset.x,y=+t.dataset.y;
    t.innerHTML="";
    const b=island.grid[y][x];
    if(!b) return;
    const c=document.createElement("div");
    let cls="content ";
    if(b.type==="road") cls+="road";
    else if(b.type==="storage") cls+="storage";
    else if(b.type==="harbor") cls+="harbor";
    else cls+="building";
    c.className=cls;
    c.innerText=`${b.name}\nLv.${b.level}`;
    t.appendChild(c);
  });
}

// ================= SAVE / LOAD =================
function saveGame(){
  game.lastTime=Date.now();
  localStorage.setItem("pct_save",JSON.stringify(game));
}
function loadGame(){
  const s=localStorage.getItem("pct_save");
  if(s){game=JSON.parse(s);applyOfflineEarnings();}
  updateUI();
}

// ================= ACH / PRESTIGE UI =================
document.getElementById("achBtn").onclick=()=>{
  const l=document.getElementById("achievementList");
  l.innerHTML="";
  ACHIEVEMENTS.forEach(a=>{
    const d=document.createElement("div");
    d.innerText=(game.achievements[a.id]?"✅ ":"❌ ")+a.text;
    l.appendChild(d);
  });
  document.getElementById("achievementOverlay").classList.remove("hidden");
};
document.getElementById("closeAchievements").onclick=()=>document.getElementById("achievementOverlay").classList.add("hidden");

// ================= NEW GAME =================
document.getElementById("newGameBtn").onclick=()=>{
  if(confirm("Willst du wirklich neu starten?")){
    localStorage.removeItem("pct_save");
    location.reload();
  }
};

// ================= GAME LOOP =================
setInterval(()=>{
  tickProduction();
  checkAchievements();
  animateShips();
  updateUI();
},1000);

// ================= START =================
loadGame();
updateUI();
