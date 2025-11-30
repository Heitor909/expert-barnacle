let canvas = document.getElementById("gameCanvas");
let ctx = canvas.getContext("2d");

let personagem = null;
let frameAtual = 0;
let tempoAnimacao = 0;

async function iniciarJogo(nome) {
    document.getElementById("menu").style.display = "none";
    canvas.style.display = "block";

    const dados = await fetch("personagems.json").then(r => r.json());

    personagem = {
        nome,
        frames: dados[nome].frames,
        habilidade: dados[nome].habilidade,
        imagens: [],
        x: 50,
        y: 350
    };

    // Carrega frames
    for (let i = 1; i <= personagem.frames; i++) {
        let img = new Image();
        img.src = `sprites/${nome}/${nome}_${i}.png`;
        personagem.imagens.push(img);
    }

    requestAnimationFrame(loop);
}

function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    tempoAnimacao++;
    if (tempoAnimacao % 10 === 0) {
        frameAtual = (frameAtual + 1) % personagem.frames;
    }

    ctx.drawImage(personagem.imagens[frameAtual], personagem.x, personagem.y);

    requestAnimationFrame(loop);
}
