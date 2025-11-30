// config.js - configurações e mapas (tilemap)
const CFG = {
  spriteRoot: 'sprites_animais',
  canvas: { w: 960, h: 540 },

  // tamanhos (ajuste para encaixar seu art)
  tileSize: 48,           // tamanho visual do tile (px)
  playerDisplay: { w: 72, h: 96 },

  gravity: 0.7,
  moveSpeed: 4,
  jumpPower: 14,

  // personagens (nº frames já fornecido)
  animals: {
    macaco:   { frames: 4, abilityCooldown: 3000 },
    tigre:    { frames: 3, abilityCooldown: 3500 },
    papagaio: { frames: 4, abilityCooldown: 4000 },
    cobra:    { frames: 4, abilityCooldown: 2500 },
    elefante: { frames: 5, abilityCooldown: 7000 }
  },

  // mapas: 0 = vazio, 1 = chão/solido, 2 = obstáculo danoso (espinhos), 3 = porta/chegada
  // cada nível é uma matriz de números (linhas * colunas). Colunas serão calculadas pela largura / tileSize.
  levels: [
    // Fase 1 — tutorial / coletar 0 inimigos simples
    {
      name: "Fase 1 - Clareira",
      cols: 30,
      rows: 12,
      data: [
        // 12 linhas de 30 colunas cada (escrevemos linhas aqui). Para facilitar, linhas curtas preenchidas por 0.
        // nota: linha 0 = topo
        // linhas: preencher em arrays longos; vamos gerar aqui programaticamente no code principal caso queira editar.
      ],
      enemies: [
        // inimigos posicionados por tile (col,row)
        { type: 'tigre_inimigo', x: 12, y: 9, patrol: [10,14] }
      ]
    },

    // Fase 2 — obstáculos / mais inimigos
    {
      name: "Fase 2 - Lama e Troncos",
      cols: 40, rows: 12,
      data: [],
      enemies: [
        { type: 'cobra_inimigo', x: 15, y: 9, patrol: [12,18] },
        { type: 'tigre_inimigo', x: 28, y: 9, patrol: [26,30] }
      ]
    },

    // Fase 3 — boss (tigre forte)
    {
      name: "Fase 3 - Covil do Tigre",
      cols: 36, rows: 12,
      data: [],
      enemies: [
        { type: 'boss_tigre', x: 30, y: 8 }
      ]
    }
  ]
};
