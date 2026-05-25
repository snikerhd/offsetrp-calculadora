import { ITENS_ILEGAIS, PRECOS_DROGAS, CRIMES_CATALOGO } from "./data";

// Format number with 2 decimal places
export function fmt2(n: number): string {
  return n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Format number with 0 decimal places
export function fmt(n: number): string {
  return Math.round(n).toLocaleString("pt-PT");
}

// Capitalize first letter
export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Normalize text for comparison
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "");
}

// Partial match for items (checks if item name contains the query or vice versa)
export function matchItemPartial(itemName: string, query: string): boolean {
  const normalizedItem = normalizeText(itemName);
  const normalizedQuery = normalizeText(query);
  return normalizedItem.includes(normalizedQuery) || normalizedQuery.includes(normalizedItem);
}

// Calculate sequestration fine
export function calcSequestro(civis: number, func: number): number {
  return civis * 9000 + func * 15000;
}

// Calculate ammunition fine
export function calcMunicao(
  baixoBalas: number,
  medioBalas: number,
  altoBalas: number,
  baixoCarr: number,
  medioCarr: number,
  altoCarr: number
): number {
  return (
    baixoBalas * 500 +
    medioBalas * 1000 +
    altoBalas * 1500 +
    baixoCarr * 2000 +
    medioCarr * 4000 +
    altoCarr * 6000
  );
}

// Calculate weapons fine (large quantity) - only for AT or ABOVE threshold
export function calcArmasGrandeQtde(
  baixo: number,
  medio: number,
  alto: number
): { total: number; detalhes: [string, number][] } {
  const detalhes: [string, number][] = [];
  
  // Baixo: 5+ = 150.000€ base + 20.000€ each above 5
  if (baixo >= 5) {
    const val = 150000 + (baixo - 5) * 20000;
    const desc = `Baixo (${baixo} armas): base 150.000€ + ${baixo - 5} x 20.000€`;
    detalhes.push([desc, val]);
  }
  
  // Médio: 4+ = 200.000€ base + 30.000€ each above 4
  if (medio >= 4) {
    const val = 200000 + (medio - 4) * 30000;
    const desc = `Médio (${medio} armas): base 200.000€ + ${medio - 4} x 30.000€`;
    detalhes.push([desc, val]);
  }
  
  // Alto: 3+ = 250.000€ base + 80.000€ each above 3
  if (alto >= 3) {
    const val = 250000 + (alto - 3) * 80000;
    const desc = `Alto (${alto} armas): base 250.000€ + ${alto - 3} x 80.000€`;
    detalhes.push([desc, val]);
  }
  
  const total = detalhes.reduce((sum, [, v]) => sum + v, 0);
  return { total, detalhes };
}

// Calculate illegal items fine
export function calcItensIlegais(itens: Record<string, number>): {
  total: number;
  detalhes: [string, number, number, number][];
} {
  const detalhes: [string, number, number, number][] = [];
  let total = 0;
  
  for (const [item, qtd] of Object.entries(itens)) {
    if (qtd > 0 && item in ITENS_ILEGAIS) {
      const unit = ITENS_ILEGAIS[item];
      const val = qtd * unit;
      detalhes.push([item, qtd, unit, val]);
      total += val;
    }
  }
  
  return { total, detalhes };
}

// Calculate drug fine
export function calcDroga(quant: Record<string, number>): {
  total: number;
  detalhes: [string, number, number, number][];
} {
  const detalhes: [string, number, number, number][] = [];
  let total = 0;
  
  for (const [droga, qtd] of Object.entries(quant)) {
    if (qtd > 0 && droga in PRECOS_DROGAS) {
      const unit = PRECOS_DROGAS[droga];
      let val = qtd * unit;
      
      detalhes.push([droga, qtd, unit, val]);
      total += val;
    }
  }
  
  return { total, detalhes };
}

// Get item by synonym
export function obterItemPorSinonimo(nome: string): string | null {
  const synonyms: Record<string, string> = {
    // Items básicos
    lockpick: "Lockpick",
    lockpicks: "Lockpick",
    algemas: "Algemas",
    cinto: "Cinto de ferramentas",
    masterpick: "Masterpick",
    kick: "Kick",
    pecab: "Pé de cabra",
    pedecabra: "Pé de cabra",
    granada: "Granada",
    colete: "Colete",
    silenciador: "Silenciador",
    visor: "Visor noturno",
    mochilatatica: "Mochila tática",
    mochila: "Mochila tática",
    radio: "Rádio",
    rádios: "Rádio",
    camera: "Câmera espiã",
    câmera: "Câmera espiã",
    chavefalsa: "Chave falsa",
    // Items do catálogo completo
    acessorios: "Acessórios para armas",
    acessoriosparaarmas: "Acessórios para armas",
    adaga: "Adaga templária",
    adagatemplaria: "Adaga templária",
    baleia: "Baleia",
    ouro: "Barras Ouro",
    barrasouro: "Barras Ouro",
    bau: "Baú Especiarias",
    bauespeciarias: "Baú Especiarias",
    bens: "Bens de assalto a casa",
    bensdeassaltoacasa: "Bens de assalto a casa",
    bomba: "Bomba 2ª Guerra",
    bombasegundaguerrra: "Bomba 2ª Guerra",
    c4: "C4",
    chifres: "Chifres",
    diamante: "Diamante",
    diario: "Diário de Bordo",
    diariodebordo: "Diário de Bordo",
    enxofre: "Enxofre",
    esquemas: "Esquemas de armas",
    esquemasdearmas: "Esquemas de armas",
    estanho: "Estanho",
    idolo: "Ídolo Inca",
    idoloinca: "Ídolo Inca",
    minerio: "Minérios",
    minerios: "Minérios",
    niquel: "Níquel",
    nitro: "Nitro",
    orca: "Orca",
    safira: "Pack Safira",
    packsafira: "Pack Safira",
    pacoteilegal: "Pacote Ilegal",
    pager: "Pager",
    pecas: "Peças Arma",
    pecasarma: "Peças Arma",
    pepitas: "Pepitas de ouro",
    pepitasdeouro: "Pepitas de ouro",
    polvo: "Polvo",
    polvora: "Pólvora",
    raia: "Raia",
    rebarbadora: "Rebarbadora",
    safiras: "Safiras",
    tubarao: "Tubarão Branco",
    tubaraobranco: "Tubarão Branco",
    tubaraomartelo: "Tubarão Martelo",
    medickit: "Medickits",
    medickits: "Medickits",
    // Joias
    corrente: "Corrente de Ouro",
    correnteouro: "Corrente de Ouro",
    corrente10k: "Corrente de Ouro 10k",
    aneldiamante: "Anel de Diamante",
    anel: "Anel de Diamante",
    relogio: "Relógio de Ouro",
    relogioouro: "Relógio de Ouro",
  };
  
  const key = normalizeText(nome);
  return synonyms[key] || null;
}

// Get drug by synonym
export function obterDrogaPorSinonimo(nome: string): string | null {
  // The key in synonyms must match the NORMALIZED (lowercase, no accents) version
  const synonyms: Record<string, string> = {
    // Sementes de Cannabis
    sementes: "Sementes de Cannabis",
    sementesdecannabis: "Sementes de Cannabis",
    // Cabeços de Cannabis
    cabecos: "Cabeços de Cannabis",
    cabecosdecannabis: "Cabeços de Cannabis",
    cabeco: "Cabeços de Cannabis",
    // Óleo de Cannabis
    oleo: "Óleo de Cannabis",
    oleodecannabis: "Óleo de Cannabis",
    // Saco de Cannabis
    saco: "Saco de Cannabis",
    sacodecannabis: "Saco de Cannabis",
    sacos: "Saco de Cannabis",
    // Pacote de Droga
    pacote: "Pacote de Droga",
    comodroga: "Pacote de Droga",
    pacotes: "Pacote de Droga",
    // Charros
    charros: "Charros",
    charro: "Charros",
    // Cristal
    cristal: "Cristal",
    cristais: "Cristal",
    // Cristal Processado
    cristalprocessado: "Cristal Processado",
    cristalprocess: "Cristal Processado",
    // Maço tabaco (keys are normalized - no accents)
    maco: "Maço tabaco",
    macos: "Maço tabaco",
    aco: "Maço tabaco",  // "maço" without accent normalizes to "aco"
    acos: "Maço tabaco",
    macotabaco: "Maço tabaco",
    tabacomaluco: "Maço tabaco",
    // Estimulante
    estimulate: "Estimulante",
    estimulante: "Estimulante",
  };
  
  const key = normalizeText(nome);
  return synonyms[key] || null;
}

// Parse quick input for rapid calculations
export function parseQuickInput(texto: string): any {
  const result = {
    drogas: { resultados: [] as string[], subtotal: 0 },
    itens: { resultados: [] as string[], subtotal: 0 },
    municao: { resultados: [] as string[], total: 0, base: 10000 },
    armas: { resultados: [] as string[], total: 0 },
    dinheiro: { resultados: [] as string[], total: 0 },
    sequestro: { resultados: [] as string[], total: 0 },
    crimes: { resultados: [] as string[], totalMulta: 0, totalMeses: 0 },
    totalGeral: 0,
    erros: [] as string[],
  };
  
  const partes = texto.split(",");
  
  for (const parte of partes) {
    const p = parte.trim();
    if (!p) continue;
    
    // Match pattern: quantity + name
    const m = p.match(/^(\d+)\s+(.+)$/);
    if (!m) {
      result.erros.push(`Formato inválido: '${p}'`);
      continue;
    }
    
    const qtd = parseInt(m[1]);
    const nomeOriginal = m[2].trim();
    const nome = normalizeText(nomeOriginal);
    
    // Check for drugs - exact synonym match first
    let droga = obterDrogaPorSinonimo(nome);
    
    // If no exact match, try partial match in PRECOS_DROGAS
    if (!droga) {
      for (const drogaName of Object.keys(PRECOS_DROGAS)) {
        if (matchItemPartial(drogaName, nomeOriginal)) {
          droga = drogaName;
          break;
        }
      }
    }
    
    if (droga && droga in PRECOS_DROGAS) {
      const unit = PRECOS_DROGAS[droga];
      const sub = qtd * unit;
      result.drogas.resultados.push(`${qtd} ${droga} x ${fmt(unit)}€ = ${fmt(sub)}€`);
      result.drogas.subtotal += sub;
      continue;
    }
    
    // Check for items - exact synonym match first
    let item = obterItemPorSinonimo(nome);
    
    // If no exact match, try to find item by partial match in ITENS_ILEGAIS
    if (!item) {
      for (const itemName of Object.keys(ITENS_ILEGAIS)) {
        if (matchItemPartial(itemName, nomeOriginal)) {
          item = itemName;
          break;
        }
      }
    }
    
    if (item && item in ITENS_ILEGAIS) {
      const unit = ITENS_ILEGAIS[item];
      const sub = qtd * unit;
      result.itens.resultados.push(`${qtd} ${item} x ${fmt(unit)}€ = ${fmt(sub)}€`);
      result.itens.subtotal += sub;
      continue;
    }
    
    // Check for ammunition keywords
    if (nome.includes("bala") || nome.includes("municao")) {
      if (nome.includes("baixo")) {
        result.municao.resultados.push(`${qtd} balas baixo calibre x 500€ = ${fmt(qtd * 500)}€`);
        result.municao.total += qtd * 500;
      } else if (nome.includes("medio")) {
        result.municao.resultados.push(`${qtd} balas médio calibre x 1000€ = ${fmt(qtd * 1000)}€`);
        result.municao.total += qtd * 1000;
      } else if (nome.includes("alto")) {
        result.municao.resultados.push(`${qtd} balas alto calibre x 1500€ = ${fmt(qtd * 1500)}€`);
        result.municao.total += qtd * 1500;
      } else {
        result.municao.resultados.push(`${qtd} balas x 500€ = ${fmt(qtd * 500)}€`);
        result.municao.total += qtd * 500;
      }
      continue;
    }
    
    // Check for carregador
    if (nome.includes("carregador") || nome.includes("carr")) {
      if (nome.includes("baixo")) {
        result.municao.resultados.push(`${qtd} carregadores baixo calibre x 2000€ = ${fmt(qtd * 2000)}€`);
        result.municao.total += qtd * 2000;
      } else if (nome.includes("medio")) {
        result.municao.resultados.push(`${qtd} carregadores médio calibre x 4000€ = ${fmt(qtd * 4000)}€`);
        result.municao.total += qtd * 4000;
      } else if (nome.includes("alto")) {
        result.municao.resultados.push(`${qtd} carregadores alto calibre x 6000€ = ${fmt(qtd * 6000)}€`);
        result.municao.total += qtd * 6000;
      }
      continue;
    }
    
    // Check for weapon keywords
    if (nome.includes("arma") || nome.includes("posse")) {
      // weapons in large quantity - base + per weapon above threshold
      // Baixo: 5+ = 150.000€ base + 20.000€ each above 5
      // Médio: 4+ = 200.000€ base + 30.000€ each above 4
      // Alto: 3+ = 250.000€ base + 80.000€ each above 3
      
      if (nome.includes("baixo")) {
        let total = 0;
        if (qtd >= 5) {
          total = 150000 + (qtd - 5) * 20000;
          result.armas.resultados.push(`${qtd} armas baixo calibre: base 150.000€ + ${qtd - 5} x 20.000€ = ${fmt(total)}€`);
        } else {
          total = qtd * 20000; // under threshold - individual fine
          result.armas.resultados.push(`${qtd} armas baixo calibre (sem grande qtde) x 20.000€ = ${fmt(total)}€`);
        }
        result.armas.total += total;
      } else if (nome.includes("medio")) {
        let total = 0;
        if (qtd >= 4) {
          total = 200000 + (qtd - 4) * 30000;
          result.armas.resultados.push(`${qtd} armas médio calibre: base 200.000€ + ${qtd - 4} x 30.000€ = ${fmt(total)}€`);
        } else {
          total = qtd * 30000; // under threshold - individual fine
          result.armas.resultados.push(`${qtd} armas médio calibre (sem grande qtde) x 30.000€ = ${fmt(total)}€`);
        }
        result.armas.total += total;
      } else if (nome.includes("alto")) {
        let total = 0;
        if (qtd >= 3) {
          total = 250000 + (qtd - 3) * 80000;
          result.armas.resultados.push(`${qtd} armas alto calibre: base 250.000€ + ${qtd - 3} x 80.000€ = ${fmt(total)}€`);
        } else {
          total = qtd * 80000; // under threshold - individual fine
          result.armas.resultados.push(`${qtd} armas alto calibre (sem grande qtde) x 80.000€ = ${fmt(total)}€`);
        }
        result.armas.total += total;
      }
      continue;
    }
    
    // Check for dinheiro
    if (nome.includes("dinheiro") || nome.includes("cash") || nome.includes("notas")) {
      result.dinheiro.resultados.push(`${qtd} x não declarado`);
      result.dinheiro.total += qtd * 0.75;
      continue;
    }
    
    // Check for sequestration
    if (nome.includes("sequestro") || nome.includes("refem")) {
      result.sequestro.resultados.push(`${qtd} reféns`);
      result.sequestro.total += qtd * 9000;
      continue;
    }
    
    result.erros.push(`Não reconhecido: '${m[2]}'`);
  }
  
  // Calculate totals - only add base fees if there are items in that category
  const totalItens = result.itens.subtotal > 0 ? (30000 + result.itens.subtotal) : 0;
  const totalMunicao = result.municao.total > 0 ? (result.municao.base + result.municao.total) : 0;
  
  result.totalGeral =
    result.drogas.subtotal +
    totalItens +
    totalMunicao +
    result.armas.total +
    result.dinheiro.total +
    result.sequestro.total +
    result.crimes.totalMulta;
  
  return result;
}

// Parse crimes input
export function parseCrimesInput(_texto: string, _tentativa: boolean): {
  descricoes: string[];
  totalMulta: number;
  totalMeses: number;
} {
  // This would need crime catalog integration
  // For now, return empty
  return { descricoes: [], totalMulta: 0, totalMeses: 0 };
}

// Get all crimes flat
export function getAllCrimesFlat() {
  return CRIMES_CATALOGO;
}

// Get crimes by category
export function getCrimesByCategory(categoria: string) {
  return CRIMES_CATALOGO.filter(c => c.categoria === categoria);
}

// Search crimes by name
export function searchCrimes(query: string) {
  const q = normalizeText(query);
  return CRIMES_CATALOGO.filter(c => 
    normalizeText(c.nome).includes(q) || 
    normalizeText(c.categoria).includes(q)
  );
}