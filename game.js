// ================= CONFIG =================
const GRID_ROWS=10;
const GRID_COLS=10;
const START_MONEY=300;
const START_GEMS=0;
const MAX_OFFLINE_HOURS=8;
const TICK_INTERVAL=1000;

// ================= RESOURCES =================
const RESOURCES=["wood","plank","ice","ore","fruit","lava","obsidian"];

// ================= ISLANDS =================
const ISLANDS=[
  {id:0,name:"Startinsel",resources:["wood","plank"]},
  {id:1,name:"Eisinsel",resources:["ice","ore"]},
  {id:2,name:"Vulkaninsel",resources:["lava","obsidian"]},
  {id:3,name:"Dschungelinsel",resources:["fruit","wood"]}
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
  {id:"q3",text:"Exportiere 20 Planken",type:"export",resource:"plank",amount:20,reward:{money:300}},
  {id:"q4",text:"Baue 3 Straßen",type:"building",building:"Straße",amount:3,reward:{money:50}},
  {id:"q5",text:"Baue einen Hafen",type:"building",building:"Hafen",amount:1,reward:{money:150}},
  {id:"q6",text:"Produziere 100 Planken",type:"resource",resource:"plank",amount:100,reward:{money:200}},
  {id:"q7",text:"Verkaufe 50 Holz an Händler",type:"trade",resource:"wood",amount:50,reward:{money:200}}
];

// ================= SKILLS =================
const SKILLS=[{id:"prodBoost",text:"+10% Produktion",level:0,max:5},{id:"storageBoost",text:"+50 Lagerkapazität",level:0,max:3}];

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
  dailyClaim:0,
  tutorialStep:0,
  lastTime:Date.now(),
  offlineTime:0
};

// ================= INIT ISLANDS =================
function createIslandTiles(island){
  return Array.from({length:GRID_ROWS},(_,y)=>Array.from({length:GRID_COLS},(_,x)=>{
    const dist=Math.hypot(x-(GRID_COLS-1)/2,y-(GRID_ROWS-1)/2);
    return {type:dist<5?"land":"water",building:null};
  }));
}

function initGame(){
  game.islands=ISLANDS.map(i=>({...i,tiles:createIslandTiles(i),resources:{}}));
  game.islands.forEach(is=>{
    RESOURCES.forEach(r=>is.resources[r]=0);
    // Anfangslager
    const centerX=Math.floor(GRID_COLS/2), centerY=Math.floor(GRID_ROWS/2);
    is.tiles[centerY][centerX].building={...BUILDINGS.storage,level:1};
  });
}
initGame();

// ================= MAP =================
const mapEl=document.getElementById("map");
function renderMap(){
  mapEl.innerHTML="";
  const island=game.islands[game.islandIndex];
  const size=40;

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
  const resUI=document.getElementById("resourceUI");
  resUI.innerHTML="";
  island.resources && Object.keys(island.resources).forEach(r=>{
    if(ISLANDS[game.islandIndex].resources.includes(r)){
      const span=document.createElement("span");
      span.textContent=`${r}: ${Math.floor(island.resources[r])}`;
      resUI.appendChild(span);
    }
  });
}

// ================= BUILD / DEMOLISH =================
const overlay=document.getElementById("overlay");
const buildOptions=document.getElementById("buildOptions");
let selectedTile=null;

function openBuildOverlay(x,y){
  selectedTile={x,y};
  const cell=game.islands[game.islandIndex].tiles[y][x];
  if(cell.type!=="land") return;

  buildOptions.innerHTML="";
  if(cell.building){
    const demolishBtn=document.createElement("button");
    demolishBtn.textContent=`Abreißen (${cell.building.name})`;
    demolishBtn.onclick=()=>{
      cell.building=null;
      overlay.classList.add("hidden");
      updateUI();
    };
    buildOptions.appendChild(demolishBtn);

    const upgradeBtn=document.createElement("button");
    upgradeBtn.textContent=`Upgrade (Lv.${cell.building.level})`;
    upgradeBtn.onclick=()=>{
      if(game.money<Math.floor(cell.building.cost*1.5)) return alert("Nicht genug Geld!");
      game.money-=Math.floor(cell.building.cost*1.5);
      cell.building.level++;
      overlay.classList.add("hidden");
      updateUI();
    };
    buildOptions.appendChild(upgradeBtn);

  }else{
    Object.keys(BUILDINGS).forEach(k=>{
      const b=BUILDINGS[k];
      // nur wenn Insel Ressource vorhanden
      if(b.produces){
        const keys=Object.keys(b.produces);
        if(!keys.every(r=>ISLANDS[game.islandIndex].resources.includes(r))) return;
      }
      const btn=document.createElement("button");
      btn.textContent=`${b.name} (${b.cost}💰)`;
      btn.onclick=()=>{
        if(game.money<b.cost) return alert("Nicht genug Geld!");
        game.money-=b.cost;
        cell.building={...b,level:1};
        overlay.classList.add("hidden");
        updateUI();
      };
      buildOptions.appendChild(btn);
    });
  }
  overlay.classList.remove("hidden");
}
document.getElementById("closeOverlay").onclick=()=>overlay.classList.add("hidden");

// ================= QUESTS =================
function checkQuests(){
  game.quests.forEach(q=>{
    if(q.completed) return;
    const island=game.islands[game.islandIndex];
    if(q.type==="resource") q.progress=island.resources[q.resource]||0;
    if(q.type==="building"){
      let cnt=0;
      island.tiles.flat().forEach(t=>{if(t.building&&t.building.name===q.building) cnt++;});
      q.progress=cnt;
    }
    if(q.type==="trade"){
      // placeholder für Händler
    }
    if(q.progress>=q.amount){
      q.completed=true;
      game.money+=q.reward.money;
      showPopUp(`Quest abgeschlossen: ${q.text} +${q.reward.money}💰`);
    }
  });
}

// ================= GAME LOOP =================
function tick(){
  const now=Date.now();
  const delta=(now-game.lastTime)/1000;
  game.lastTime=now;

  game.islands.forEach(is=>{
    let totalStorage=0;
    let connected=false;
    is.tiles.flat().forEach(t=>{
      if(t.building && t.building.type==="storage") totalStorage+=t.building.capacity;
    });
    // prüfen, ob irgendein Producer über Straße mit Lager verbunden ist
    const visited=new Set();
    const queue=[];
    is.tiles.flat().forEach((t,y)=>{
      if(t.building && t.building.type==="storage"){
        queue.push({x:y%GRID_COLS,y:Math.floor(y/GRID_COLS)});
      }
    });
    if(queue.length>0) connected=true;

    is.tiles.flat().forEach(t=>{
      if(!t.building) return;
      if(t.building.type==="producer" || t.building.type==="processor"){
        if(!connected) return;
        Object.keys(t.building.produces||{}).forEach(r=>{
          const amt=t.building.produces[r]*t.building.level;
          if((is.resources[r]||0)+amt>totalStorage) return;
          is.resources[r]=(is.resources[r]||0)+amt;
          animateResource(t,r,amt);
        });
      }
    });
  });
  checkQuests();
  updateUI();
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

// ================= SIMPLE ANIMATION =================
function animateResource(tile,resource,amount){
  const size=40;
  const x=(selectedTile?.x||0)*size;
  const y=(selectedTile?.y||0)*size;
  const anim=document.createElement("div");
  anim.textContent=`+${Math.floor(amount)} ${resource}`;
  anim.className="resourcePop";
  anim.style.left=x+"px";
  anim.style.top=y-20+"px";
  document.body.appendChild(anim);
  setTimeout(()=>anim.remove(),1000);
}

// ================= SAVE / LOAD =================
function saveGame(){localStorage.setItem("pct_save",JSON.stringify(game));}
function loadGame(){const s=localStorage.getItem("pct_save"); if(s){game=JSON.parse(s);}}
loadGame();

// ================= POP-UP =================
function showPopUp(msg){
  const div=document.createElement("div");
  div.textContent=msg;
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
