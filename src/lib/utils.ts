import { ITENS_ILEGAIS, PRECOS_DROGAS, CRIMES_CATALOGO, Crime } from "@/lib/data";
import { ITEM_BY_NAME } from "@/lib/item-weights";

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
    const detalhe = `5+ Armas Baixo Calibre (${baixo}x) — GRANDE QUANTIDADE: ${fmt(val)} €`;
    detalhes.push([detalhe, val]);
    total += val;
    meses = 15;
  }

  // 4+ armas de calibre médio = 200000€ + 30000€ por cada depois das 4
  if (medio >= 4) {
    const base = 200000;
    const acrescimo = (medio - 4) * 30000;
    const val = base + acrescimo;
    const detalhe = `4+ Armas Médio Calibre (${medio}x) — GRANDE QUANTIDADE: ${fmt(val)} €`;
    detalhes.push([detalhe, val]);
    total += val;
    if (meses < 20) meses = 20;
  }

  // 3+ armas de calibre alto = 250000€ + 80000€ por cada depois das 3
  if (alto >= 3) {
    const base = 250000;
    const acrescimo = (alto - 3) * 80000;
    const val = base + acrescimo;
    const detalhe = `3+ Armas Alto Calibre (${alto}x) — GRANDE QUANTIDADE: ${fmt(val)} €`;
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
  // Bens de assalto a casa — estes itens contam todos como
  // "Bens de assalto a casa" (coima unitária definida em data.ts).
  "perfume": "Bens de assalto a casa",
  "phone 7": "Bens de assalto a casa",
  "phone7": "Bens de assalto a casa",
  "tv led 75": "Bens de assalto a casa",
  "tv led": "Bens de assalto a casa",
  "computador": "Bens de assalto a casa",
  "pack vinhos": "Bens de assalto a casa",
  "pack de vinhos": "Bens de assalto a casa",
  "ouro estatal": "Bens de assalto a casa",
  "arma de colecao": "Bens de assalto a casa",
  "arma de coleção": "Bens de assalto a casa",
  "tigre": "Bens de assalto a casa",
  "tigres": "Bens de assalto a casa",
  "quadro": "Bens de assalto a casa",
  "documento": "Bens de assalto a casa",
  "documentos": "Bens de assalto a casa",
  "relogio ouro": "Relógio Ouro",
  "relógio ouro": "Relógio Ouro",
  "relogio de ouro": "Relógio Ouro",
  "relógio de ouro": "Relógio Ouro",
  "pulseira ouro": "Pulseira Ouro",
  "pulseira de ouro": "Pulseira Ouro",
  "aguia de bronze": "Bens de assalto a casa",
  "águia de bronze": "Bens de assalto a casa",
  "crypto pen": "Bens de assalto a casa",
  "cripto pen": "Bens de assalto a casa",
  "barra de ouro": "Bens de assalto a casa",
  "barra ouro": "Bens de assalto a casa",
  "coroa": "Bens de assalto a casa",
  // Algemas
  "eletronicos": "Eletrónicos",
  "eletrónico": "Eletrónicos",
  "eletrónicos": "Eletrónicos",
  "knife": "knife",
  "branca": "porte de arma branca",
  "arma branca": "knife",
  "algemas": "Algemas",
  "algema": "Algemas",
  "handcuffs": "Algemas",
  "cuffs": "Algemas",
  // Lockpick
  "lockpick avancada": "Lockpick", "lockpick avançada": "Lockpick", "lock pick avancada": "Lockpick",
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
  // Joalharia — itens específicos não devem cair em Bens de assalto a casa
  "corrente": "Corrente de Ouro",
  "corrente de ouro": "Corrente de Ouro",
  "corrente 10k": "Corrente de Ouro 10k",
  "corrente de ouro 10k": "Corrente de Ouro 10k",
  "anel": "Anel de Diamante",
  "anel de diamante": "Anel de Diamante",
  // Diamante
  "diamante": "Diamante Bruto",
  "diamante bruto": "Diamante Bruto",
  "diamante raw": "Diamante Bruto",
  "diamantes": "Diamante Bruto",
  "diamond": "Diamante Bruto",
  "diamonds": "Diamante Bruto",
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
  "blueprint pistola": "Esquemas de armas",
  "blueprint smg": "Esquemas de armas",
  "blueprint rifle": "Esquemas de armas",
  "blueprints pistola": "Esquemas de armas",
  "blueprints smg": "Esquemas de armas",
  "blueprints rifle": "Esquemas de armas",
  "esquemas de armas": "Esquemas de armas",
  "schema": "Esquemas de armas",
  // Peças
  "pecas": "Peças Arma",
  "peças": "Peças Arma",
  "pecas arma": "Peças Arma",
  "peças arma": "Peças Arma",
  "peça": "Peças Arma",
  "peça avançada": "Peças Arma",
  "peca avancada": "Peças Arma",
  "peça básica": "Peças Arma",
  "peca basica": "Peças Arma",
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
  "polimero": "Polímero",
  "polímero": "Polímero",
  "polymer": "Polímero",
  "bronze": "Bronze",
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
  "caranguejo": "Caranguejo",
  "caranguejos": "Caranguejo",
  "crab": "Caranguejo",
  "crabs": "Caranguejo",
  "flores": "Flores",
  "flores silvestres": "Flores",
  "flower": "Flores",
  "flowers": "Flores",
  // Assalto a casa — itens novos com coima própria (3000 €, igual a
  // "Bens de assalto a casa", mas aparecem com o nome do item na linha)
  "prototipo sniper": "Protótipo Sniper",
  "prototipo de sniper": "Protótipo Sniper",
  "sniper prototipo": "Protótipo Sniper",
  "mala gruppe6": "Mala Gruppe6",
  "mala gruppe 6": "Mala Gruppe6",
  "mala gruppi6": "Mala Gruppe6",
  "gruppe6": "Mala Gruppe6",
  "monitor": "Monitor",
  "monitores": "Monitor",
  "monitor lcd": "Monitor",
  "patentes": "Patentes",
  "patente": "Patentes",
  "whisky vintage": "Whisky Vintage",
  "whisky": "Whisky Vintage",
  "joias": "Joias",
  "joia": "Joias",
  "mala diamantes": "Mala Diamantes",
  "mala de diamantes": "Mala Diamantes",
  "caixa eletronicos": "Caixa Eletrónicos",
  "caixa de eletronicos": "Caixa Eletrónicos",
  "caixa eletrónicos": "Caixa Eletrónicos",
  "caixa tabaco": "Caixa Tabaco",
  "caixa de tabaco": "Caixa Tabaco",
  "caixa contrabando": "Caixa Contrabando",
  "caixa de contrabando": "Caixa Contrabando",
  // Crafting / outros
  "nylon": "Nylon",
  "petroleo": "Petróleo",
  "petróleo": "Petróleo",
  "oil": "Petróleo",
  "barril petroleo": "Barril Petróleo",
  "barril de petroleo": "Barril Petróleo",
  "barril de petróleo": "Barril Petróleo",
  "nitrato de potassio": "Nitrato de Potássio",
  "nitrato de potássio": "Nitrato de Potássio",
  "nitrato": "Nitrato de Potássio",
  "potassio": "Nitrato de Potássio",
  "potássio": "Nitrato de Potássio",
  "furadora avancada": "Furadora Avançada",
  "furadora avançada": "Furadora Avançada",
  // Flashlight
  "flashlight": "Flashlight",
  "flash light": "Flashlight",
  "lanterna": "Flashlight",
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
  "semente tabaco": "Semente de Tabaco",
  "mining drill": "Mining Drill",
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

  // "Folha de tabaco" é um artigo do inventário, não uma droga/coima.
  // É importante bloquear ANTES dos matches parciais, porque o termo
  // "tabaco" poderia ser associado incorretamente a "Maço tabaco".
  if (/^folha(?:\s+de)?\s+tabaco$/.test(normalized)) {
    return null;
  }
  
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
  materiaPrima: {
    resultados: string[];
    total: number;
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
export function parseQuickInput(input: string, opts?: { posseMunicao?: boolean }): ParseResult {
  const posseMunicao = opts?.posseMunicao ?? false;
  const result: ParseResult = {
    drogas: { resultados: [], subtotal: 0 },
    itens: { resultados: [], subtotal: 0 },
    municao: { resultados: [], base: 0, total: 0 },
    armas: { resultados: [], total: 0, meses: 0 },
    dinheiro: { resultados: [], total: 0 },
    sequestro: { resultados: [], total: 0 },
    crimes: { resultados: [], totalMulta: 0, totalMeses: 0 },
    materiaPrima: { resultados: [], total: 0 },
    totalGeral: 0,
    erros: [],
  };

  // Aceita vírgulas E linhas novas como separadores (colar OCR multi-linha)
  const partes = input.split(/[,\n\r]+/).map((p) => p.trim()).filter(Boolean);

  // OCR: acumular armas por calibre para aplicar o limite de grande quantidade
  // depois de ler TODAS as linhas. Isto não altera a aba/função de Grande Quantidade.
  let ocrArmasBaixo = 0;
  let ocrArmasMedio = 0;
  let ocrArmasAlto = 0;

  for (const parte of partes) {
    // Aceita "45 macos", "1x relogio ouro" e "1 x relogio ouro"
    const match = parte.match(/^(\d+)(?:\s*x\s+|\s+)(.+)$/i);
    if (!match) {
      result.erros.push(`Formato inválido: '${parte}'`);
      continue;
    }

    const qtd = parseInt(match[1]);
    const nome = normalizeText(match[2]);
    const originalNome = match[2].trim();

    // OCR formato especial: "51438 (0.5)" ou "51438 (0,5 kg)" -> quantidade + peso entre parênteses
    // Se o "nome" for só um peso entre parênteses e a quantidade > 10000, trata como dinheiro
    const pesoParenteses = originalNome.match(/^\(\s*[\d.,]+\s*kg?\s*\)$/i);
    if (pesoParenteses && qtd > 10000) {
      const multa = qtd * 0.75;
      result.dinheiro.resultados.push(`  Dinheiro não Declarado : ${fmt(qtd)} € x 75% = ${fmt(multa)} €`);
      result.dinheiro.total += multa;
      continue;
    }

    // ITENS DO CATÁLOGO QUE NÃO TÊM COIMA RÁPIDA:
    // Têm de ser filtrados ANTES de obterDrogaPorSinonimo/obterItemPorSinonimo.
    // Essas funções fazem correspondências parciais (ex.: "saco"), o que
    // fazia "saco plastico" ser interpretado como "Saco de Cannabis".
    // O catálogo de pesos é a fonte de verdade: se o item existe e é legal,
    // é reconhecido mas nunca pode entrar nas Coimas Rápidas.
    // EXCEÇÃO: "dinheiro" tem illegal: false no catálogo mas PRECISA ser processado
    // para a coima de dinheiro não declarado (75% acima de 10.000€).
    const itemCatalogoInicial = ITEM_BY_NAME.get(nome);
    if (itemCatalogoInicial && !itemCatalogoInicial.illegal && nome !== "dinheiro") {
      continue;
    }

    // Folha de tabaco é artigo/inventário e nunca entra nas coimas.
    // Não deixar o fallback parcial de "tabaco" convertê-la em "Maço tabaco".
    if (/^folha(?:\s+de)?\s+tabaco$/.test(nome)) {
      continue;
    }

    // Documento legal "cidadão" (não tem coima rápida) — não confundir com
    // "cartão de cidadão" nem com drogas.
    if (nome === "cidadao") {
      continue;
    }

    // Ruído de OCR: horas/tempos ("17:23") e números soltos que não são itens.
    if (/^\d{1,2}:\d{2}$/.test(originalNome) || /^\d+([.,]\d+)?$/.test(originalNome)) {
      continue;
    }

    // Mais ruído/truncamento de OCR (não são itens nem coimas rápidas):
    // - nomes vazios ou só pontuação/símbolos ("/", ":", "-")
    // - nomes terminados em ":" (ex.: "peso:")
    // - a palavra "peso" (a barra de peso "Peso: 53.70/120.00")
    // - fragmentos truncados terminados em "de" (ex.: "carta de")
    if (!nome || /^[\W_]+$/.test(nome)) {
      continue;
    }
    if (/:$/.test(originalNome.trim()) || /\bpeso\b/i.test(nome) || /^carta\s+de$/i.test(nome)) {
      continue;
    }

    // Verificar dinheiro ANTES do catálogo (dinheiro tem illegal: false no catálogo)
    if (nome.includes("dinheiro") || nome.includes("cash") || nome.includes("money")) {
      if (qtd > 10000) {
        const multa = qtd * 0.75;
        result.dinheiro.resultados.push(`  Dinheiro não Declarado : ${fmt(qtd)} € x 75% = ${fmt(multa)} €`);
        result.dinheiro.total += multa;
      }
      continue;
    }

    // Verificar armas (classes genéricas produzidas pelo parser do OCR, ex.:
    // "arma alto calibre"). Isto tem de correr ANTES da pesquisa de itens
    // (obterItemPorSinonimo), porque essa pesquisa faz correspondência
    // parcial por palavra e "arma alto calibre" batia por engano com
    // "Peças Arma" (ambos contêm a palavra "arma"), fazendo desaparecer a
    // coima de posse de arma (80 000€ no caso do alto calibre) do resumo.
    let tipoArma: string | null = null;
    let caliberArma: string | null = null;

    if (/\barma\s+baixo\s+calibre\b/.test(nome)) {
      tipoArma = "baixo";
      caliberArma = "";
    } else if (/\barma\s+medio\s+calibre\b/.test(nome)) {
      tipoArma = "medio";
      caliberArma = "";
    } else if (/\barma\s+alto\s+calibre\b/.test(nome)) {
      tipoArma = "alto";
      caliberArma = "";
    }

    if (tipoArma) {
      let precoBase = 0;
      if (tipoArma === "baixo") precoBase = 20000;
      else if (tipoArma === "medio") precoBase = 30000;
      else precoBase = 80000;

      const subtotal = qtd * precoBase;
      if (tipoArma === "baixo") ocrArmasBaixo += qtd;
      else if (tipoArma === "medio") ocrArmasMedio += qtd;
      else ocrArmasAlto += qtd;
      result.armas.resultados.push(`  ${qtd}x Arma ${tipoArma} calibre  x ${fmt(precoBase)} = ${fmt(subtotal)}`);
      result.armas.total += subtotal;
      continue;
    }

    // Verificar drogas
    // Itens "CAIXA ..." (assalto a casa) nunca são drogas — o fallback
    // parcial de "tabaco" converteria "caixa tabaco" em "Maço tabaco".
    const droga = nome.startsWith("caixa ") ? null : obterDrogaPorSinonimo(originalNome);
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

    // Verificar armas por modelo específico (ex.: "rifle", "ak", "gusenberg")
    // — caso o texto não use a classe genérica acima.
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
      result.armas.resultados.push(`  ${qtd}x Arma ${tipoArma} calibre  x ${fmt(precoBase)} = ${fmt(subtotal)}`);
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
      let tipoCarregador = "";
      if (tipoMun === "baixo" || nome.includes("baixo")) {
        precoUnit = 2000;
        tipoCarregador = "baixo calibre";
      } else if (tipoMun === "medio" || nome.includes("medio")) {
        precoUnit = 4000;
        tipoCarregador = "medio calibre";
      } else if (tipoMun === "alto" || nome.includes("alto")) {
        precoUnit = 6000;
        tipoCarregador = "alto calibre";
      } else {
        precoUnit = 2000; // Default
      }

      const subtotal = qtd * precoUnit;
      const label = tipoCarregador ? `Carregador ${tipoCarregador}` : "Carregador";
      result.municao.resultados.push(`  ${qtd}x ${label} x ${fmt(precoUnit)} = ${fmt(subtotal)}`);
      result.municao.total += subtotal;
      continue;
    }

    // Verificar dinheiro
    if (nome.includes("dinheiro") || nome.includes("cash") || nome.includes("money")) {
      if (qtd > 10000) {
        const multa = qtd * 0.75;
        result.dinheiro.resultados.push(`  Dinheiro não Declarado : ${fmt(qtd)} € x 75% = ${fmt(multa)} €`);
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

    // Se o item existe no catálogo de pesos, já é um item conhecido.
    // Itens legais são apenas reconhecidos para pesos/OCR e NUNCA entram
    // nas Coimas Rápidas. Itens ilegais sem preço de coima também não
    // devem aparecer como "Não reconhecido" — ficam reconhecidos no OCR
    // e aguardam uma regra/preço específico de coima.
    const itemCatalogo = ITEM_BY_NAME.get(nome);
    if (itemCatalogo) {
      continue;
    }

    result.erros.push(`Não reconhecido: '${originalNome}'`);
  }

  // Matéria-prima para fins ilegais:
  // 500+ folhas de tabaco ativam uma única coima de 30.000€.
  // A folha de tabaco continua reconhecida no inventário, mas não é uma droga
  // nem um item ilegal por unidade. A regra é baseada exclusivamente na quantidade.
  const folhaTabacoQtd = Object.entries(
    partes.reduce<Record<string, number>>((acc, parte) => {
      const m = parte.match(/^(\d+)\s+(.+)$/);
      if (!m) return acc;
      const nomeParte = normalizeText(m[2]);
      if (nomeParte === "folha tabaco" || nomeParte === "folha de tabaco") {
        acc["folha tabaco"] = (acc["folha tabaco"] || 0) + parseInt(m[1], 10);
      }
      return acc;
    }, {})
  ).reduce((sum, [, qtd]) => sum + qtd, 0);

  if (folhaTabacoQtd >= 500) {
    const multaMateriaPrima = 30000;
    result.materiaPrima.resultados.push(
      `  Posse de Matéria Prima para Fins Ilegais x ${fmt(multaMateriaPrima)} = ${fmt(multaMateriaPrima)}`
    );
    result.materiaPrima.total = multaMateriaPrima;
  }

  // Coimas Rápidas / OCR: aplicar o limite por calibre.
  // As coimas rápidas mantêm as armas normais visíveis.
  // Só quando atingem o limite passam para Grande Quantidade.
  const baixoGrande = ocrArmasBaixo >= 5;
  const medioGrande = ocrArmasMedio >= 4;
  const altoGrande = ocrArmasAlto >= 3;

  if (baixoGrande || medioGrande || altoGrande) {
    const novosDetalhes: string[] = [];
    let novoTotal = 0;
    let novosMeses = 0;

    if (baixoGrande) {
      const valor = 150000 + (ocrArmasBaixo - 5) * 20000;
      novosDetalhes.push(`  5+ Armas Baixo Calibre (${ocrArmasBaixo}x) — GRANDE QUANTIDADE: ${fmt(valor)} €`);
      novoTotal += valor;
      novosMeses = Math.max(novosMeses, 15);
    } else if (ocrArmasBaixo > 0) {
      const valor = ocrArmasBaixo * 20000;
      novosDetalhes.push(`  ${ocrArmasBaixo}x Arma baixo calibre x 20000 = ${fmt(valor)}`);
      novoTotal += valor;
    }

    if (medioGrande) {
      const valor = 200000 + (ocrArmasMedio - 4) * 30000;
      novosDetalhes.push(`  4+ Armas Médio Calibre (${ocrArmasMedio}x) — GRANDE QUANTIDADE: ${fmt(valor)} €`);
      novoTotal += valor;
      novosMeses = Math.max(novosMeses, 20);
    } else if (ocrArmasMedio > 0) {
      const valor = ocrArmasMedio * 30000;
      novosDetalhes.push(`  ${ocrArmasMedio}x Arma medio calibre x 30000 = ${fmt(valor)}`);
      novoTotal += valor;
    }

    if (altoGrande) {
      const valor = 250000 + (ocrArmasAlto - 3) * 80000;
      novosDetalhes.push(`  3+ Armas Alto Calibre (${ocrArmasAlto}x) — GRANDE QUANTIDADE: ${fmt(valor)} €`);
      novoTotal += valor;
      novosMeses = Math.max(novosMeses, 25);
    } else if (ocrArmasAlto > 0) {
      const valor = ocrArmasAlto * 80000;
      novosDetalhes.push(`  ${ocrArmasAlto}x Arma alto calibre x 80000 = ${fmt(valor)}`);
      novoTotal += valor;
    }

    result.armas.resultados = novosDetalhes;
    result.armas.total = novoTotal;
    result.armas.meses = novosMeses;
  }

  // Coima base de "Posse de Munição" (crimes graves: 10.000 € + 6 meses):
  // aplicada apenas nas Coimas Rápidas (opts.posseMunicao) quando o OCR/input
  // detetou munição. O OCR dos Relatórios NÃO a inclui. A base não vira linha —
  // vai no campo municao.base para o cabeçalho "--- MUNIÇÃO (base X €) ---".
  if (posseMunicao && result.municao.resultados.length > 0) {
    const crimePosse = CRIMES_CATALOGO.find((c) => c.nome === "Posse de Munição");
    const baseMun = crimePosse?.multa ?? 10000;
    result.municao.base = baseMun;
    result.municao.total += baseMun;
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
    result.crimes.totalMulta +
    result.materiaPrima.total;

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
