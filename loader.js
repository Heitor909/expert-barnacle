async function carregarPersonagens() {
    const dados = await fetch("personagems.json").then(r => r.json());
    const container = document.getElementById("personagens");

    Object.keys(dados).forEach(nome => {
        const card = document.createElement("div");
        card.className = "card";

        const img = document.createElement("img");
        img.src = `sprites/${nome}/${nome}_1.png`;

        card.appendChild(img);
        card.innerHTML += `<p>${nome.toUpperCase()}</p>`;

        card.onclick = () => iniciarJogo(nome);
        container.appendChild(card);
    });
}

carregarPersonagens();
