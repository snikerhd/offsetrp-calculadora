import { ITENS_ILEGAIS, PRECOS_DROGAS, CRIMES_CATALOGO, Crime } from "./data";

// Alias for backwards compatibility
export type CrimeData = Crime;

// Normaliza texto para pesquisa
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

// Formata número para display (sem casas decimais, sem separador de milhares)
export function fmt(n: number): string {
  return Math.round(n).toString();
}

// Formata número para display (sem casas decimais, sem separador de milhares)
export function fmt2(n: number): string {
  return Math.round(n).toString();
}

// Capitaliza primeira letra
export function cap(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Calcula multa de sequestro
export function calcSequestro(civis: number, funcionarios: number): number {
  return civis * 9000 + funcionarios * 15000;
}

// Calcula multa de munição (tabela oficial)
export function calcMunicao(
  balasBaixo: number,
  balasMedio: number,
  balasAlto: number,
  carrBaixo: number,
  carrMedio: number,
  carrAlto: number
): number {
  return (
    balasBaixo * 500 +
    balasMedio * 1000 +
    balasAlto * 1500 +
    carrBaixo * 2000 +
    carrMedio * 4000 +
    carrAlto * 6000
  );
}

// Calcula multa de armas em grande quantidade (tabela oficial)
export function calcArmasGrandeQtde(
  baixo: number,
  medio: number,
  alto: number
): { total: number; detalhes: [string, number][]; meses: number } {
  const detalhes: [string, number][] = [];
  let total = 0;
  let meses = 0;

  // 5+ armas de calibre baixo = 150000€ + 20000€ por cada depois das 5
  if (baixo >= 5) {
    const base = 150000;
    const acrescimo = (baixo - 5) * 20000;
    const val = base + acrescimo;
    const detalhe = `5+ Armas Baixo Calibre (${baixo}x): ${fmt(val)} €`;
    detalhes.push([detalhe, val]);
    total += val;
    meses = 15;
  }

  // 4+ armas de calibre médio = 200000€ + 30000€ por cada depois das 4
  if (medio >= 4) {
    const base = 200000;
    const acrescimo = (medio - 4) * 30000;
    const val = base + acrescimo;
    const detalhe = `4+ Armas Médio Calibre (${medio}x): ${fmt(val)} €`;
    detalhes.push([detalhe, val]);
    total += val;
    if (meses < 20) meses = 20;
  }

  // 3+ armas de calibre alto = 250000€ + 80000€ por cada depois das 3
  if (alto >= 3) {
    const base = 250000;
    const acrescimo = (alto - 3) * 80000;
    const val = base + acrescimo;
    const detalhe = `3+ Armas Alto Calibre (${alto}x): ${fmt(val)} €`;
    detalhes.push([detalhe, val]);
    total += val;
    if (meses < 25) meses = 25;
  }

  // Armas de calibre variado (tráfico) - a partir de 4 armas de calibres variados
  const totalArmas = baixo + medio + alto;
  if (totalArmas >= 4 && (baixo > 0 && medio > 0) || (baixo > 0 && alto > 0) || (medio > 0 && alto > 0)) {
    // Considera como tráfico
    total = 5000000; // Máximo
    meses = 45;
    detalhes.push([`Armas Calibre Variado (Tráfico) - ${totalArmas} armas`, 5000000]);
  }

  return { total, detalhes, meses };
}

// Calcula multa de itens ilegais
export function calcItensIlegais(
  itens: Record<string, number>
): {
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

// Calcula multa de drogas
export function calcDroga(
  drogas: Record<string, number>
): {
  total: number;
  detalhes: [string, number, number, number][];
} {
  const detalhes: [string, number, number, number][] = [];
  let total = 0;

  for (const [droga, qtd] of Object.entries(drogas)) {
    if (qtd > 0 && droga in PRECOS_DROGAS) {
      const unit = PRECOS_DROGAS[droga];
      const val = qtd * unit;
      detalhes.push([droga, qtd, unit, val]);
      total += val;
    }
  }

  return { total, detalhes };
}

// Sinónimos de itens ilegais
const SYNONYMS_ITENS: Record<string, string> = {
  // Algemas
  "algemas": "Algemas",
  "algema": "Algemas",
  "handcuffs": "Algemas",
  "cuffs": "Algemas",
  // Lockpick
  "lockpick": "Lockpick",
  "lockpicks": "Lockpick",
  "lock pick": "Lockpick",
  "lock": "Lockpick",
  "lock picks": "Lockpick",
  // C4
  "c4": "C4",
  "c-4": "C4",
  "explosivo": "C4",
  "explosivos": "C4",
  // Colete
  "colete": "Colete",
  "coletes": "Colete",
  "bulletproof": "Colete",
  "bulletproof vest": "Colete",
  // Medickits
  "medickits": "Medickits",
  "medikit": "Medickits",
  "medic": "Medickits",
  "kit medico": "Medickits",
  "kit": "Medickits",
  // Diamante
  "diamante": "Diamante",
  "diamantes": "Diamante",
  "diamond": "Diamante",
  "diamonds": "Diamante",
  // Safiras
  "safiras": "Safiras",
  "safira": "Safiras",
  "sapphire": "Safiras",
  "sapphires": "Safiras",
  // Ouro
  "ouro em barras": "Barras Ouro",
  "barras ouro": "Barras Ouro",
  "barras de ouro": "Barras Ouro",
  "gold bar": "Barras Ouro",
  "gold bars": "Barras Ouro",
  "gold": "Pepitas de ouro",
  "pepitas": "Pepitas de ouro",
  "pepita": "Pepitas de ouro",
  "pepitas de ouro": "Pepitas de ouro",
  // Pólvora
  "polvora": "Pólvora",
  "pólvora": "Pólvora",
  "gunpowder": "Pólvora",
  "powder": "Pólvora",
  // Esquemas
  "esquemas": "Esquemas de armas",
  "esquema": "Esquemas de armas",
  "blueprints": "Esquemas de armas",
  "blueprint": "Esquemas de armas",
  "schema": "Esquemas de armas",
  // Peças
  "pecas": "Peças Arma",
  "peças": "Peças Arma",
  "pecas arma": "Peças Arma",
  "peças arma": "Peças Arma",
  "peça": "Peças Arma",
  // Bomba
  "bomba": "Bomba 2ª Guerra",
  "bomba 2ª": "Bomba 2ª Guerra",
  "bomba segunda": "Bomba 2ª Guerra",
  "bomb": "Bomba 2ª Guerra",
  // Rebarbadora
  "rebarbadora": "Rebarbadora",
  "rebarbador": "Rebarbadora",
  "rebard": "Rebarbadora",
  "rebarba": "Rebarbadora",
  "grinder": "Rebarbadora",
  "grinding": "Rebarbadora",
  // Nitro
  "nitro": "Nitro",
  "nitroboost": "Nitro",
  "nitroburst": "Nitro",
  // Minerais
  "minérios": "Minérios",
  "minerios": "Minérios",
  "minerals": "Minérios",
  "mineral": "Minérios",
  "ore": "Minérios",
  "estanho": "Estanho",
  "tin": "Estanho",
  "niquel": "Níquel",
  "níquel": "Níquel",
  "nickel": "Níquel",
  "enxofre": "Enxofre",
  "sulfur": "Enxofre",
  "sulphur": "Enxofre",
  // Chifres
  "chifres": "Chifres",
  "chifre": "Chifres",
  "horn": "Chifres",
  "horns": "Chifres",
  // Animais
  "baleia": "Baleia",
  "baleias": "Baleia",
  "whale": "Baleia",
  "whales": "Baleia",
  "orca": "Orca",
  "orcas": "Orca",
  "raia": "Raia",
  "raias": "Raia",
  "ray": "Raia",
  "rays": "Raia",
  "tubarao": "Tubarão Branco",
  "tubarão": "Tubarão Branco",
  "tubarao branco": "Tubarão Branco",
  "tubarão branco": "Tubarão Branco",
  "tubarao martelo": "Tubarão Martelo",
  "tubarão martelo": "Tubarão Martelo",
  "shark": "Tubarão Branco",
  "white shark": "Tubarão Branco",
  "hammerhead": "Tubarão Martelo",
  "polvo": "Polvo",
  "polvos": "Polvo",
  "octopus": "Polvo",
  "squid": "Polvo",
  // Itens especiais
  "acessorios": "Acessórios para armas",
  "acessórios": "Acessórios para armas",
  "accessory": "Acessórios para armas",
  "accessories": "Acessórios para armas",
  "adaga": "Adaga templária",
  "adagas": "Adaga templária",
  "dagger": "Adaga templária",
  "templar": "Adaga templária",
  "idolo": "Ídolo Inca",
  "ídolo": "Ídolo Inca",
  "idolos": "Ídolo Inca",
  "ídolos": "Ídolo Inca",
  "idol": "Ídolo Inca",
  "inca": "Ídolo Inca",
  "diario": "Diário de Bordo",
  "diário": "Diário de Bordo",
  "diarios": "Diário de Bordo",
  "diários": "Diário de Bordo",
  "diary": "Diário de Bordo",
  "logbook": "Diário de Bordo",
  "pager": "Pager",
  "pagers": "Pager",
  "pagina": "Pager",
  "páginas": "Pager",
  "pacote ilegal": "Pacote Ilegal",
  "pacotes ilegais": "Pacote Ilegal",
  "package": "Pacote Ilegal",
  "bau": "Baú Especiarias",
  "baú": "Baú Especiarias",
  "baus": "Baú Especiarias",
  "baús": "Baú Especiarias",
  "chest": "Baú Especiarias",
  "treasure": "Baú Especiarias",
};

// Sinónimos de drogas
const SYNONYMS_DROGAS: Record<string, string> = {
  // Cannabis - Sementes
  "semente": "Sementes de Cannabis",
  "sementes": "Sementes de Cannabis",
  "seed": "Sementes de Cannabis",
  "seeds": "Sementes de Cannabis",
  // Cannabis - Cabeços
  "cabeco": "Cabeços de Cannabis",
  "cabeços": "Cabeços de Cannabis",
  "cabeço": "Cabeços de Cannabis",
  "cabecos": "Cabeços de Cannabis",
  "bud": "Cabeços de Cannabis",
  "buds": "Cabeços de Cannabis",
  // Cannabis - Óleo
  "oleo": "Óleo de Cannabis",
  "óleo": "Óleo de Cannabis",
  "oleos": "Óleo de Cannabis",
  "óleos": "Óleo de Cannabis",
  "oleo de cannabis": "Óleo de Cannabis",
  "óleo de cannabis": "Óleo de Cannabis",
  "oil": "Óleo de Cannabis",
  "cannabis oil": "Óleo de Cannabis",
  // Cannabis - Saco
  "saco": "Saco de Cannabis",
  "sacos": "Saco de Cannabis",
  "saco de cannabis": "Saco de Cannabis",
  // Haxixe (sinónimo para cabeços)
  "haxixe": "Cabeços de Cannabis",
  "haxix": "Cabeços de Cannabis",
  "hash": "Cabeços de Cannabis",
  "hashish": "Cabeços de Cannabis",
  // Maconha
  "maconha": "Cabeços de Cannabis",
  "maconhas": "Cabeços de Cannabis",
  "marijuana": "Cabeços de Cannabis",
  "weed": "Cabeços de Cannabis",
  "weeds": "Cabeços de Cannabis",
  "pot": "Cabeços de Cannabis",
  "grass": "Cabeços de Cannabis",
  // Pacote de Droga
  "pacote": "Pacote de Droga",
  "pacotes": "Pacote de Droga",
  "pacote droga": "Pacote de Droga",
  "pacote de droga": "Pacote de Droga",
  "package": "Pacote de Droga",
  "packet": "Pacote de Droga",
  "pack": "Pacote de Droga",
  // Charros
  "charro": "Charros",
  "charros": "Charros",
  "cigarro": "Charros",
  "cigarros": "Charros",
  "cigarette": "Charros",
  "joint": "Charros",
  "joints": "Charros",
  // Tabaco - Maço
  "tabaco": "Maço tabaco",
  "maco": "Maço tabaco",
  "maço": "Maço tabaco",
  "macos": "Maço tabaco",
  "maços": "Maço tabaco",
  "maco tabaco": "Maço tabaco",
  "maço tabaco": "Maço tabaco",
  "tobacco": "Maço tabaco",
  "cigarette pack": "Maço tabaco",
  // Cristal
  "cristal": "Cristal",
  "cristais": "Cristal",
  "crystal": "Cristal",
  "crystals": "Cristal",
  "meth": "Cristal",
  "methamphetamine": "Cristal",
  // Cristal Processado
  "cristal processado": "Cristal Processado",
  "cristais processado": "Cristal Processado",
  "cristal processados": "Cristal Processado",
  "processed crystal": "Cristal Processado",
  "processed": "Cristal Processado",
  // Estimulante
  "estimulante": "Estimulante",
  "estimulantes": "Estimulante",
  "stimulant": "Estimulante",
  "energy": "Estimulante",
  "cocaína": "Estimulante",
  "cocaina": "Estimulante",
  "coke": "Estimulante",
  "cocaine": "Estimulante",
  "extase": "Estimulante",
  "ecstasy": "Estimulante",
  "mdma": "Estimulante",
  "lsd": "Estimulante",
  "acid": "Estimulante",
  "acido": "Estimulante",
  "ácido": "Estimulante",
  "heroin": "Estimulante",
  "heroina": "Estimulante",
  "heroine": "Estimulante",
  "speed": "Estimulante",
  "amphetamine": "Estimulante",
  "anfetamina": "Estimulante",
};

// Obter item por sinónimo
export function obterItemPorSinonimo(nome: string): string | null {
  const normalized = normalizeText(nome);
  
  if (!normalized) return null;
  
  // 1. Verificar se é um nome direto (match exato)
  const keys = Object.keys(ITENS_ILEGAIS);
  for (const key of keys) {
    if (normalizeText(key) === normalized) {
      return key;
    }
  }
  
  // 2. Verificar sinónimos
  const synonymKey = SYNONYMS_ITENS[normalized];
  if (synonymKey && synonymKey in ITENS_ILEGAIS) {
    return synonymKey;
  }
  
  // 3. Pesquisa parcial - nome contém o termo de busca
  for (const key of keys) {
    const keyNorm = normalizeText(key);
    if (keyNorm.includes(normalized)) {
      return key;
    }
  }
  
  // 4. Pesquisa parcial reversa - termo de busca contém parte do nome
  for (const key of keys) {
    const keyNorm = normalizeText(key);
    const words = keyNorm.split(" ");
    for (const word of words) {
      if (normalized.includes(word) && word.length > 2) {
        return key;
      }
    }
  }
  
  return null;
}

// Obter droga por sinónimo
export function obterDrogaPorSinonimo(nome: string): string | null {
  const normalized = normalizeText(nome);
  
  if (!normalized) return null;
  
  // 1. Verificar se é um nome direto (match exato)
  const keys = Object.keys(PRECOS_DROGAS);
  for (const key of keys) {
    if (normalizeText(key) === normalized) {
      return key;
    }
  }
  
  // 2. Verificar sinónimos
  const synonymKey = SYNONYMS_DROGAS[normalized];
  if (synonymKey && synonymKey in PRECOS_DROGAS) {
    return synonymKey;
  }
  
  // 3. Pesquisa parcial - nome contém o termo de busca
  for (const key of keys) {
    const keyNorm = normalizeText(key);
    if (keyNorm.includes(normalized)) {
      return key;
    }
  }
  
  // 4. Pesquisa parcial reversa - termo de busca contém parte do nome
  for (const key of keys) {
    const keyNorm = normalizeText(key);
    const words = keyNorm.split(" ");
    for (const word of words) {
      if (normalized.includes(word) && word.length > 2) {
        return key;
      }
    }
  }
  
  return null;
}

// Estrutura para parseQuickInput
interface ParseResult {
  drogas: {
    resultados: string[];
    subtotal: number;
  };
  itens: {
    resultados: string[];
    subtotal: number;
  };
  municao: {
    resultados: string[];
    base: number;
    total: number;
  };
  armas: {
    resultados: string[];
    total: number;
    meses: number;
  };
  dinheiro: {
    resultados: string[];
    total: number;
  };
  sequestro: {
    resultados: string[];
    total: number;
  };
  crimes: {
    resultados: string[];
    totalMulta: number;
    totalMeses: number;
  };
  totalGeral: number;
  erros: string[];
}

// Calibres de armas
const ARMAS_BAIXO = ["pistola", "revolver", "glock", "beretta", "1911", "taurus", "fajuta", "desert eagle", "amt backup"];
const ARMAS_MEDIO = ["smg", "submetralhadora", "mp5", "uzi", "tec9", "micro smg", "mini uzi", "combat pdw", "p90"];
const ARMAS_ALTO = ["rifle", "espingarda", "ak", "ar15", "sniper", "draco", "ak-m", "gusenberg", "famas", "shotgun 12", "tar-21", "spas-12"];

// Calibres de munição
const MUN_BAIXO = ["balas baixo", "balas de baixo", "9mm", "balas 9mm"];
const MUN_MEDIO = ["balas medio", "balas de medio", "45", "balas 45"];
const MUN_ALTO = ["balas alto", "balas de alto", "556", "762", "balas rifle"];

// Parse quick input
export function parseQuickInput(input: string): ParseResult {
  const result: ParseResult = {
    drogas: { resultados: [], subtotal: 0 },
    itens: { resultados: [], subtotal: 0 },
    municao: { resultados: [], base: 0, total: 0 },
    armas: { resultados: [], total: 0, meses: 0 },
    dinheiro: { resultados: [], total: 0 },
    sequestro: { resultados: [], total: 0 },
    crimes: { resultados: [], totalMulta: 0, totalMeses: 0 },
    totalGeral: 0,
    erros: [],
  };

  const partes = input.split(",").map((p) => p.trim()).filter(Boolean);

  for (const parte of partes) {
    const match = parte.match(/^(\d+)\s+(.+)$/);
    if (!match) {
      result.erros.push(`Formato inválido: '${parte}'`);
      continue;
    }

    const qtd = parseInt(match[1]);
    const nome = normalizeText(match[2]);
    const originalNome = match[2].trim();

    // Verificar drogas
    const droga = obterDrogaPorSinonimo(originalNome);
    if (droga) {
      const preco = PRECOS_DROGAS[droga];
      const subtotal = qtd * preco;
      result.drogas.resultados.push(`  ${qtd}x ${droga} x ${fmt(preco)} = ${fmt(subtotal)}`);
      result.drogas.subtotal += subtotal;
      continue;
    }

    // Verificar itens
    const item = obterItemPorSinonimo(originalNome);
    if (item) {
      const preco = ITENS_ILEGAIS[item];
      const subtotal = qtd * preco;
      result.itens.resultados.push(`  ${qtd}x ${item} x ${fmt(preco)} = ${fmt(subtotal)}`);
      result.itens.subtotal += subtotal;
      continue;
    }

    // Verificar armas
    let tipoArma: string | null = null;
    let caliberArma: string | null = null;

    for (const baixo of ARMAS_BAIXO) {
      if (nome.includes(baixo)) {
        tipoArma = "baixo";
        caliberArma = baixo;
        break;
      }
    }
    if (!tipoArma) {
      for (const medio of ARMAS_MEDIO) {
        if (nome.includes(medio)) {
          tipoArma = "medio";
          caliberArma = medio;
          break;
        }
      }
    }
    if (!tipoArma) {
      for (const alto of ARMAS_ALTO) {
        if (nome.includes(alto)) {
          tipoArma = "alto";
          caliberArma = alto;
          break;
        }
      }
    }

    if (tipoArma && (nome.includes("arma") || nome.includes("weapon") || nome.includes("gun"))) {
      // Verificar se é posse ou grande quantidade
      let precoBase = 0;
      if (tipoArma === "baixo") precoBase = 20000; // Posse arma ilegal baixo calibre
      else if (tipoArma === "medio") precoBase = 30000; // Posse arma ilegal médio calibre
      else precoBase = 80000; // Posse arma ilegal alto calibre

      const subtotal = qtd * precoBase;
      result.armas.resultados.push(`  ${qtd}x Arma ${tipoArma} calibre (${caliberArma}) x ${fmt(precoBase)} = ${fmt(subtotal)}`);
      result.armas.total += subtotal;
      continue;
    }

    // Verificar munição
    let tipoMun: string | null = null;
    for (const baixo of MUN_BAIXO) {
      if (nome.includes(baixo) || nome === "balas" || nome === "ammo" || nome === "municao") {
        tipoMun = "baixo";
        break;
      }
    }
    if (!tipoMun) {
      for (const medio of MUN_MEDIO) {
        if (nome.includes(medio)) {
          tipoMun = "medio";
          break;
        }
      }
    }
    if (!tipoMun) {
      for (const alto of MUN_ALTO) {
        if (nome.includes(alto)) {
          tipoMun = "alto";
          break;
        }
      }
    }

    if (tipoMun) {
      let precoUnit = 0;
      if (tipoMun === "baixo") precoUnit = 500;
      else if (tipoMun === "medio") precoUnit = 1000;
      else precoUnit = 1500;

      const subtotal = qtd * precoUnit;
      result.municao.resultados.push(`  ${qtd}x Balas ${tipoMun} calibre x ${fmt(precoUnit)} = ${fmt(subtotal)}`);
      result.municao.total += subtotal;
      continue;
    }

    // Verificar carregadores
    if (nome.includes("carregador")) {
      let precoUnit = 0;
      if (tipoMun === "baixo" || nome.includes("baixo")) precoUnit = 2000;
      else if (tipoMun === "medio" || nome.includes("medio")) precoUnit = 4000;
      else if (tipoMun === "alto" || nome.includes("alto")) precoUnit = 6000;
      else precoUnit = 2000; // Default

      const subtotal = qtd * precoUnit;
      result.municao.resultados.push(`  ${qtd}x Carregador x ${fmt(precoUnit)} = ${fmt(subtotal)}`);
      result.municao.total += subtotal;
      continue;
    }

    // Verificar dinheiro
    if (nome.includes("dinheiro") || nome.includes("cash") || nome.includes("money")) {
      if (qtd > 10000) {
        const multa = qtd * 0.75;
        result.dinheiro.resultados.push(`  ${fmt(qtd)} € x 75% = ${fmt(multa)} €`);
        result.dinheiro.total += multa;
      }
      continue;
    }

    // Verificar sequestro
    if (nome.includes("sequestro") || nome.includes("refem") || nome.includes("refén")) {
      if (nome.includes("func") || nome.includes("publico") || nome.includes("policial")) {
        result.sequestro.resultados.push(`  ${qtd}x Refém funcionário público x 15.000 € = ${fmt(qtd * 15000)}`);
        result.sequestro.total += qtd * 15000;
      } else {
        result.sequestro.resultados.push(`  ${qtd}x Refém civil x 9.000 € = ${fmt(qtd * 9000)}`);
        result.sequestro.total += qtd * 9000;
      }
      continue;
    }

    result.erros.push(`Não reconhecido: '${originalNome}'`);
  }

  // Calcular totals - só adicionar base se houver itens nessa categoria
  const totalDrogas = result.drogas.subtotal > 0 ? result.drogas.subtotal : 0;
  const totalItens = result.itens.subtotal > 0 ? 30000 + result.itens.subtotal : 0;
  const totalMunicao = result.municao.total;
  const totalArmas = result.armas.total;

  result.totalGeral =
    totalDrogas +
    totalItens +
    totalMunicao +
    totalArmas +
    result.dinheiro.total +
    result.sequestro.total +
    result.crimes.totalMulta;

  return result;
}

// Crimes por nome - sinónimos
const SYNONYMS_CRIMES: Record<string, string> = {
  // Assaltos
  "assalto a casa": "Assalto a Casa",
  "assalto casa": "Assalto a Casa",
  "assalto a joalharia": "Assalto a Joalharia",
  "assalto joalharia": "Assalto a Joalharia",
  "assalto a banco": "Assalto a Banco",
  "assalto banco": "Assalto a Banco",
  "assalto a loja": "Assalto a Loja",
  "assalto loja": "Assalto a Loja",
  "assalto a contentor": "Assalto a Contentor",
  "assalto contentor": "Assalto a Contentor",
  "assalto a loja de armas": "Assalto a Loja de Armas",
  "assalto a carrinha de valores": "Assalto a Carrinha de Valores",
  "assalto a porta-aviões": "Assalto ao Porta-Aviões",
  "assalto porta-aviões": "Assalto ao Porta-Aviões",
  // Roubos
  "roubo": "Roubo",
  "roubo de armamento": "Roubo de Armamento do Estado",
  // Furto
  "furto": "Furto",
  "burla": "Burla",
  // Sequestro
  "sequestro": "Sequestro",
  // Drogas
  "posse de droga": "Posse de Droga",
  "posse droga": "Posse de Droga",
  "fabrico de droga": "Fabrico de Droga",
  "venda de droga": "Venda de Droga",
  "tráfico": "Venda de Droga",
  "trafico": "Venda de Droga",
  // Armas
  "posse de arma branca": "Posse de Arma Branca s/Porte ou Illegal",
  "posse arma branca": "Posse de Arma Branca s/Porte ou Illegal",
  "exibição de arma branca": "Exibição de Arma Branca",
  "exibição arma branca": "Exibição de Arma Branca",
  "exibição de arma de fogo": "Exibição de Arma de Fogo em Público",
  "exibição arma de fogo": "Exibição de Arma de Fogo em Público",
  "posse de arma ilegal": "Posse de Arma de Fogo Illegal de Baixo Calibre",
  "arma ilegal": "Posse de Arma de Fogo Illegal de Baixo Calibre",
  "arma de fogo ilegal": "Posse de Arma de Fogo Illegal de Baixo Calibre",
  "fabrico de armas": "Fabrico Illegal de Armas",
  "fabrico illegal de armas": "Fabrico Illegal de Armas",
  "compra e venda de armas": "Compra e Venda de Armas",
  "armas em grande quantidade": "Posse de Armas em Grande Quantidade",
  "grande quantidade de armas": "Posse de Armas em Grande Quantidade",
  // Munição
  "posse de munição": "Posse de Munição",
  "posse munição": "Posse de Munição",
  "munição": "Posse de Munição",
  // Condução
  "condução imprudente": "Condução Imprudent",
  "conduzir sem habilitação": "Conduzir sem Habilitação",
  "conduzir sem carta": "Conduzir sem Habilitação",
  "excesso de velocidade": "Excesso de Velocidade",
  "velocidade": "Excesso de Velocidade",
  "dirigir sob influência": "Dirigir sob Influência de Substâncias",
  "embriaguez": "Dirigir sob Influência de Substâncias",
  "fuga": "Fuga às Autoridades",
  "fuga ao fisco": "Fuga ao Fisco",
  "uso de veículo furtado": "Uso de Veículo Furtado",
  "veículo furtado": "Uso de Veículo Furtado",
  // Crimes contra o estado
  "desobediência": "Desobediência",
  "desrespeito à autoridade": "Desrespeito à Autoridade",
  "desrespeito em tribunal": "Desrespeito em Tribunal",
  "resistência à ordem de prisão": "Resistência à Ordem de Prisão",
  "resistência": "Resistência à Ordem de Prisão",
  "escapar a custódia": "Escapar a Custódia",
  "fuga de custódia": "Escapar a Custódia",
  "suborno": "Suborno",
  "tentativa de suborno": "Tentativa de Suborno",
  "corrupção": "Corrupção",
  "usurpação de identidade": "Usurpação de Identidade",
  "usurpação de funções": "Usurpação de Funções",
  "obstrução à justiça": "Obstrução à Justiça",
  "omissão de auxílio": "Omissão de Auxílio",
  "poluição sonora": "Poluição Sonora",
  "invasão de propriedade": "Invasão de Propriedade Privada",
  "invasão propriedade": "Invasão de Propriedade Privada",
  "invasao": "Invasão de Propriedade Privada",
  // Crimes contra pessoas
  "ameaça": "Ameaça",
  "ofensa à integridade física": "Ofensa à Integridade Física Simples",
  "ofensa fisica": "Ofensa à Integridade Física Simples",
  "ofensa grave": "Ofensa à Integridade Física Grave",
  "homicídio": "Homicídio",
  "homicidio": "Homicídio",
  "homicídio por negligência": "Homicídio por Negligência",
  "homicídio qualificado": "Homicídio Qualificado",
  "tortura": "Tortura",
  "violência doméstica": "Violência Doméstica",
  "violencia domestica": "Violência Doméstica",
  "assédio": "Assédio",
  "extorsão": "Extorsão",
  "difamação": "Difamação",
  "injúria": "Injúria",
  "injuria": "Injúria",
  // Atividades ilícitas
  "caça ilegal": "Caça Illegal",
  "pesca ilegal": "Pesca Illegal",
  "crueldade animal": "Crueldade Animal",
  "mineração ilegal": "Mineração Illegal",
  "atividades ilegais": "Atividade Illegal numa Empresa",
  // Crimes graves
  "terrorismo": "Atividade Terroristas",
  "atividade terrorista": "Atividade Terroristas",
  "lavagem de dinheiro": "Lavagem de Dinheiro",
  "branqueamento": "Lavagem de Dinheiro",
  "organização criminosa": "Organização Criminosa",
  "racismo": "Racismo e Discriminação",
  "discriminação": "Racismo e Discriminação",
};

export function parseCrimesInput(
  input: string,
  tentativa: boolean
): {
  descricoes: string[];
  totalMulta: number;
  totalMeses: number;
} {
  const descricoes: string[] = [];
  let totalMulta = 0;
  let totalMeses = 0;

  const partes = input.split(",").map((p) => p.trim()).filter(Boolean);

  for (const parte of partes) {
    const match = parte.match(/^(\d+)\s+(.+)$/);
    if (!match) {
      descricoes.push(`⚠️ Não reconhecido: '${parte}'`);
      continue;
    }

    const qtd = parseInt(match[1]);
    const nome = normalizeText(match[2]);
    const originalNome = match[2].trim();

    // Buscar crime
    let crimeNome: string | null = null;

    // Verificar sinónimos
    const synonymKey = SYNONYMS_CRIMES[nome];
    if (synonymKey) {
      crimeNome = synonymKey;
    }

    // Buscar no catálogo
    if (!crimeNome) {
      for (const crime of CRIMES_CATALOGO) {
        if (normalizeText(crime.nome).includes(nome) || nome.includes(normalizeText(crime.nome))) {
          crimeNome = crime.nome;
          break;
        }
      }
    }

    if (crimeNome) {
      const crime = CRIMES_CATALOGO.find((c) => c.nome === crimeNome);
      if (crime) {
        const meses = tentativa ? crime.meses * 0.75 : crime.meses; // 25% redução se tentado
        const multa = tentativa ? crime.multa * 0.75 : crime.multa; // 25% redução se tentado

        if (multa > 0) {
          descricoes.push(
            tentativa
              ? `${qtd}x ${crime.nome} (tentado) = ${crime.meses} meses, ${fmt(crime.multa)} € → ${fmt(multa)} €`
              : `${qtd}x ${crime.nome} = ${crime.meses} meses, ${fmt(crime.multa)} €`
          );
          totalMulta += multa * qtd;
        } else {
          descricoes.push(
            `${qtd}x ${crime.nome} = ${crime.meses} meses (valor a determinar)`
          );
        }
        totalMeses += meses * qtd;
      }
    } else {
      descricoes.push(`⚠️ Crime não reconhecido: '${originalNome}'`);
    }
  }

  return { descricoes, totalMulta, totalMeses };
}

// Obter todos os crimes em lista plana
export function getAllCrimesFlat(): Crime[] {
  return CRIMES_CATALOGO;
}

// Obter crimes por categoria
export function getCrimesByCategory(categoria: string): Crime[] {
  return CRIMES_CATALOGO.filter(c => c.categoria === categoria);
}

// Obter todas as categorias
export function getAllCategories(): string[] {
  const categories = new Set(CRIMES_CATALOGO.map(c => c.categoria));
  return Array.from(categories);
}
