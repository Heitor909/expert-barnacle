// game.js - motor simples para demo com animação por frames individuais
// Requisitos: pasta "sprites_animais" com subpastas por animal contendo os PNGs em ordem.
// Estrutura de pastas esperada (relativa à pasta onde index.html está):
// sprites_animais/macaco/macaco_1.png ... macaco_4.png
// sprites_animais/tigre/tigre_1.png ... tigre_3.png
// etc

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const DPR = window.devicePixelRatio || 1;
canvas.width = canvas.width * DPR;
canvas.height = canvas.height * DPR;
ctx.scale(DPR, DPR);

const CONFIG = {
  spriteRoot: 'sprites_animais',
  animals: {
    macaco: { frames: 4, abilityCooldown: 6000 },
    tigre:  { frames: 3, abilityCooldown: 3000 },
    papagaio:{ frames: 4, abilityCooldown: 4000 },
    cobra:  { frames: 4, abilityCooldown: 2500 },
    elefante:{ frames: 5, abilityCooldown: 7000 }
  },
  playerSize: { w: 72, h: 120 }, // tamanho em tela (ajustável)
  speed: 4,
  gravity: 0.6,
  jumpPower: 14
};

// carrega imagens dos frames em memória
async function loadAllSprites() {
  const animals = CONFIG.animals;
  const result = {};
  for (const key of Object.keys(animals)) {
    const fcount = animals[key].frames;
    result[key] = [];
    for (let i=1;i<=fcount;i++){
      const img = new Image();
      img.src = `${CONFIG.spriteRoot}/${key}/${key}_${i}.png`;
      await img.decode().catch(()=>{}); // tenta decodificar (ignora erro)
      result[key].push(img);
    }
  }
  return result;
}

let SPRITES = null;
let player = null;
let keys = {};

// player class - simples
class Player {
  constructor(kind, frames) {
    this.kind = kind;
    this.frames = frames;
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.frameInterval = 120; // ms
    this.x = 80; this.y = canvas.height / DPR - CONFIG.playerSize.h - 30;
    this.vx = 0; this.vy = 0;
    this.onGround = true;
    this.abilityReady = true;
    this.lastAbility = 0;
  }
  update(dt) {
    // input
    const moveRight = keys['ArrowRight'] || keys['d'];
    const moveLeft  = keys['ArrowLeft'] || keys['a'];
    if (moveRight) this.vx = CONFIG.speed;
    else if (moveLeft) this.vx = -CONFIG.speed;
    else this.vx = 0;

    // apply
    this.x += this.vx;
    this.vy += CONFIG.gravity;
    this.y += this.vy;

    // ground collision
    const groundY = canvas.height / DPR - 30 - CONFIG.playerSize.h;
    if (this.y >= groundY) {
      this.y = groundY;
      this.vy = 0;
      this.onGround = true;
    } else this.onGround = false;

    // animate when moving
    this.frameTimer += dt;
    if (this.frameTimer >= this.frameInterval) {
      this.frameTimer = 0;
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }

    // ability regen
    if (!this.abilityReady) {
      const cooldown = CONFIG.animals[this.kind].abilityCooldown;
      if (Date.now() - this.lastAbility >= cooldown) this.abilityReady = true;
    }
  }
  jump() {
    if (this.onGround) {
      // default jump changed by animal (macaco jumps more, papagaio can plane)
      const base = CONFIG.jumpPower;
      if (this.kind === 'macaco') this.vy = - (base + 6);
      else if (this.kind === 'elefante') this.vy = - (base - 4);
      else if (this.kind === 'papagaio') this.vy = - (base + 2);
      else this.vy = - base;
      this.onGround = false;
    }
  }
  useAbility() {
    if (!this.abilityReady) return;
    // abilities: side effects here
    if (this.kind === 'macaco') {
      // pulinho extra
      this.vy = -20;
    } else if (this.kind === 'tigre') {
      // dash forward
      this.x += 80;
    } else if (this.kind === 'papagaio') {
      // planar: reduce vy for a moment
      this.vy = -6;
    } else if (this.kind === 'cobra') {
      // small slide (lower height) - for now small forward
      this.x += 40;
    } else if (this.kind === 'elefante') {
      // strong stomp: small screen shake effect (visual)
      // implement simple forward push
      this.x += 50;
    }
    this.abilityReady = false;
    this.lastAbility = Date.now();
  }
  draw(ctx) {
    const img = this.frames[this.frameIndex];
    if (!img) {
      ctx.fillStyle = 'magenta';
      ctx.fillRect(this.x, this.y, CONFIG.playerSize.w, CONFIG.playerSize.h);
      return;
    }
    // Draw image centered in box. We assume sprite art has transparency and similar proportions
    ctx.drawImage(img, this.x, this.y, CONFIG.playerSize.w, CONFIG.playerSize.h);
  }
}

function setupTouchControls() {
  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');
  const jumpBtn = document.getElementById('jumpBtn');
  const abilityBtn = document.getElementById('abilityBtn');

  leftBtn.addEventListener('touchstart', e => { e.preventDefault(); keys['ArrowLeft']=true; });
  leftBtn.addEventListener('touchend', e => { e.preventDefault(); keys['ArrowLeft']=false; });

  rightBtn.addEventListener('touchstart', e => { e.preventDefault(); keys['ArrowRight']=true; });
  rightBtn.addEventListener('touchend', e => { e.preventDefault(); keys['ArrowRight']=false; });

  jumpBtn.addEventListener('touchstart', e => { e.preventDefault(); player && player.jump(); });
  abilityBtn.addEventListener('touchstart', e => { e.preventDefault(); player && player.useAbility(); });
}

function buildCharacterMenu() {
  const container = document.getElementById('characters');
  for (const key of Object.keys(CONFIG.animals)) {
    const btn = document.createElement('button');
    btn.className = 'char-btn';
    btn.innerHTML = `<img class="char-preview" src="${CONFIG.spriteRoot}/${key}/${key}_1.png" onerror="this.style.display='none'"><div>${key}</div>`;
    btn.onclick = () => { startGame(key); };
    container.appendChild(btn);
  }
}

let lastTime = 0;
function gameLoop(ts) {
  const dt = ts - (lastTime || ts);
  lastTime = ts;

  // update
  if (player) player.update(dt);

  // clear
  ctx.clearRect(0,0, canvas.width, canvas.height);

  // ground
  ctx.fillStyle = '#2e8b2e';
  ctx.fillRect(0, canvas.height/DPR - 30, canvas.width/DPR, 30);

  // draw player
  if (player) player.draw(ctx);

  requestAnimationFrame(gameLoop);
}

function startGame(kind) {
  const menu = document.getElementById('menu');
  menu.style.display = 'none';
  // hide menu; ensure sprites loaded
  player = new Player(kind, SPRITES[kind]);
  document.getElementById('touch-controls').style.display = 'flex';
}

window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if ((e.key === 'ArrowUp' || e.key === 'w') && player) player.jump();
  if (e.key === ' ' && player) { player.useAbility(); e.preventDefault(); }
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

(async function main() {
  setupTouchControls();
  buildCharacterMenu();
  try {
    SPRITES = await loadAllSprites();
    // resize canvas to CSS size for DPI-safe drawing
    const cssW = Math.min(window.innerWidth - 20, 960);
    const cssH = Math.min(window.innerHeight - 20, 540);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
  } catch (err) {
    console.warn('Erro carregando sprites:', err);
  }
  requestAnimationFrame(gameLoop);
})();
