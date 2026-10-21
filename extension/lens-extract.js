// lens-extract.js — v8.0 (robusto: •Nome (xN) e Nome (xN): desc)
(function () {
  console.log("[LensExtract] v8.0 iniciado em:", location.href);
  console.log("[LensExtract] frame:", window === window.top ? "TOP" : "IFRAME");

  // Item "• Nome (xN)" (sufixo opcional) e metadata da arma em linha própria
  // ("• Munições: 75", "• Acessórios: ..."). Captura-se a linha INTEIRA para o
  // parser receber também o sufixo "— Munições: 75 | Acessórios: ...".
  const RE_ITEM_DASH  = /^[•○●▪\-]*\s*(.{2,80}?)\s*-\s*(\d{1,6})\s*$/i; // Nome - N (novo formato)
  const RE_ITEM       = /^[•○●▪\-]*\s*(.{2,80}?)\s*\(x\s*(\d{1,6})\)/i; // Nome (xN) (antigo, compatibilidade)
  const RE_ITEM2      = /^[•○●▪\-]*\s*(.{2,80}?)\s*\([^)]+\)\s*\(\s*x\s*(\d{1,6})\s*\)/i; // Nome (English) (xN)
  const RE_MUNICAO    = /^[•○●▪\-]*\s*(.{2,80}?)\s*\(\s*muni[cç][aã]o\s*:/i; // Nome (Munição: N)
  const RE_META       = /^[•○●▪\-]*\s*(muni[cç][aã]?[oõ]?e?s?|acess[oó]rios?|arma|weapon)\s*(:|-\s*\d)/i;

  function extrair() {
    const texto = document.body.innerText || "";
    const linhas = [];

    for (const bruta of texto.split("\n")) {
      const linha = bruta.trim();
      if (!linha) continue;
      if (RE_ITEM_DASH.test(linha) || RE_ITEM.test(linha) || RE_ITEM2.test(linha) || RE_MUNICAO.test(linha)) {
        linhas.push(linha.replace(/^[•○●▪\-*]?\s*/, ""));
        continue;
      }
      if (RE_META.test(linha)) {
        linhas.push(linha.replace(/^[•○●▪\-*]?\s*/, ""));
      }
    }

    // NÃO deduplica: armas/itens legítimos repetidos (ex.: 3× "Assault SMG")
    // contam-se todos — o parser (backend) soma por nome. Só remove linhas vazias.
    const limpas = linhas.filter((l) => l.trim().length > 0);

    if (limpas.length >= 2) {
      console.log("[LensExtract] ✅ " + limpas.length + " linhas capturadas");
      return limpas.join("\n");
    }
    return "";
  }

  // Fallback de prosa: quando o AI Overview descreve a imagem em vez de listar
  // "Nome (xN)" (ex.: "...containing items like a Bifana, Sumo Maracujá, ..."),
  // extrai os nomes de itens das frases descritivas. Quantidades só se houver
  // "(xN)"/"xN" explícito; senão assume 1.
  function extrairDaProsa() {
    const body = (document.body.innerText || "").replace(/\s+/g, " ");
    const introducers = [
      /items?\s+like\s+(.+)/i, /itens?\s+como\s+(.+)/i, /containing\s+(.+)/i,
      /contendo\s+(.+)/i, /including\s+(.+)/i, /incluindo\s+(.+)/i,
      /featuring\s+(.+)/i, /consists?\s+of\s+(.+)/i, /such\s+as\s+(.+)/i,
    ];
    let src = "";
    for (const re of introducers) { const m = body.match(re); if (m && m[1]) { src = m[1]; break; } }
    if (!src) return "";
    src = src.split(/\.\s|\.$/)[0];
    const itens = [];
    const seen = new Set();
    for (const part of src.split(/,|\band\b|\be\b/i)) {
      let s = part.trim().replace(/^(a|an|o|os|as|the|um|uma|uns|umas)\s+/i, "");
      if (!s) continue;
      let qty = null;
      const qm = s.match(/\(?\s*x\s*(\d{1,6})\s*\)?\s*$/i) || s.match(/\bx\s*(\d{1,6})\b/i) || s.match(/-\s*(\d{1,6})\s*$/);
      if (qm) { qty = qm[1]; s = s.replace(/\s*\(?\s*x\s*\d{1,6}\s*\)?\s*$/i, "").trim(); }
      s = s.replace(/[.;:)\]]+$/, "").trim();
      if (s.length < 2 || s.length > 60 || !/[a-zà-ú]/i.test(s)) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      itens.push(qty ? `${s} (x${qty})` : `${s} (x1)`);
      if (itens.length >= 80) break;
    }
    return itens.length >= 2 ? [...new Set(itens)].join("\n") : "";
  }

  // Query multimodal: escreve o pedido de lista na barra de pesquisa do Lens e
  // submete — exactamente o que funciona manualmente. Só corre se a barra
  // estiver vazia (o &q= do URL pode já a ter preenchido) e uma única vez.
  const QUERY = "Lista todos os itens visíveis na imagem, um por linha, no formato: Nome - Quantidade. Usa o nome EXACTO em PORTUGUÊS da imagem — não traduzas para inglês nem adiciones nomes em inglês entre parênteses. Inclui armas, munições e acessórios. Para cada arma escreve: Nome da arma - Quantidade, e na linha seguinte a munição: Munição - N (arma Classe 3 rifle = balas alto calibre, Classe 2 SMG = balas médio calibre, Classe 1 pistola = balas baixo calibre). SÓ adiciona a linha Acessórios - N se a imagem tiver uma secção ACESSÓRIOS com acessórios REAIS e nomeados listados (N é o número de acessórios); se NÃO houver secção ACESSÓRIOS nem acessórios visíveis, NÃO adiciones essa linha. Nunca inventes acessórios. Se houver um número em cima de algo, ignora esse número e considera sempre quantidade 1.";
  let queryFeita = false;
  function tentarQuery() {
    if (queryFeita) return;
    const input = document.querySelector('textarea[name="q"]')
      || document.querySelector('input[name="q"]')
      || document.querySelector('form[role="search"] input')
      || document.querySelector('form[role="search"] textarea')
      || document.querySelector('[role="searchbox"]')
      || document.querySelector('[role="combobox"]')
      || document.querySelector('input[type="text"]')
      || document.querySelector('input[title*="earch" i]')
      || document.querySelector('input[aria-label*="earch" i]')
      || document.querySelector('[contenteditable="true"]');
    if (!input) return; // barra ainda não apareceu — tenta no próximo ciclo
    const atual = (input.value || input.textContent || "").trim();
    // Fluxo automático (a extensão abriu a página): se a barra já tem o NOSSO
    // query, não repete. Se tem OUTRO conteúdo (auto-análise do Lens, URL, etc.),
    // substitui pelo nosso query — neste fluxo não há query manual a preservar.
    if (atual === QUERY.trim() || /quantidade/i.test(atual)) { queryFeita = true; console.log("[LensExtract] query já escrita, não repete"); return; }
    queryFeita = true;
    try {
      input.focus();
      if (input.click) input.click();
      const proto = input.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype
        : input.tagName === "INPUT" ? window.HTMLInputElement.prototype
        : window.HTMLElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && desc.set) desc.set.call(input, QUERY);
      else input.textContent = QUERY;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      const form = input.closest("form");
      if (form && form.requestSubmit) { try { form.requestSubmit(); } catch {} }
      ["keydown", "keypress", "keyup"].forEach((t) =>
        input.dispatchEvent(new KeyboardEvent(t, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }))
      );
      console.log("[LensExtract] ✅ query escrita e submetida:", QUERY.slice(0, 50));
    } catch (e) {
      console.warn("[LensExtract] falha ao submeter query:", e);
    }
  }

  let enviado = false;
  let tentativas = 0;
  const maxTentativas = 60;

  const interval = setInterval(() => {
    tentativas++;

    const btnCookies = document.querySelector("#L2AGLb");
    if (btnCookies) btnCookies.click();

    // Espera 10s para a página/imagem carregar antes de escrever a query.
    if (tentativas >= 10) tentarQuery();
    if (tentativas === 8 && !queryFeita) {
      const inputs = [...document.querySelectorAll('input, textarea, [contenteditable], [role="searchbox"], [role="combobox"]')]
        .map((el) => el.tagName + (el.name ? "[" + el.name + "]" : "") + (el.type ? ":" + el.type : "") + (el.getAttribute("aria-label") ? ":" + el.getAttribute("aria-label") : ""))
        .slice(0, 12);
      console.log("[LensExtract] inputs na página:", JSON.stringify(inputs));
    }

    // Só extrai da página de RESULTADOS (google.com/search = imagem+query juntas).
    // Nunca da página de upload (uploadbyurl) — essa mostra só matches visuais,
    // sem a lista completa do AI Overview.
    const isResultados = /google\.com\/search/.test(location.href);
    // Só extrai após o AI Overview ter tempo de renderizar (15s min). Isto
    // evita extrair matchs visuais vazios antes de a IA listar os itens.
    const allowExtract = tentativas >= 15;
    let texto = (isResultados && allowExtract) ? extrair() : "";
    if (!texto && isResultados && allowExtract && tentativas >= 18) texto = extrairDaProsa();
    if (texto && !enviado) {
      enviado = true;
      console.log("[LensExtract] TEXTO FINAL:\n" + texto);
      browser.runtime.sendMessage({ type: "LENS_TEXT_EXTRACTED", text: texto });
      clearInterval(interval);
      return;
    }

    if (tentativas % 5 === 0) {
      const body = document.body.innerText || "";
      const amostra = body.split("\n").filter(l => /\(x\s*\d+\)/i.test(l)).slice(0, 5).join(" | ");
      console.log(`[LensExtract] ${tentativas}s — body:${body.length}chars amostra(xN):[${amostra}]`);
    }

    if (tentativas >= maxTentativas) {
      console.warn("[LensExtract] ❌ Timeout após " + maxTentativas + "s");
      console.warn("[LensExtract] Amostra do body:");
      console.warn(document.body.innerText.substring(0, 500));
      browser.runtime.sendMessage({ type: "LENS_TEXT_FAILED" });
      clearInterval(interval);
    }
  }, 1000);
})();


