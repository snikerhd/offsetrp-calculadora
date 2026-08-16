// ══════════════════════════════════════════════════════════════════════════════
// ITEM WEIGHT CATALOG — Offset RP
// ══════════════════════════════════════════════════════════════════════════════
// Every item known to the inventory with its unit weight in kg and category.
export interface ItemDef {
  name: string;
  displayName: string;
  unitKg: number;
  category:
    | "droga"
    | "arma"
    | "municao"
    | "acessorio"
    | "equipamento"
    | "roubo"
    | "crafting"
    | "outro";
  illegal: boolean;
}

export const ITEM_CATALOG: ItemDef[] = [
  // ── Drogas ──
  { name: "cristal", displayName: "Cristal", unitKg: 0.1, category: "droga", illegal: true },
  { name: "cristal processado", displayName: "Cristal Processado", unitKg: 0.3, category: "droga", illegal: true },
  { name: "estimulante", displayName: "Estimulante", unitKg: 0.2, category: "droga", illegal: true },
  { name: "semente erva", displayName: "Semente de Erva", unitKg: 0.1, category: "droga", illegal: true },
  { name: "semente tabaco", displayName: "Semente de Tabaco", unitKg: 0.1, category: "droga", illegal: true },
  { name: "cabeco erva", displayName: "Cabeço de Erva", unitKg: 0.2, category: "droga", illegal: true },
  { name: "saco erva", displayName: "Saco de Erva", unitKg: 0.3, category: "droga", illegal: true },
  { name: "oleo medicinal", displayName: "Óleo Medicinal", unitKg: 0.2, category: "droga", illegal: true },
  { name: "charros", displayName: "Charros", unitKg: 0, category: "droga", illegal: true },
  { name: "folha tabaco", displayName: "Folha de Tabaco", unitKg: 0.2, category: "droga", illegal: true },
  { name: "maço", displayName: "Maço de Tabaco", unitKg: 0.3, category: "droga", illegal: true },
  { name: "pacote dealer", displayName: "Pacote Dealer", unitKg: 0.1, category: "droga", illegal: true },

  // ── Armas ──
  { name: "arma branca ilegal", displayName: "Arma Branca Ilegal", unitKg: 1, category: "arma", illegal: true },
  { name: "arma branca", displayName: "Arma Branca (Legal c/ Porte)", unitKg: 1, category: "arma", illegal: false },
  { name: "arma baixo calibre", displayName: "Arma Baixo Calibre", unitKg: 5, category: "arma", illegal: true },
  { name: "arma medio calibre", displayName: "Arma Médio Calibre", unitKg: 5, category: "arma", illegal: true },
  { name: "arma alto calibre", displayName: "Arma Alto Calibre", unitKg: 15, category: "arma", illegal: true },

  // ── Munição ──
  { name: "carregador baixo calibre", displayName: "Carregador Baixo Calibre", unitKg: 0.2, category: "municao", illegal: true },
  { name: "carregador medio calibre", displayName: "Carregador Médio Calibre", unitKg: 0.2, category: "municao", illegal: true },
  { name: "carregador alto calibre", displayName: "Carregador Alto Calibre", unitKg: 0.2, category: "municao", illegal: true },
  { name: "balas baixo", displayName: "Balas Baixo Calibre", unitKg: 0, category: "municao", illegal: true },
  { name: "balas medio", displayName: "Balas Médio Calibre", unitKg: 0, category: "municao", illegal: true },
  { name: "balas alto", displayName: "Balas Alto Calibre", unitKg: 0, category: "municao", illegal: true },

  // ── Acessórios ──
  { name: "acessorios para armas", displayName: "Acessórios para Armas", unitKg: 0.1, category: "acessorio", illegal: true },

  // ── Equipamento ──
  { name: "colete", displayName: "Colete", unitKg: 1, category: "equipamento", illegal: true },
  { name: "colete fortalecido", displayName: "Colete Fortalecido", unitKg: 1, category: "equipamento", illegal: true },
  { name: "medickits", displayName: "Medikit", unitKg: 1, category: "equipamento", illegal: false },
  { name: "lockpick", displayName: "Lockpick", unitKg: 0.5, category: "equipamento", illegal: true },
  { name: "lockpick avancada", displayName: "Lockpick Avançada", unitKg: 0.5, category: "equipamento", illegal: true },
  { name: "algemas", displayName: "Algemas", unitKg: 0.1, category: "equipamento", illegal: true },
  { name: "rebarbadora", displayName: "Rebarbadora", unitKg: 1, category: "equipamento", illegal: true },
  { name: "mining drill", displayName: "Mining Drill", unitKg: 0.2, category: "equipamento", illegal: false },
  { name: "pager", displayName: "Pager", unitKg: 0.1, category: "equipamento", illegal: true },
  { name: "garrafa de nitro", displayName: "Garrafa de Nitro", unitKg: 1, category: "equipamento", illegal: true },
  { name: "bomba", displayName: "Bomba", unitKg: 0.3, category: "equipamento", illegal: true },
  { name: "c4", displayName: "C4", unitKg: 1, category: "equipamento", illegal: true },
  { name: "mesa quimica", displayName: "Mesa Química", unitKg: 5, category: "equipamento", illegal: true },

  // ── Roubo / Assalto ──
  { name: "diamante bruto", displayName: "Diamante Bruto", unitKg: 0.1, category: "roubo", illegal: true },
  { name: "diamante", displayName: "Diamante", unitKg: 0.1, category: "roubo", illegal: true },
  { name: "safiras", displayName: "Safiras", unitKg: 0.1, category: "roubo", illegal: true },
  { name: "barras ouro", displayName: "Barras de Ouro", unitKg: 1, category: "roubo", illegal: true },
  { name: "pepitas", displayName: "Pepitas", unitKg: 0.1, category: "roubo", illegal: true },
  { name: "ouro estatal", displayName: "Ouro Estatal", unitKg: 1.5, category: "roubo", illegal: true },
  { name: "quadro", displayName: "Quadro", unitKg: 0.2, category: "roubo", illegal: true },
  { name: "pulseira ouro", displayName: "Pulseira de Ouro", unitKg: 0.2, category: "roubo", illegal: true },
  { name: "relogio ouro", displayName: "Relógio de Ouro", unitKg: 0.1, category: "roubo", illegal: true },
  { name: "corrente", displayName: "Corrente de Ouro", unitKg: 0.1, category: "roubo", illegal: true },
  { name: "corrente 10k", displayName: "Corrente de Ouro 10K", unitKg: 0.15, category: "roubo", illegal: true },
  { name: "anel", displayName: "Anel de Diamante", unitKg: 0.1, category: "roubo", illegal: true },
  { name: "perfume", displayName: "Perfume", unitKg: 0.2, category: "roubo", illegal: true },
  { name: "phone 7", displayName: "Phone 7", unitKg: 0.2, category: "roubo", illegal: true },
  { name: "tv led 75", displayName: "TV LED 75\"", unitKg: 1, category: "roubo", illegal: true },
  { name: "computador", displayName: "Computador", unitKg: 0.5, category: "roubo", illegal: true },
  { name: "pack vinhos", displayName: "Pack Vinhos", unitKg: 0.2, category: "roubo", illegal: true },
  { name: "arma de colecao", displayName: "Arma de Coleção", unitKg: 1, category: "roubo", illegal: true },
  { name: "tigre", displayName: "Tigre", unitKg: 0.5, category: "roubo", illegal: true },
  { name: "documentos", displayName: "Documentos", unitKg: 0.1, category: "roubo", illegal: true },
  { name: "aguia de bronze", displayName: "Águia de Bronze", unitKg: 2, category: "roubo", illegal: true },
  { name: "crypto pen", displayName: "Crypto Pen", unitKg: 0.1, category: "roubo", illegal: true },
  { name: "coroa", displayName: "Coroa", unitKg: 0.3, category: "roubo", illegal: true },
  { name: "pack safira", displayName: "Pack Safira", unitKg: 0.5, category: "roubo", illegal: true },
  { name: "idolo", displayName: "Ídolo", unitKg: 0.3, category: "roubo", illegal: true },
  { name: "adaga", displayName: "Adaga", unitKg: 0.3, category: "roubo", illegal: true },

  // ── Pesca ──
  { name: "orca", displayName: "Orca", unitKg: 10, category: "roubo", illegal: true },
  { name: "tubarao martelo", displayName: "Tubarão Martelo", unitKg: 1, category: "roubo", illegal: true },
  { name: "tubarao branco", displayName: "Tubarão Branco", unitKg: 1, category: "roubo", illegal: true },
  { name: "raia", displayName: "Raia", unitKg: 0.3, category: "roubo", illegal: true },
  { name: "polvo", displayName: "Polvo", unitKg: 0.3, category: "roubo", illegal: true },
  { name: "truta", displayName: "Truta", unitKg: 0.2, category: "outro", illegal: false },
  { name: "salmao", displayName: "Salmão", unitKg: 0.3, category: "outro", illegal: false },
  { name: "atum", displayName: "Atum", unitKg: 0.4, category: "outro", illegal: false },
  { name: "sardinha", displayName: "Sardinha", unitKg: 0.1, category: "outro", illegal: false },
  { name: "cana de pesca", displayName: "Cana de Pesca", unitKg: 0.5, category: "outro", illegal: false },
  { name: "licenca pesca", displayName: "Licença de Pesca", unitKg: 0.1, category: "outro", illegal: false },

  // ── Pirataria ──
  { name: "bau", displayName: "Baú de Especiaria", unitKg: 0.3, category: "roubo", illegal: true },
  { name: "diario", displayName: "Diário de Bordo", unitKg: 0.3, category: "roubo", illegal: true },
  { name: "pacote ilegal", displayName: "Pacote Ilegal", unitKg: 0.3, category: "roubo", illegal: true },
  { name: "chifres", displayName: "Chifres", unitKg: 0.2, category: "roubo", illegal: true },

  // ── Crafting ──
  { name: "polvora", displayName: "Pólvora", unitKg: 0.15, category: "crafting", illegal: true },
  { name: "esquemas", displayName: "Esquemas de Armas", unitKg: 0.1, category: "crafting", illegal: true },
  { name: "pecas", displayName: "Peças de Arma", unitKg: 0.1, category: "crafting", illegal: true },
  { name: "peca basica", displayName: "Peça Básica", unitKg: 0.1, category: "crafting", illegal: true },
  { name: "peca avancada", displayName: "Peça Avançada", unitKg: 0.1, category: "crafting", illegal: true },
  { name: "blueprint pistola", displayName: "Blueprint Pistola", unitKg: 0.1, category: "crafting", illegal: true },
  { name: "blueprint smg", displayName: "Blueprint SMG", unitKg: 0.1, category: "crafting", illegal: true },
  { name: "blueprint rifle", displayName: "Blueprint Rifle", unitKg: 0.1, category: "crafting", illegal: true },
  { name: "enxofre", displayName: "Enxofre", unitKg: 0.4, category: "crafting", illegal: true },
  { name: "estanho", displayName: "Estanho", unitKg: 0.1, category: "crafting", illegal: true },
  { name: "niquel", displayName: "Níquel", unitKg: 0.5, category: "crafting", illegal: true },
  { name: "minerios", displayName: "Minérios", unitKg: 0.5, category: "crafting", illegal: true },
  { name: "aluminio", displayName: "Alumínio", unitKg: 0.1, category: "crafting", illegal: false },
  { name: "borracha", displayName: "Borracha", unitKg: 0.1, category: "crafting", illegal: false },
  { name: "kit reparacao", displayName: "Kit Reparação", unitKg: 2, category: "crafting", illegal: false },

  // ── Outros ──
  { name: "dinheiro", displayName: "Dinheiro", unitKg: 0.00001, category: "outro", illegal: false },
  { name: "saco plastico", displayName: "Saco Plástico", unitKg: 0.1, category: "outro", illegal: false },
  { name: "nitro", displayName: "Nitro", unitKg: 1, category: "outro", illegal: true },
  { name: "bandagem", displayName: "Bandagem", unitKg: 0.1, category: "outro", illegal: false },
  { name: "sumo", displayName: "Sumo", unitKg: 0.2, category: "outro", illegal: false },
  { name: "sumo maracuja", displayName: "Sumo Maracujá", unitKg: 0.2, category: "outro", illegal: false },
  { name: "sumo laranja", displayName: "Sumo Laranja", unitKg: 0.2, category: "outro", illegal: false },
  { name: "sumo ananas", displayName: "Sumo Ananás", unitKg: 0.2, category: "outro", illegal: false },
  { name: "bifana", displayName: "Bifana", unitKg: 0.2, category: "outro", illegal: false },
  { name: "agua", displayName: "Água", unitKg: 0.5, category: "outro", illegal: false },
  { name: "medwchi mochi", displayName: "Medwchi Mochi", unitKg: 0.2, category: "outro", illegal: false },
  { name: "monoshu", displayName: "Monoshu", unitKg: 0.2, category: "outro", illegal: false },
  { name: "saco do ginasio", displayName: "Saco do Ginásio", unitKg: 1.5, category: "outro", illegal: false },
  { name: "hammer", displayName: "Hammer", unitKg: 1, category: "outro", illegal: false },
  { name: "casca de banana", displayName: "Casca de Banana", unitKg: 0.1, category: "outro", illegal: false },
  { name: "cartao", displayName: "Cartão", unitKg: 0.1, category: "outro", illegal: false },
  { name: "encomenda", displayName: "Encomenda", unitKg: 0.2, category: "outro", illegal: false },
  { name: "nobel tudo", displayName: "Nobel Tudo", unitKg: 0.2, category: "outro", illegal: false },
  { name: "radio", displayName: "Rádio", unitKg: 1, category: "outro", illegal: false },
  { name: "telemovel", displayName: "Telemóvel", unitKg: 0.7, category: "outro", illegal: false },
  { name: "petrol can", displayName: "Petrol Can", unitKg: 1, category: "outro", illegal: false },
  { name: "tuna deluxe", displayName: "Tuna Deluxe", unitKg: 0.2, category: "outro", illegal: false },
  { name: "tesoura", displayName: "Tesoura", unitKg: 0.3, category: "outro", illegal: false },
  { name: "pedaco de metal", displayName: "Pedaço de Metal", unitKg: 0.1, category: "outro", illegal: false },
  { name: "eletronicos", displayName: "Eletrónicos", unitKg: 0.5, category: "outro", illegal: false },
  { name: "minhoca", displayName: "Minhoca", unitKg: 0.1, category: "outro", illegal: false },
  { name: "knife", displayName: "Faca (Knife)", unitKg: 0.2, category: "arma", illegal: false },
  { name: "fotografia", displayName: "Fotografia", unitKg: 0, category: "outro", illegal: false },
  { name: "cartao de cidadao", displayName: "Cartão de Cidadão", unitKg: 0, category: "outro", illegal: false },
  { name: "carta de conducao", displayName: "Carta de Condução", unitKg: 0, category: "outro", illegal: false },
  { name: "caneta", displayName: "Caneta", unitKg: 0.1, category: "outro", illegal: false },
  { name: "passaporte", displayName: "Passaporte", unitKg: 0.1, category: "outro", illegal: false },
  { name: "porte de arma branca", displayName: "Porte de Arma Branca", unitKg: 0, category: "outro", illegal: false },
  { name: "branca", displayName: "Porte de Arma Branca", unitKg: 0, category: "outro", illegal: false },
];

// Quick lookup by canonical name
export const ITEM_BY_NAME = new Map<string, ItemDef>();
for (const item of ITEM_CATALOG) {
  ITEM_BY_NAME.set(item.name, item);
}

// Category display names & colors
export const CATEGORY_INFO: Record<string, { label: string; color: string; bg: string }> = {
  droga: { label: "Drogas", color: "text-purple-400", bg: "bg-purple-500/20" },
  arma: { label: "Armas", color: "text-red-400", bg: "bg-red-500/20" },
  municao: { label: "Munição", color: "text-orange-400", bg: "bg-orange-500/20" },
  acessorio: { label: "Acessórios", color: "text-yellow-400", bg: "bg-yellow-500/20" },
  equipamento: { label: "Equipamento", color: "text-blue-400", bg: "bg-blue-500/20" },
  roubo: { label: "Roubo / Assalto", color: "text-emerald-400", bg: "bg-emerald-500/20" },
  crafting: { label: "Crafting", color: "text-cyan-400", bg: "bg-cyan-500/20" },
  outro: { label: "Outros", color: "text-gray-400", bg: "bg-gray-500/20" },
};
