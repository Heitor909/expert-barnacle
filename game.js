// game.js - motor completo (comentado)
// Requer: config.js e personagems.json + pasta sprites_animais/<animal>/<animal>_1.png ...

// ------------------- Setup inicial -------------------
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = CFG.canvas.w;
canvas.height = CFG.canvas.h;

let SPRITES = {};      // carregadas por animal: arrays de Image
let currentLevel = 0;
let player = null;
let enemies = [];
let keys = {};
let lastTS = 0;
let gameState = 'menu'; // menu, playing, lost, win

// HUD elements
const menuEl = document.getElementById('menu');
const charactersEl = document.getElementById('characters');
const hudEl = document.getElementById('hud');
const lifeValEl = document.getElementById('lifeVal');
const levelValEl = document.getElementById('levelVal');
const enLeftValEl = document.getElementById('enLeftVal');
const messageEl = document.getElementById('message');

// touch
document.getElementById('btnLeft').addEventListener('touchstart',()=>keys['ArrowLeft']=true);
document.getElementById('btnLeft').addEventListener('touchend',()=>keys['ArrowLeft']=false);
document.getElementById('btnRight').addEventListener('touchstart',()=>keys['ArrowRight']=true);
document.getElementById('btnRight').addEventListener('touchend',()=>keys['ArrowRight']=false);
document.getElementById('btnJump').addEventListener('touchstart',()=>player && player.jump());
document.getElementById('btnAttack').addEventListener('touchstart',()=>player && player.attack());
document.getElementById('btnAbility').addEventListener('touchstart',()=>player && player.useAbility());

// ------------------- Helpers -------------------
function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.src = src;
    i.onload = () => res(i);
    i.onerror = () => res(null); // continue mesmo se faltar
  });
}

async function loadAllSprites() {
  const resp = await fetch('personagems.json').then(r=>r.json());
  const keys = Object.keys(resp);
  for (const k of keys) {
    SPRITES[k] = [];
    const count = resp[k].frames;
    for (let i=1;i<=count;i++){
      const path = `${CFG.spriteRoot}/${k}/${k}_${i}.png`;
      const img = await loadImage(path);
      SPRITES[k].push(img);
    }
  }
}

// ------------------- Tilemap geração simples -------------------
// Gera `data` se vazio: cria chão contínuo na linha bottom-2 e algumas plataformas.
function ensureLevelData() {
  for (let li=0; li<CFG.levels.length; li++){
    const lvl = CFG.levels[li];
    if (Array.isArray(lvl.data) && lvl.data.length === 0) {
      const cols = lvl.cols, rows = lvl.rows;
      const arr = [];
      for (let r=0; r<rows; r++){
        const row = new Array(cols).fill(0);
        // chão nas últimas 3 linhas
        if (r >= rows - 3) {
          for (let c=0;c<cols;c++) row[c]=1;
        }
        arr.push(row);
      }
      // pequenas plataformas (exemplo)
      if (cols>10) {
        for (let c=6;c<10;c++) arr[rows-6][c]=1;
        for (let c=14;c<18;c++) arr[rows-8][c]=1;
        for (let c=Math.floor(cols/2); c<Math.floor(cols/2)+4; c++) arr[rows-5][c]=1;
      }
      // porta chegada no final
      arr[rows-4][cols-2] = 3;
      lvl.data = arr;
    }
  }
}

function tileAt(lvl, col, row) {
  if (row<0 || col<0 || row>=lvl.rows || col>=lvl.cols) return 0;
  return lvl.data[row][col];
}

// ------------------- Player class -------------------
class Player {
  constructor(kind) {
    this.kind = kind;
    this.x = 80;
    this.y = 50;
    this.w = CFG.playerDisplay.w;
    this.h = CFG.playerDisplay.h;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.frameIdx = 0;
    this.frameTimer = 0;
    this.frameInterval = 120;
    this.health = 100;
    this.attackCooldown = 300; // ms
    this.lastAttack = 0;
    this.abilityReady = true;
    this.lastAbility = 0;
    this.abilityCd = CFG.animals[kind].abilityCooldown;
  }

  update(dt, lvl) {
    // input
    const right = keys['ArrowRight'] || keys['d'];
    const left  = keys['ArrowLeft'] || keys['a'];
    if (right) this.vx = CFG.moveSpeed;
    else if (left) this.vx = -CFG.moveSpeed;
    else this.vx = 0;

    // jump handled via input event
    this.vy += CFG.gravity;
    this.x += this.vx;
    this.y += this.vy;

    // collisions with tilemap (simple AABB over tiles)
    this.resolveTileCollisions(lvl);

    // animate
    this.frameTimer += dt;
    if (this.frameTimer >= this.frameInterval) {
      this.frameTimer = 0;
      this.frameIdx = (this.frameIdx + 1) % Math.max(1, SPRITES[this.kind].length);
    }

    // clamp to level bounds
    const maxX = lvl.cols * CFG.tileSize - this.w - 4;
    if (this.x < 0) this.x = 0;
    if (this.x > maxX) this.x = maxX;

    // ability regen
    if (!this.abilityReady && Date.now() - this.lastAbility >= this.abilityCd) {
      this.abilityReady = true;
    }
  }

  resolveTileCollisions(lvl) {
    // detect which tiles the player's bbox overlaps and push back
    const leftTile = Math.floor(this.x / CFG.tileSize);
    const rightTile = Math.floor((this.x + this.w) / CFG.tileSize);
    const topTile = Math.floor(this.y / CFG.tileSize);
    const bottomTile = Math.floor((this.y + this.h) / CFG.tileSize);

    // vertical correction
    for (let tx=leftTile; tx<=rightTile; tx++){
      for (let ty=topTile; ty<=bottomTile; ty++){
        const t = tileAt(lvl, tx, ty);
        if (t === 1) {
          const tileRect = {
            x: tx * CFG.tileSize,
            y: ty * CFG.tileSize,
            w: CFG.tileSize,
            h: CFG.tileSize
          };
          // basic AABB correction
          if (this.x < tileRect.x + tileRect.w &&
              this.x + this.w > tileRect.x &&
              this.y < tileRect.y + tileRect.h &&
              this.y + this.h > tileRect.y) {
            // intersect; push out by smallest overlap
            const overlapX = Math.min(this.x + this.w - tileRect.x, tileRect.x + tileRect.w - this.x);
            const overlapY = Math.min(this.y + this.h - tileRect.y, tileRect.y + tileRect.h - this.y);
            if (overlapY < overlapX) {
              // vertical push
              if (this.y < tileRect.y) {
                // landed on top
                this.y = tileRect.y - this.h;
                this.vy = 0;
                this.onGround = true;
              } else {
                // hit from below
                this.y = tileRect.y + tileRect.h;
                this.vy = 0;
              }
            } else {
              // horizontal push
              if (this.x < tileRect.x) this.x = tileRect.x - this.w;
              else this.x = tileRect.x + tileRect.w;
              this.vx = 0;
            }
          }
        } else if (t === 2) {
          // hazard tile — if overlap, take damage
          if (this.x < (tx+1)*CFG.tileSize && this.x + this.w > tx*CFG.tileSize &&
              this.y < (ty+1)*CFG.tileSize && this.y + this.h > ty*CFG.tileSize) {
            this.takeDamage(1);
          }
        } else if (t === 3) {
          // door tile — trigger level complete when overlap center touches
          const cx = this.x + this.w/2;
          const cy = this.y + this.h/2;
          if (cx > tx*CFG.tileSize && cx < (tx+1)*CFG.tileSize &&
              cy > ty*CFG.tileSize && cy < (ty+1)*CFG.tileSize) {
            levelComplete();
          }
        }
      }
    }
  }

  jump() {
    if (this.onGround) {
      // different jump strengths
      if (this.kind === 'macaco') this.vy = -CFG.jumpPower - 6;
      else if (this.kind === 'elefante') this.vy = -CFG.jumpPower + 2;
      else if (this.kind === 'papagaio') this.vy = -CFG.jumpPower - 2;
      else this.vy = -CFG.jumpPower;
      this.onGround = false;
    }
  }

  attack() {
    const now = Date.now();
    if (now - this.lastAttack < this.attackCooldown) return;
    this.lastAttack = now;
    // create an attack hitbox in front of player
    const dir = (keys['ArrowRight'] || keys['d']) ? 1 : ((keys['ArrowLeft']||keys['a']) ? -1 : 1);
    const hx = this.x + (dir === 1 ? this.w : -40);
    const hy = this.y + this.h/3;
    const hbox = { x: hx, y: hy, w: 40, h: 30, dmg: 15 };
    // check enemies hit
    for (const e of enemies) {
      if (intersectRect(hbox, e)) {
        e.takeDamage(hbox.dmg);
      }
    }
  }

  useAbility() {
    if (!this.abilityReady) return;
    // simple abilities by kind
    if (this.kind === 'macaco') {
      // huge jump
      this.vy = -22;
    } else if (this.kind === 'tigre') {
      // dash damage
      this.x += 120;
      // hit nearby enemies
      for (const e of enemies) {
        if (Math.abs(e.x - this.x) < 120) e.takeDamage(30);
      }
    } else if (this.kind === 'papagaio') {
      // planar: slow descent
      this.vy = -6;
    } else if (this.kind === 'cobra') {
      // slide forward
      this.x += 80;
    } else if (this.kind === 'elefante') {
      // strong stomp: area damage
      for (const e of enemies) {
        if (Math.abs(e.x - this.x) < 160 && Math.abs(e.y - this.y) < 80) e.takeDamage(40);
      }
    }
    this.abilityReady = false;
    this.lastAbility = Date.now();
  }

  takeDamage(d) {
    this.health -= d;
    if (this.health <= 0) {
      this.health = 0;
      playerDead();
    }
  }

  draw(ctx) {
    // draw sprite if exists
    const frames = SPRITES[this.kind];
    const img = frames && frames.length ? frames[Math.floor(this.frameIdx) % frames.length] : null;
    if (img) ctx.drawImage(img, this.x, this.y, this.w, this.h);
    else {
      ctx.fillStyle = 'magenta';
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }
  }
}

// ------------------- Enemy class -------------------
class Enemy {
  constructor(def) {
    // def: {type, x (tile), y (tile), patrol: [min,max] }
    this.type = def.type;
    this.x = def.x * CFG.tileSize;
    this.y = def.y * CFG.tileSize - CFG.playerDisplay.h/2;
    this.w = 64; this.h = 64;
    this.vx = 1.2;
    this.health = (this.type === 'boss_tigre') ? 200 : 50;
    this.patrol = def.patrol ? def.patrol.map(p=>p*CFG.tileSize) : null;
    this.dir = 1;
    this.frameIdx = 0;
    this.frameTimer = 0;
  }

  update(dt, lvl) {
    // simple AI: patrol
    if (this.patrol) {
      if (this.x < this.patrol[0]) this.dir = 1;
      if (this.x > this.patrol[1]) this.dir = -1;
      this.x += this.dir * this.vx;
    } else {
      // walk slowly left/right
      this.x += this.vx * (Math.random()<0.01 ? -1 : 1);
    }

    // gravity
    this.vy = this.vy || 0;
    this.vy += CFG.gravity;
    this.y += this.vy;

    // keep on ground (simple)
    const groundY = lvl.rows * CFG.tileSize - CFG.tileSize*2 - this.h;
    if (this.y > groundY) { this.y = groundY; this.vy = 0; }

    this.frameTimer += dt;
    if (this.frameTimer > 150) { this.frameTimer = 0; this.frameIdx = (this.frameIdx+1)%4; }
  }

  takeDamage(d) {
    this.health -= d;
    if (this.health <= 0) {
      this.destroy();
    }
  }

  destroy() { this.dead = true; }

  draw(ctx) {
    ctx.fillStyle = (this.type === 'boss_tigre') ? '#882222' : '#663300';
    ctx.fillRect(this.x, this.y, this.w, this.h);
    // health bar
    ctx.fillStyle = 'red';
    ctx.fillRect(this.x, this.y-8, this.w * Math.max(0, this.health)/ (this.type==='boss_tigre'?200:50), 6);
  }
}

// ------------------- Utility -------------------
function intersectRect(a,b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ------------------- Level control -------------------
function spawnLevel(i) {
  enemies = [];
  player = null;
  currentLevel = i;
  ensureLevelData();
  const lvl = CFG.levels[i];
  // place player start
  player = new Player('macaco'); // default; will be replaced when user chooses
  player.x = 80; player.y = 16;
  // spawn enemies from config
  for (const ed of lvl.enemies || []) {
    enemies.push(new Enemy(ed));
  }
  updateHUD();
}

// called when player reaches door tile
function levelComplete() {
  gameState = 'win';
  messageEl.style.display = 'block';
  messageEl.innerHTML = `<h2>Fase completa!</h2><p>Clique para ir para a próxima fase</p>`;
  messageEl.onclick = () => {
    messageEl.style.display = 'none';
    if (currentLevel + 1 < CFG.levels.length) {
      spawnLevel(currentLevel+1);
      gameState = 'playing';
    } else {
      showEndScreen(true);
    }
  };
}

// player died
function playerDead() {
  gameState = 'lost';
  showEndScreen(false);
}

function showEndScreen(win) {
  messageEl.style.display = 'block';
  if (win) {
    messageEl.innerHTML = `<h2>Você venceu o jogo! 🎉</h2><p>Clique para reiniciar</p>`;
  } else {
    messageEl.innerHTML = `<h2>Game Over</h2><p>Clique para tentar novamente</p>`;
  }
  messageEl.onclick = () => {
    messageEl.style.display = 'none';
    spawnLevel(0);
    gameState = 'menu';
    showMenu();
  };
}

function updateHUD() {
  hudEl.style.display = (gameState === 'playing') ? 'block' : 'none';
  lifeValEl.textContent = player ? player.health : 0;
  levelValEl.textContent = currentLevel + 1;
  enLeftValEl.textContent = enemies.filter(e=>!e.dead).length;
}

// ------------------- Render -------------------
function drawTile(x,y,type) {
  const px = x * CFG.tileSize;
  const py = y * CFG.tileSize;
  if (type === 1) {
    ctx.fillStyle = '#5c3'; // chão
    ctx.fillRect(px, py, CFG.tileSize, CFG.tileSize);
    ctx.fillStyle = '#3a2';
    ctx.fillRect(px+4, py+CFG.tileSize-8, CFG.tileSize-8, 8);
  } else if (type === 2) {
    ctx.fillStyle = '#b33';
    ctx.fillRect(px,py,CFG.tileSize,CFG.tileSize);
  } else if (type === 3) {
    ctx.fillStyle = '#ffdc00';
    ctx.fillRect(px,py,CFG.tileSize,CFG.tileSize);
    ctx.fillStyle = '#000';
    ctx.fillText('PORTA', px+6, py+CFG.tileSize/2+4);
  }
}

// ------------------- Main loop -------------------
function gameTick(ts) {
  const dt = ts - (lastTS || ts);
  lastTS = ts;

  requestAnimationFrame(gameTick);

  // update
  if (gameState === 'playing' && player) {
    player.update(dt, CFG.levels[currentLevel]);
    enemies.forEach(e=>e.update(dt, CFG.levels[currentLevel]));
    enemies = enemies.filter(e=>!e.dead);
    updateHUD();
  }

  // clear
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // draw background
  ctx.fillStyle = '#7ec850';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // draw tilemap of current level
  if (CFG.levels && CFG.levels[currentLevel] && CFG.levels[currentLevel].data) {
    const lvl = CFG.levels[currentLevel];
    for (let r=0;r<lvl.rows;r++){
      for (let c=0;c<lvl.cols;c++){
        const t = lvl.data[r][c];
        if (t !== 0) drawTile(c,r,t);
      }
    }
  }

  // draw enemies
  enemies.forEach(e=>e.draw(ctx));

  // draw player
  if (player) player.draw(ctx);

  // check enemy-player collisions (contact damage)
  for (const e of enemies) {
    if (intersectRect(player, e)) {
      player.takeDamage(0.5);
    }
  }

  // victory condition (all enemies dead + door touch)
  if (enemies.length === 0) {
    // show hint to go to door
  }
}

// ------------------- Input -------------------
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if ((e.key === 'ArrowUp' || e.key === 'w') && player) player.jump();
  if (e.key === ' ' && player) { player.attack(); e.preventDefault(); }
  if (e.key === 'Enter' && gameState === 'menu') {
    // start first level as macaco by default
    spawnLevel(0);
    gameState = 'playing';
    menuEl.style.display = 'none';
    hudEl.style.display = 'block';
  }
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

// ------------------- Menu / start functions -------------------
function showMenu() {
  menuEl.style.display = 'block';
  hudEl.style.display = 'none';
  // build characters list
  fetch('personagems.json').then(r=>r.json()).then(data=>{
    charactersEl.innerHTML = '';
    for (const k of Object.keys(data)) {
      const btn = document.createElement('div');
      btn.className = 'char-card';
      btn.innerHTML = `<img src="${CFG.spriteRoot}/${k}/${k}_1.png" onerror="this.style.display='none'"><div style="color:#fff">${k.toUpperCase()}</div>`;
      btn.onclick = () => {
        // set player kind and start level 0
        spawnLevel(0);
        player.kind = k;
        // adjust player sprite frames if available
        gameState = 'playing';
        menuEl.style.display = 'none';
        hudEl.style.display = 'block';
      };
      charactersEl.appendChild(btn);
    }
  });
}

// ------------------- Boot sequence -------------------
(async function boot() {
  ensureLevelData();
  await loadAllSprites();
  showMenu();
  requestAnimationFrame(gameTick);
})();
