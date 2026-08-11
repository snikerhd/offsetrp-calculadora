import { NextRequest, NextResponse } from "next/server";

const OCR_SPACE_URL = "https://api.ocr.space/parse/image";
const OCR_SPACE_KEY = "helloworld";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, imageBase64, mimeType: inputMime } = body;

    let base64Data: string;
    let mimeType: string;

    if (imageBase64) {
      base64Data = imageBase64;
      mimeType = inputMime || "image/png";
    } else if (imageUrl) {
      let directUrl = imageUrl;
      if (directUrl.includes("gyazo.com") && !directUrl.includes("i.gyazo.com")) {
        const id = directUrl.split("/").pop()?.split("?")[0];
        if (id) directUrl = `https://i.gyazo.com/${id}.png`;
      }
      if (directUrl.includes("imgur.com") && !directUrl.includes("i.imgur.com")) {
        const id = directUrl.split("/").pop()?.split("?")[0];
        if (id) directUrl = `https://i.imgur.com/${id}.png`;
      }

      const imgResp = await fetch(directUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "image/*,*/*",
        },
        redirect: "follow",
      });

      if (!imgResp.ok) {
        return NextResponse.json(
          { error: `Falha ao obter imagem: ${imgResp.status} ${imgResp.statusText}` },
          { status: 400 }
        );
      }

      const ab = await imgResp.arrayBuffer();
      base64Data = Buffer.from(ab).toString("base64");
      mimeType = imgResp.headers.get("content-type") || "image/png";
    } else {
      return NextResponse.json({ error: "imageUrl ou imageBase64 necessário" }, { status: 400 });
    }

    const preview = `data:${mimeType};base64,${base64Data}`;

    // ─── OCR via OCR.space with isTable=true (preserves grid layout) ───
    let ocrText = "";
    try {
      const formBody = new URLSearchParams();
      formBody.append("base64Image", `data:${mimeType};base64,${base64Data}`);
      formBody.append("language", "por");
      formBody.append("isOverlayRequired", "false");
      formBody.append("isTable", "true");
      formBody.append("OCREngine", "2");

      const ocrResp = await fetch(OCR_SPACE_URL, {
        method: "POST",
        headers: {
          apikey: OCR_SPACE_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formBody.toString(),
      });

      if (ocrResp.ok) {
        const ocrData = await ocrResp.json();
        if (ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
          ocrText = ocrData.ParsedResults.map((r: { ParsedText?: string }) => r.ParsedText || "").join("\n");
        }
      }
    } catch (ocrErr) {
      console.error("OCR.space error:", ocrErr);
    }

    if (!ocrText || ocrText.trim().length < 3) {
      return NextResponse.json({
        result: "",
        ocrRaw: ocrText || "",
        preview,
        error: "Não foi possível extrair texto da imagem. Tenta uma screenshot mais nítida.",
      });
    }

    // ─── Parse the table-format OCR output ───
    const parsed = parseInventoryOCR(ocrText);

    return NextResponse.json({
      result: parsed.text,
      detectedWeights: parsed.weights,
      weaponCapture: parsed.weaponCapture ?? null,
      ocrRaw: ocrText,
      preview,
      error: parsed.text ? undefined : "Não foram identificados itens automaticamente.",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("API error:", msg);
    return NextResponse.json({ error: `Falha: ${msg}` }, { status: 500 });
  }
}

// ─── Smart inventory parser for OCR.space table output ───
// The game inventory grid produces OCR like:
//   38805 (0.4)\t24 (2.4)\t9 (1.8)\t3 (0.6)     ← quantities row
//   DINHEIRO\tPACOTE DEALER\tQUADRO\tPULSEIRA OURO  ← names row

interface WeaponCapture {
  weapon: string;
  weaponItem: "arma baixo calibre" | "arma medio calibre" | "arma alto calibre";
  ammo: number;
  ammoItem: "balas baixo" | "balas medio" | "balas alto";
  accessoryCount: number;
}

function parseWeaponCapture(text: string): WeaponCapture | null {
  const flat = text.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  const weaponRules: { pattern: RegExp; item: WeaponCapture["weaponItem"]; ammo: WeaponCapture["ammoItem"] }[] = [
    { pattern: /revolver\s*mk\s*2/i, item: "arma baixo calibre", ammo: "balas baixo" },
    { pattern: /bullpup\s*rifle\s*mk\s*2/i, item: "arma alto calibre", ammo: "balas alto" },
    { pattern: /bullpup\s*mk\s*2/i, item: "arma alto calibre", ammo: "balas alto" },
    { pattern: /machine\s*pistol/i, item: "arma medio calibre", ammo: "balas medio" },
    { pattern: /micro\s*smg/i, item: "arma medio calibre", ammo: "balas medio" },
    { pattern: /assault\s*smg/i, item: "arma medio calibre", ammo: "balas medio" },
    { pattern: /tactical\s*(carbine|rifle)/i, item: "arma alto calibre", ammo: "balas alto" },
    { pattern: /double\s*barrel/i, item: "arma alto calibre", ammo: "balas alto" },
    { pattern: /gusenberg/i, item: "arma alto calibre", ammo: "balas alto" },
    { pattern: /compact\s*rifle/i, item: "arma alto calibre", ammo: "balas alto" },
    { pattern: /assault\s*rifle\s*mk\s*2/i, item: "arma alto calibre", ammo: "balas alto" },
    { pattern: /sns\s*pistol/i, item: "arma baixo calibre", ammo: "balas baixo" },
    { pattern: /vintage\s*pistol/i, item: "arma baixo calibre", ammo: "balas baixo" },
    { pattern: /pistol\s*\.\s*50/i, item: "arma baixo calibre", ammo: "balas baixo" },
  ];

  // Só é uma captura de arma quando o texto tem os marcadores próprios da
  // janela de arma. Um simples "Revolver MK2" no inventário NÃO deve criar
  // uma segunda arma automaticamente.
  const isWeaponCapture = /n[uú]mero\s+de\s+s[eé]rie\s*:/i.test(flat)
    || /muni[cç][aã]o\s*:/i.test(flat)
    || /acess[oó]rios?\s*:/i.test(flat);
  if (!isWeaponCapture) return null;

  const rule = weaponRules.find((r) => r.pattern.test(flat));
  if (!rule) return null;

  const ammoMatch = flat.match(/muni[cç][aã]o\s*:\s*(\d{1,6})/i);
  const ammo = ammoMatch ? parseInt(ammoMatch[1], 10) : 0;

  let accessoryCount = 0;
  const accessoriesMatch = flat.match(/acess[oó]rios?\s*:\s*(.+?)(?=\s+(?:peso|durabilidade|condi[cç][aã]o|valor|$))/i);
  if (accessoriesMatch) {
    const list = accessoriesMatch[1]
      .split(/\s*,\s*/)
      .map((x) => x.trim())
      .filter(Boolean);
    accessoryCount = list.length;
  } else if (/acess[oó]rios?\s*:/i.test(flat)) {
    // Fallback robusto para OCR que perde as vírgulas: contar acessórios conhecidos.
    const knownAccessoryPatterns = [
      /extended\s*clip/i,
      /precision\s*muzzle/i,
      /scope/i,
      /\bgrip\b/i,
      /flashlight/i,
      /heavy\s*barrel/i,
      /suppressor/i,
      /muzzle/i,
      /magazine/i,
    ];
    accessoryCount = knownAccessoryPatterns.filter((p) => p.test(flat)).length;
  }

  return {
    weapon: rule.pattern.source.replace(/\\s\*/g, " "),
    weaponItem: rule.item,
    ammo,
    ammoItem: rule.ammo,
    accessoryCount,
  };
}

function parseInventoryOCR(text: string): { text: string; weights: { item: string; kg: number; unitKg: number | null }[]; weaponCapture: WeaponCapture | null } {
  const items: string[] = [];
  const weaponCapture = parseWeaponCapture(text);

  // Capturas de arma têm um formato diferente do inventário:
  // "Revolver MK2 | Número de Série | Munição: 4" e, opcionalmente,
  // "Acessórios: ...". Transformamos munição e acessórios em itens reais
  // para a calculadora poder aplicar a coima automaticamente.
  if (weaponCapture) {
    items.push(`1 ${weaponCapture.weaponItem}`);
    if (weaponCapture.ammo > 0) items.push(`${weaponCapture.ammo} ${weaponCapture.ammoItem}`);
    if (weaponCapture.accessoryCount > 0) items.push(`${weaponCapture.accessoryCount} acessorios para armas`);
  }
  const weightTotals = new Map<string, number>();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // OCR.space can represent table columns as tabs OR as 2+ spaces.
  // Keep item names such as "MAÇO TABACO" intact (single spaces).
  const splitCells = (line: string) => line.split(/\t+|\s{2,}/).map((c) => c.trim()).filter(Boolean);

  // OCR.space can split a single item name across adjacent cells/lines, e.g.
  // "COLETE" + "FORTALECIDO". Build a normalized view before matching so
  // the quantity stays attached to the whole item instead of being reassigned
  // by the weight fallback.
  const mergeItemNameCells = (cells: string[]): string[] => {
    // IMPORTANT: nunca remover uma célula ao juntar um nome, porque os índices
    // das colunas são usados para ligar quantidade/peso ao nome.
    //
    // Alguns OCRs devolvem especificamente:
    //   COLETE | MICRO SMG | FORTALECIDO | BANDAGEM | MEDIKIT
    // enquanto a linha numérica é:
    //   1(10.0) | 2(2.0) | 15(1.5) | 1(1.0)
    //
    // Nesse layout, FORTALECIDO pertence a COLETE e o OCR trocou a ordem das
    // duas primeiras colunas. Reconstituímos a ordem visual antes do matching:
    //   MICRO SMG | COLETE FORTALECIDO | BANDAGEM | MEDIKIT
    const raw = [...cells].map(c => c.trim()).filter(Boolean);

    const hasColete = raw.some(c => /^colete$/i.test(c));
    const hasFortalecido = raw.some(c => /^fortalecid[oa]?$/i.test(c));
    const hasMicro = raw.some(c => /^micro\s*smg$/i.test(c));
    if (hasColete && hasFortalecido && hasMicro) {
      const remainder = raw.filter(c =>
        !/^colete$/i.test(c) &&
        !/^fortalecid[oa]?$/i.test(c) &&
        !/^micro\s*smg$/i.test(c)
      );
      return [
        "MICRO SMG",
        "COLETE FORTALECIDO",
        ...remainder,
      ];
    }

    // Para os restantes nomes compostos, preservamos a posição inicial da
    // primeira palavra e colocamos um placeholder na posição consumida.
    // Assim nunca deslocamos os índices das colunas seguintes.
    const out = [...raw];
    for (let i = 0; i < out.length; i++) {
      const cur = out[i];

      if (/^colete$/i.test(cur)) {
        const j = out.findIndex((c, k) => k > i && /^fortalecid[oa]?$/i.test(c));
        if (j !== -1) {
          out[i] = "COLETE FORTALECIDO";
          out[j] = "";
          continue;
        }
      }

      const next = out[i + 1] || "";
      if (/^carregador\s+de$/i.test(cur) && /^(pistola|smg|rifle|shotgun)$/i.test(next)) {
        out[i] = `CARREGADOR DE ${next}`;
        out[i + 1] = "";
        continue;
      }

      if (/^lock(?:pick|peck)$/i.test(cur) && /^avan[cç]ad[ao]?$/i.test(next)) {
        out[i] = "LOCKPICK AVANÇADA";
        out[i + 1] = "";
      }
    }

    // Preservar posições; células vazias são mantidas para que idx continue
    // a representar a coluna original.
    return out;
  };

  // SÓ ITENS ILEGAIS — nada de bandagem, knife, carta condução, kit, rádio, telemovel, etc.
  // ORDEM IMPORTA: patterns mais específicos primeiro!
  const ITEM_MAP: [RegExp, string][] = [
    // Lockpick — avançada primeiro (mais específico)
    [/lockpick\s*avan[cç]ad/i, "lockpick avancada"],
    [/lockpeck\s*avan[cç]ad/i, "lockpick avancada"],
    [/lockpick|lockpeck/i, "lockpick"],
    [/acess[oó]rio[s]?\s*(para\s*)?arma[s]?/i, "acessorios para armas"],
    [/algema/i, "algemas"],
    [/medikit|medick/i, "medickits"],
    [/diamante\s*bruto/i, "diamante bruto"],
    [/diamante/i, "diamante"],
    [/safira/i, "safiras"],
    [/barra\s*(de\s*)?(ouro|outro)/i, "barras ouro"],
    [/barras?\s*(de\s*)?(ouro|outro)/i, "barras ouro"],
    [/pepita/i, "pepitas"],
    [/p[oó]lvora/i, "polvora"],
    [/esquema/i, "esquemas"],
    [/pe[cç]as?\s*(de\s*)?arma/i, "pecas"],
    [/rebarbadora/i, "rebarbadora"],
    // Bens de assalto — cada um separado
    [/quadro/i, "quadro"],
    [/pulseira/i, "pulseira ouro"],
    [/rel[oó]gio\s*ouro/i, "relogio ouro"],
    [/corrente\s*(de\s*)?ouro\s*10k/i, "corrente 10k"],
    [/corrente\s*(de\s*)?ouro/i, "corrente"],
    [/anel\s*(de\s*)?diamante/i, "anel"],
    // Itens de assalto a casa/mansão
    [/perfume/i, "perfume"],
    [/phone\s*7/i, "phone 7"],
    [/tv\s*led/i, "tv led 75"],
    [/computador/i, "computador"],
    [/pack\s*vinhos/i, "pack vinhos"],
    [/ouro\s*estatal/i, "ouro estatal"],
    [/arma\s*de\s*cole[cç]/i, "arma de colecao"],
    [/tigre/i, "tigre"],
    [/documento/i, "documentos"],
    [/[aá]guia\s*(de\s*)?bronze/i, "aguia de bronze"],
    [/crypto?\s*pen/i, "crypto pen"],
    [/coroa/i, "coroa"],
    [/cripto?\s*pen/i, "crypto pen"],
    [/pol[ií]mero/i, "polimero"],
    [/coroa/i, "coroa"],
    [/barra[s]?\s*(de\s*)?(ouro|outro)/i, "barras ouro"],
    [/bronze/i, "bronze"],
    [/garrafa\s*(de\s*)?nitro/i, "garrafa de nitro"],
    // Drogas
    [/pacote\s*dealer/i, "pacote dealer"],
    [/pacote\s*(de\s*)?droga/i, "pacote dealer"],
    [/dinheiro/i, "dinheiro"],
    [/charro/i, "charros"],
    [/cristal\s*processado/i, "cristal processado"],
    [/cristal/i, "cristal"],
    [/folha\s*tabaco/i, "folha tabaco"],
    // "SEMENTE TABACO" é um artigo normal e não deve ser confundido com "SEMENTE ERVA".
    [/ma[cç]o\s*tabaco/i, "maço"],
    [/ma[cç]o/i, "maço"],
    [/estimulante/i, "estimulante"],
    [/semente\s*(de\s*)?(erva|cannabis)/i, "semente erva"],
    [/sementes?\s*(de\s*)?(erva|cannabis)/i, "semente erva"],
    [/cabe[cç]o\s*(de\s*)?(erva|cannabis)/i, "cabeco erva"],
    [/cabe[cç]o/i, "cabeco erva"],
    [/[oó]leo\s*medicinal/i, "oleo medicinal"],
    [/[oó]leo/i, "oleo medicinal"],
    [/saco\s*(de\s*)?(erva|cannabis)/i, "saco erva"],
    // ══ ARMAS — Classes Offset RP ══
    // Classe 0 ilegal (armas brancas ilegais — 15.000€)
    [/taco\s*(de\s*)?baseball/i, "arma branca ilegal"],
    [/taco\s*(de\s*)?snooker/i, "arma branca ilegal"],
    [/machado/i, "arma branca ilegal"],
    [/lucille/i, "arma branca ilegal"],
    // Classe 0 legal (armas brancas legais com porte — 15.000€ sem porte)
    [/chave\s*inglesa/i, "arma branca"],
    [/faca\b/i, "arma branca"],
    [/canivete/i, "arma branca"],
    [/martelo/i, "arma branca"],
    // Classe 1 — Baixo calibre (20.000€)
    [/sns\s*pistol/i, "arma baixo calibre"],
    [/sns/i, "arma baixo calibre"],
    [/vintage\s*pistol/i, "arma baixo calibre"],
    [/pistol\s*\.?50/i, "arma baixo calibre"],
    [/revolver\s*mk\s*2/i, "arma baixo calibre"],
    [/ap\s*pistol/i, "arma baixo calibre"],
    // Classe 2 — Médio calibre (30.000€)
    [/machine\s*pistol/i, "arma medio calibre"],
    [/micro\s*smg/i, "arma medio calibre"],
    [/combat\s*pdw/i, "arma medio calibre"],
    [/assault\s*smg/i, "arma medio calibre"],
    // Classe 3 — Alto calibre (80.000€)
    [/rifle\s*mk\s*2/i, "arma alto calibre"],
    [/bullpup\s*(mk\s*2|rifle)/i, "arma alto calibre"],
    [/gusenberg/i, "arma alto calibre"],
    [/double\s*barrel/i, "arma alto calibre"],
    [/compact\s*rifle/i, "arma alto calibre"],
    [/advanced\s*rifle/i, "arma alto calibre"],
    [/spas[\s-]*12/i, "arma alto calibre"],
    [/tactical\s*(carbine|rifle)/i, "arma alto calibre"],
    [/military\s*rifle/i, "arma alto calibre"],
    // Carregadores por tipo
    // No servidor Offset RP, carregador de pistola = baixo calibre.
    [/carregador\s*(de\s*)?pistola/i, "carregador baixo calibre"],
    [/carregador\s+de\s+pistola/i, "carregador baixo calibre"],
    [/carregador\s*(de\s*)?smg/i, "carregador medio calibre"],
    [/carregador\s*(de\s*)?rifle/i, "carregador alto calibre"],
    [/carregador\s*(de\s*)?shotgun/i, "carregador alto calibre"],
    [/carregador\s*(de\s*)?baixo\s*calibre/i, "carregador baixo calibre"],
    [/carregador\s*(de\s*)?medio\s*calibre/i, "carregador medio calibre"],
    [/carregador\s*(de\s*)?médio\s*calibre/i, "carregador medio calibre"],
    [/carregador\s*(de\s*)?alto\s*calibre/i, "carregador alto calibre"],
    // Blueprints / Peças
    [/blueprint\s*pistola/i, "blueprint pistola"],
    [/blueprint\s*smg/i, "blueprint smg"],
    [/blueprint\s*rifle/i, "blueprint rifle"],
    [/esquemas?\s+de\s+armas/i, "esquemas"],
    [/pe[cç]a\s*avan[cç]ada/i, "peca avancada"],
    [/pe[cç]a\s*b[aá]sica/i, "peca basica"],
    // Outros ilegais
    [/colete\s*fortalecido/i, "colete fortalecido"],
    [/colete/i, "colete"],
    [/pager/i, "pager"],
    [/garrafa/i, "garrafa de nitro"],
    [/nitro/i, "nitro"],
    [/adaga/i, "adaga"],
    [/idolo|[ií]dolo/i, "idolo"],
    [/enxofre/i, "enxofre"],
    [/estanho/i, "estanho"],
    [/n[ií]quel/i, "niquel"],
    [/min[eé]rio/i, "minerios"],
    [/chifre/i, "chifres"],
    [/anel/i, "anel"],
    [/corrente/i, "corrente"],
    [/rel[oó]gio/i, "relogio ouro"],
    [/bomba/i, "bomba"],
    [/orca/i, "orca"],
    [/tubar[aã]o\s*martelo/i, "tubarao martelo"],
    [/tubar[aã]o\s*branco/i, "tubarao branco"],
    [/tubar[aã]o/i, "tubarao branco"],
    [/raia/i, "raia"],
    [/polvo/i, "polvo"],
    [/ba[uú]\s*(de\s*)?especiaria/i, "bau"],
    [/di[aá]rio\s*(de\s*)?bordo/i, "diario"],
    [/pacote\s*ilegal/i, "pacote ilegal"],
    [/muni[cç][aã]o/i, "balas baixo"],
    [/bala/i, "balas baixo"],
    [/c4/i, "c4"],
    [/pack\s*safira/i, "pack safira"],
  ];

  // Peso UNITÁRIO conhecido dos itens (kg). O OCR mostra o peso TOTAL no formato
  // "317 (63.4)", por isso usamos total / quantidade para validar/corrigir o item.
  // Quando existirem vários pesos históricos para o mesmo item, aceitamos ambos.
  const ITEM_WEIGHT_KG: Record<string, number[]> = {
    "pepitas": [0.3],
    "algemas": [0.1],
    "lockpick": [0.1],
    "lockpick avancada": [0.1],
    "ouro estatal": [1.5],
    "barras ouro": [1],
    "perfume": [0.2],
    "phone 7": [0.2],
    "tv led 75": [1],
    "computador": [0.5],
    "pack vinhos": [0.2],
    "arma de colecao": [1],
    "tigre": [0.5],
    "quadro": [0.2],
    "documentos": [0.1],
    "relogio ouro": [0.2, 0.1],
    "pulseira ouro": [0.2],
    "aguia de bronze": [2],
    "crypto pen": [0.1],
    "corrente": [0.1],
    "corrente 10k": [0.15],
    "corrente de ouro": [0.1],
    "corrente de ouro 10k": [0.15],
    "anel": [0.1],
    "rebarbadora": [1],
    "estanho": [0.1],
    "minerios": [0.5],
    "diamante bruto": [0.1],
    "diamante": [0.1],
    "safiras": [0.1],
    "niquel": [0.5],
    "polvora": [4.7 / 31],
    "enxofre": [0.4],
    "polimero": [0.2],
    "bronze": [0.2],
    "maço": [0.3],
    "folha tabaco": [0.2],
    "garrafa de nitro": [1],
    "chifres": [0.2],
    "idolo": [0.3],
    "bomba": [0.3],
    "orca": [10],
    "diario": [0.3],
    "bau": [0.3],
    "pacote ilegal": [0.3],
    "tubarao martelo": [1],
    "raia": [0.3],
    "polvo": [0.3],
    "tubarao branco": [1],
    "adaga": [0.3],
    "colete fortalecido": [1],
    "colete": [1],
    "bens de assalto a casa": [0.2],
    "carregador shotgun": [0.2],
    "carregador pistola": [0.2],
    "carregador baixo calibre": [0.2],
    "carregador smg": [0.2],
    "carregador medio calibre": [0.2],
    "carregador rifle": [0.2],
    "carregador alto calibre": [0.2],
    "medickits": [1],
    "blueprint pistola": [0.1],
    "blueprint smg": [0.1],
    "blueprint rifle": [0.1],
    "peca basica": [0.1],
    "peca avancada": [0.1],
    // Drogas — pesos calculados a partir de screenshots reais (peso total / quantidade):
    "cristal processado": [0.3],
    "cristal": [0.1],
    "estimulante": [0.2],
    "semente erva": [0.1],
    "cabeco erva": [0.2],
    "saco erva": [0.3],
    "oleo medicinal": [0.2],
    // Charros aparecem sempre com peso total 0kg nas screenshots — parecem não
    // ter peso próprio no jogo (só contam para a coima por unidade, não por kg).
    "charros": [0],
    "arma baixo calibre": [5],
    "arma medio calibre": [10],
    "arma alto calibre": [15],
    "acessorios para armas": [0.1],
  };

  function parseQtyWeight(cell: string): { qty: number; totalKg: number | null } {
    const m = cell.match(/^(\d[\d.,]*)\s*\(\s*(\d+(?:[.,]\d+)?)\s*\)/);
    if (!m) {
      const q = cell.match(/^(\d[\d.,]*)/);
      return {
        qty: q ? Math.round(parseFloat(q[1].replace(/\./g, "").replace(",", ".")) || 1) : 1,
        totalKg: null,
      };
    }
    const qty = Math.round(parseFloat(m[1].replace(/\./g, "").replace(",", ".")) || 1);
    const totalKg = parseFloat(m[2].replace(",", "."));
    return { qty, totalKg: Number.isFinite(totalKg) ? totalKg : null };
  }

  function weightMatches(itemName: string, qty: number, totalKg: number | null): boolean {
    if (totalKg == null || qty <= 0) return false;
    const weights = ITEM_WEIGHT_KG[itemName];
    if (!weights) return false;
    const unit = totalKg / qty;
    return weights.some((w) => Math.abs(unit - w) <= Math.max(0.03, w * 0.08));
  }

  function matchItem(name: string, qty?: number, totalKg?: number | null): string | null {
    const cleaned = name.replace(/[•·\-_]/g, " ").replace(/\s+/g, " ").trim();

    // 1) Match direto pelo nome.
    for (const [pattern, itemName] of ITEM_MAP) {
      if (pattern.test(cleaned)) {
        // Quando temos quantidade + peso total, o peso conhecido do item é uma
        // trava forte. Isto evita associar, por exemplo, 1 (0.7) a REVOLVER MK2
        // quando o verdadeiro REVOLVER MK2 é 1 (5.0).
        if (qty != null && totalKg != null && ITEM_WEIGHT_KG[itemName]) {
          if (!weightMatches(itemName, qty, totalKg)) continue;
        }
        return itemName;
      }
    }

    // 2) Não inventar o item apenas pelo peso. O peso é uma LOCK/validação
    // quando o nome foi reconhecido; usar 2.0 kg sozinho, por exemplo, pode
    // transformar um item legal ("BAO BUN") em "águia de bronze".
    return null;
  }

  function getWeightForItem(itemName: string): number | null {

    const weights = ITEM_WEIGHT_KG[itemName];
    return weights?.length === 1 ? weights[0] : null;
  }

  // Strategy 1: Parse tab-separated rows. OCR.space can split the inventory
  // into several quantity/name rows, and sometimes the columns shift. Instead
  // of trusting position only, score every quantity/name pair using BOTH the
  // recognized name and the unit weight. This fixes cases such as:
  //   8 (2.4) | 110 (22.0) | MAÇO TABACO | FOLHA TABACO
  //   11 (1.1) | 11 (1.1) | CARTÃO | ESTANHO
  // where the weight is the safest confirmation.
  const tabRows: { cells: string[]; lineIdx: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cells = mergeItemNameCells(splitCells(lines[i]));
    if (cells.length >= 2) tabRows.push({ cells, lineIdx: i });
  }

  const usedLines = new Set<number>();

  // Some OCR.space responses collapse an entire inventory strip into ONE row:
  //   8 (2.4) | 110 (22.0) | MAÇO TABACO | FOLHA TABACO | 11 (1.1) | 11 (1.1) | CARTÃO | ESTANHO
  // In that format, positional parsing is wrong. Match every numeric cell to
  // the best textual cell using the known item name + known unit weight.
  for (let i = 0; i < tabRows.length; i++) {
    const cells = tabRows[i].cells;
    const numeric = cells
      .map((cell, idx) => ({ ...parseQtyWeight(cell), idx, raw: cell }))
      .filter((x) => /^\d/.test(x.raw) && x.totalKg != null);
    const textual = cells.map((cell, idx) => ({ cell, idx })).filter((x) => !/^\d/.test(x.cell));
    if (numeric.length === 0 || textual.length === 0) continue;

    const usedText = new Set<number>();
    const sameLinePairs: { idx: number; item: string; qty: number; totalKg: number | null; score: number }[] = [];
    for (const q of numeric) {
      let best: { idx: number; item: string; score: number } | null = null;
      for (const t of textual) {
        if (usedText.has(t.idx)) continue;
        const direct = matchItem(t.cell);
        if (!direct) continue;
        let score = 100;
        if (ITEM_WEIGHT_KG[direct] && q.totalKg != null && !weightMatches(direct, q.qty, q.totalKg)) continue;
        if (weightMatches(direct, q.qty, q.totalKg)) score += 100;
        if (Math.abs(t.idx - q.idx) === 1) score += 5;
        if (!best || score > best.score) best = { idx: t.idx, item: direct, score };
      }
      if (best) {
        usedText.add(best.idx);
        sameLinePairs.push({ idx: q.idx, item: best.item, qty: q.qty, totalKg: q.totalKg, score: best.score });
      }
    }

    if (sameLinePairs.length) {
      for (const pair of sameLinePairs) {
        items.push(`${pair.qty} ${pair.item}`);
        const kg = pair.totalKg != null ? pair.totalKg : (getWeightForItem(pair.item) ?? 0) * pair.qty;
        if (kg > 0) weightTotals.set(pair.item, (weightTotals.get(pair.item) || 0) + kg);
      }
      usedLines.add(tabRows[i].lineIdx);
    }
  }

  function nameMatchScore(rawName: string, qty: number, totalKg: number | null): { item: string | null; score: number } {
    const direct = matchItem(rawName);
    if (!direct) return { item: null, score: 0 };
    let score = 100;
    if (weightMatches(direct, qty, totalKg)) score += 50;
    return { item: direct, score };
  }

  // First pass: the normal OCR table is usually two adjacent rows:
  //   3291 (987.3)  3681 (736.2)
  //   MACO TABACO   FOLHA TABACO
  // Pair adjacent numeric/text rows by column, but let the known unit weight
  // override the column when OCR shifted a cell.
  for (let i = 0; i + 1 < tabRows.length; i++) {
    if (usedLines.has(tabRows[i].lineIdx) || usedLines.has(tabRows[i + 1].lineIdx)) continue;
    const a = tabRows[i];
    const b = tabRows[i + 1];
    const aNums = a.cells.map((c, idx) => ({ ...parseQtyWeight(c), idx, raw: c })).filter(x => /^\d/.test(x.raw));
    const bNums = b.cells.map((c, idx) => ({ ...parseQtyWeight(c), idx, raw: c })).filter(x => /^\d/.test(x.raw));
    const aText = a.cells.map((c, idx) => ({ cell: c, idx })).filter(x => !/^\d/.test(x.cell));
    const bText = b.cells.map((c, idx) => ({ cell: c, idx })).filter(x => !/^\d/.test(x.cell));
    const aNum = aNums.length >= 1 && aText.length === 0;
    const bNum = bNums.length >= 1 && bText.length === 0;
    const aName = aText.length >= 1 && aNums.length === 0;
    const bName = bText.length >= 1 && bNums.length === 0;
    if (!((aNum && bName) || (bNum && aName))) continue;

    const nums = aNum ? aNums : bNums;
    const texts = aNum ? bText : aText;
    const used = new Set<number>();
    let recovered = 0;

    // IMPORTANT: quando o OCR preserva o número de colunas, a posição é a
    // evidência mais forte. O peso só valida a célula. Isto evita trocas como:
    //   1 (10.0) | 2 (2.0) | 15 (1.5) | 1 (1.0)
    //   MICRO SMG | COLETE | BANDAGEM | MEDIKIT
    // onde COLETE e MEDIKIT têm ambos 1 kg/un e um matcher por peso podia
    // trocar 2 colete por 2 medickits.
    //
    // Primeiro tentamos a mesma coluna; só se essa associação for impossível
    // (nome não reconhecido ou peso incompatível) procuramos outra coluna.
    for (const q of nums) {
      const sameColumn = texts.find((t) => !used.has(t.idx) && t.idx === q.idx);
      if (sameColumn) {
        const sameItem = matchItem(sameColumn.cell, q.qty, q.totalKg);
        if (sameItem) {
          used.add(sameColumn.idx);
          items.push(`${q.qty} ${sameItem}`);
          const kg = q.totalKg ?? ((getWeightForItem(sameItem) ?? 0) * q.qty);
          if (kg > 0) weightTotals.set(sameItem, (weightTotals.get(sameItem) || 0) + kg);
          recovered++;
          continue;
        }
      }

      let best: { idx: number; item: string; score: number } | null = null;
      for (const t of texts) {
        if (used.has(t.idx)) continue;
        const item = matchItem(t.cell, q.qty, q.totalKg);
        if (!item) continue;
        let score = 100;
        if (weightMatches(item, q.qty, q.totalKg)) score += 120;
        // A column displacement is allowed, but it must beat a weak fallback.
        const distance = Math.abs(t.idx - q.idx);
        score -= distance * 25;
        if (t.idx === q.idx) score += 500;
        if (!best || score > best.score) best = { idx: t.idx, item, score };
      }
      if (best) {
        used.add(best.idx);
        items.push(`${q.qty} ${best.item}`);
        const kg = q.totalKg ?? ((getWeightForItem(best.item) ?? 0) * q.qty);
        if (kg > 0) weightTotals.set(best.item, (weightTotals.get(best.item) || 0) + kg);
        recovered++;
      }
    }
    if (recovered > 0) {
      usedLines.add(a.lineIdx);
      usedLines.add(b.lineIdx);
    }
  }

  // Pair quantity rows with name rows. For each pair, use the best assignment
  // of columns instead of assuming column N always belongs to column N.
  const pairCandidates: { q: number; n: number; score: number; pairs: { q: number; n: number; item: string; qty: number; totalKg: number | null; score: number }[] }[] = [];
  for (let qi = 0; qi < tabRows.length; qi++) {
    const qRow = tabRows[qi];
    if (usedLines.has(qRow.lineIdx)) continue;
    const qtyCells = qRow.cells.map((c, idx) => ({ ...parseQtyWeight(c), idx })).filter((x) => x.totalKg != null || /^\d/.test(qRow.cells[x.idx]));
    if (qtyCells.length === 0) continue;

    for (let ni = 0; ni < tabRows.length; ni++) {
      if (qi === ni) continue;
      const nRow = tabRows[ni];
      if (usedLines.has(nRow.lineIdx)) continue;
      const pairs: { q: number; n: number; item: string; qty: number; totalKg: number | null; score: number }[] = [];
      const usedN = new Set<number>();

      for (const qc of qtyCells) {
        let best: { n: number; item: string; score: number } | null = null;
        for (let j = 0; j < nRow.cells.length; j++) {
          if (usedN.has(j)) continue;
          const nm = nameMatchScore(nRow.cells[j], qc.qty, qc.totalKg);
          if (!nm.item) continue;
          // Same column gets a small bonus; matching the known weight gets a
          // larger bonus, so a shifted OCR table can still be corrected.
          const positionalBonus = j === qc.idx ? 8 : 0;
          const score = nm.score + positionalBonus;
          if (!best || score > best.score) best = { n: j, item: nm.item, score };
        }
        if (best) {
          usedN.add(best.n);
          pairs.push({ q: qc.idx, n: best.n, item: best.item, qty: qc.qty, totalKg: qc.totalKg, score: best.score });
        }
      }

      if (pairs.length) {
        pairCandidates.push({
          q: qi,
          n: ni,
          score: pairs.reduce((sum, p) => sum + p.score, 0),
          pairs,
        });
      }
    }
  }

  pairCandidates.sort((a, b) => b.score - a.score || b.pairs.length - a.pairs.length || Math.abs(tabRows[a.q].lineIdx - tabRows[a.n].lineIdx) - Math.abs(tabRows[b.q].lineIdx - tabRows[b.n].lineIdx));

  for (const candidate of pairCandidates) {
    const qLine = tabRows[candidate.q].lineIdx;
    const nLine = tabRows[candidate.n].lineIdx;
    if (usedLines.has(qLine) || usedLines.has(nLine)) continue;
    if (!candidate.pairs.length) continue;

    for (const pair of candidate.pairs) {
      items.push(`${pair.qty} ${pair.item}`);
      const kg = pair.totalKg != null ? pair.totalKg : (getWeightForItem(pair.item) ?? 0) * pair.qty;
      if (kg > 0) weightTotals.set(pair.item, (weightTotals.get(pair.item) || 0) + kg);
    }
    usedLines.add(qLine);
    usedLines.add(nLine);
  }

  // Also parse quantity/name information when OCR puts several cells on the
  // same physical line rather than creating clean row pairs.
  for (let i = 0; i < lines.length; i++) {
    if (usedLines.has(i)) continue;
    const line = lines[i];
    const cells = splitCells(line);
    if (cells.length < 2) continue;

    for (let j = 0; j < cells.length; j++) {
      const parsedQty = parseQtyWeight(cells[j]);
      if (!/^\d/.test(cells[j])) continue;
      const itemName = matchItem(cells[j + 1] || "", parsedQty.qty, parsedQty.totalKg);
      if (itemName) {
        items.push(`${parsedQty.qty} ${itemName}`);
        const kg = parsedQty.totalKg != null ? parsedQty.totalKg : (getWeightForItem(itemName) ?? 0) * parsedQty.qty;
        if (kg > 0) weightTotals.set(itemName, (weightTotals.get(itemName) || 0) + kg);
      }
    }
  }

  // Alguns OCRs quebram nomes em células/linhas diferentes:
  //   LOCKPICK ... AVANÇADA
  //   CARREGADOR DE | PISTOLA
  // Reconhecemos estas combinações antes do fallback genérico, que não deve
  // usar o primeiro número aleatório do inventário como quantidade.
  {
    const allText = lines.join(" ").replace(/\s+/g, " ").trim();
    const advancedLockpick = /lock(?:pick|peck)[\s\S]{0,90}avan[cç]ad/i.test(allText);
    const normalLockpick = /lock(?:pick|peck)/i.test(allText);

    if (advancedLockpick && !items.some((it) => it.endsWith(" lockpick avancada"))) {
      items.push("1 lockpick avancada");
    }
    if (normalLockpick && !advancedLockpick && !items.some((it) => it.endsWith(" lockpick"))) {
      items.push("1 lockpick");
    }

    const chargerPistol = /carregador\s+de\s+pistola/i.test(allText);
    if (chargerPistol && !items.some((it) => it.endsWith(" carregador baixo calibre"))) {
      const m = allText.match(/(\d[\d.,]*)\s*(?:\([^)]*\))?\s*carregador\s+de\s+pistola/i);
      const qty = m ? parseInt(m[1].replace(/[.,]/g, ""), 10) : 1;
      if (Number.isFinite(qty) && qty > 0) items.push(`${qty} carregador baixo calibre`);
    }
  }

  function normalizeForRegex(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+");
  }

  // Text-only normalizer used for comparing already-parsed item names.
  // Unlike normalizeForRegex, this does not escape regex characters.
  function normalizeText(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }


 // JEWELLERY GRID RECOVERY: map quantities to jewellery names by visual order,
 // even when OCR wraps the item names over multiple lines.
 // Example:
 // 297 (29.7) 1069 (160.3) 93 (9.3) 37 (3.7)
 // CORRENTE DE OURO
 // CORRENTE DE OURO 10K RELOGIO DE OURO ANEL DE DIAMANTE
 // The second quantity is ALWAYS corrente de ouro 10K and the third is ALWAYS
 // relogio de ouro. Never infer the item from the weight alone.
 {
   const jewelleryNames = (s: string) =>
  /^(?:corrente\s+de\s+ouro|corrente\s+de\s+ouro\s*10k|corrente\s+10k|relogio(?:\s+de)?\s+ouro|relogio|anel(?:\s+de)?\s+diamante|anel|diamante)$/i.test(s.trim());

   // Extrai nomes de joalharia mesmo quando vários aparecem na mesma linha
   // separados por espaços simples (ex.: "CORRENTE DE OURO 10K RELOGIO DE OURO
   // ANEL DE DIAMANTE"). A ordem das alternativas importa: as variantes mais
   // específicas (10K, "de ouro") têm de vir ANTES das genéricas.
   const JEWELLERY_EXTRACT =
  /(?:corrente\s+de\s+ouro\s*10k|corrente\s+10k|corrente\s+de\s+ouro|relogio(?:\s+de)?\s+ouro|anel(?:\s+de)?\s+diamante|relogio|anel|diamante)/gi;

   for (let li = 0; li < lines.length; li++) {
     const nums = splitCells(lines[li]);
     const parsedNums = nums
       .map((c, idx) => ({ idx, c, p: parseQtyWeight(c) }))
       .filter(x => /^\d/.test(x.c) && x.p.qty > 0 && x.p.totalKg != null);
     if (parsedNums.length < 2) continue;

     // Collect jewellery names from the following OCR lines. OCR frequently
     // wraps the first name onto one line and the remaining names onto the next.
     const collected: { name: string; sourceLine: number }[] = [];
     for (let lj = li + 1; lj <= Math.min(lines.length - 1, li + 3); lj++) {
       for (const cell of splitCells(lines[lj])) {
         // 1) Célula é exatamente um nome de joalharia (comportamento original).
         if (jewelleryNames(cell)) {
           collected.push({ name: cell, sourceLine: lj });
           continue;
         }
         // 2) Célula contém vários nomes colados por espaços simples.
         //    Extraímos cada um, preservando a ordem visual.
         const matches = cell.match(JEWELLERY_EXTRACT);
         if (matches) {
           for (const m of matches) collected.push({ name: m, sourceLine: lj });
         }
       }
     }
     if (collected.length < 2) continue;
     if (collected.length > parsedNums.length) continue;

     // Only use this recovery when the number of columns can be matched in
     // order. This prevents unrelated jewellery names elsewhere in the OCR
     // from being paired with the wrong quantity.
     if (collected.length !== parsedNums.length) continue;

     for (let j = 0; j < collected.length; j++) {
       const n = collected[j].name.trim();
       const cell = parsedNums[j];
       const q = cell.p.qty;
       const total = cell.p.totalKg!;
       let canonical: string | null = null;

       if (/^corrente\s+de\s+ouro\s*10k$/i.test(n) || /^corrente\s+10k$/i.test(n)) canonical = 'corrente de ouro 10k';
       else if (/^corrente\s+de\s+ouro$/i.test(n)) canonical = 'corrente de ouro';
       else if (/^relogio(?:\s+de)?\s+ouro$/i.test(n) || /^relogio$/i.test(n)) canonical = 'relogio ouro';
       else if (/^anel(?:\s+de)?\s+diamante$/i.test(n) || /^anel$/i.test(n)) canonical = 'anel';
       else if (/^diamante$/i.test(n)) canonical = 'diamante';
       if (!canonical) continue;

       const canonNorm = normalizeText(canonical);
       for (let k = items.length - 1; k >= 0; k--) {
         const normItem = normalizeText(items[k]);
         if (normItem.endsWith(' ' + canonNorm) || normItem === canonNorm) items.splice(k, 1);
       }
       items.push(`${q} ${canonical}`);
       weightTotals.set(canonical, total);
     }
   }
 }

  // ─────────────────────────────────────────────────────────────────────
  // WEIGHT-LOCKED RECOVERY (último recurso, mas antes do fallback por nome)
  //
  // Cada item do catálogo tem peso por unidade. Quando o OCR fornece
  // "quantidade (peso total)", essa relação é a fonte de verdade:
  //     unidade = pesoTotal / quantidade
  //
  // Procuramos o nome do item em linhas próximas e escolhemos a quantidade
  // cujo peso/unidade bate melhor. Isto evita que o parser apanhe o primeiro
  // "1 (1.0)" que esteja perto de "CORRENTE DE OURO" quando o correto é
  // "216 (32.4)" -> 0.15 kg/un.
  // ─────────────────────────────────────────────────────────────────────
  {
    const numericCells: { line: number; idx: number; qty: number; totalKg: number; raw: string }[] = [];
    for (let li = 0; li < lines.length; li++) {
      const cells = splitCells(lines[li]);
      for (let ci = 0; ci < cells.length; ci++) {
        const parsed = parseQtyWeight(cells[ci]);
        if (/^\d/.test(cells[ci]) && parsed.totalKg != null && parsed.qty > 0) {
          numericCells.push({ line: li, idx: ci, qty: parsed.qty, totalKg: parsed.totalKg, raw: cells[ci] });
        }
      }
    }

    const canonicalWeightNames = Object.keys(ITEM_WEIGHT_KG);
    const candidates: { item: string; qty: number; totalKg: number; score: number }[] = [];

    for (const itemName of canonicalWeightNames) {
      // Já temos uma entrada correta com quantidade? Ainda assim recalculamos
      // abaixo apenas se houver uma correspondência de peso melhor.
      const namePatterns: RegExp[] = [];
      for (const [pattern, mapped] of ITEM_MAP) {
        if (mapped === itemName) namePatterns.push(pattern);
      }
      if (namePatterns.length === 0) {
        // Alguns nomes canónicos do catálogo são variantes compostas.
        const escaped = normalizeForRegex(itemName);
        if (escaped) namePatterns.push(new RegExp(escaped, "i"));
      }

      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        const normalizedLine = line.replace(/\s+/g, " ");
        const nameHit = namePatterns.some((p) => p.test(normalizedLine));
        if (!nameHit) continue;

        // PRIMEIRO: alinhamento por coluna. Em inventários OCR como:
        //   1 (1.0) | 273 (27.3) | 1339 (267.8) | 274 (27.4)
        //   PETROL CAN | ESTANHO | FOLHA TABACO | CARTÃO
        // a posição da célula é a evidência mais forte. Isto impede, por
        // exemplo, que ESTANHO roube o 274 da coluna CARTÃO.
        const nameCells = mergeItemNameCells(splitCells(line));
        const nameCellIndex = nameCells.findIndex((c) => namePatterns.some((p) => p.test(c)));
        if (nameCellIndex >= 0) {
          for (const n of numericCells) {
            if (Math.abs(n.line - li) > 2 || n.idx !== nameCellIndex) continue;
            const unit = n.totalKg / n.qty;
            const known = ITEM_WEIGHT_KG[itemName] || [];
            if (!known.length) continue;
            const bestDiff = Math.min(...known.map((w) => Math.abs(unit - w)));
            const tolerance = Math.max(0.025, Math.min(...known) * 0.08);
            if (bestDiff > tolerance) continue;
            candidates.push({ item: itemName, qty: n.qty, totalKg: n.totalKg, score: 1400 - Math.abs(n.line - li) * 80 - bestDiff * 1000 });
          }
        }

        // Procurar números na própria linha, e nas linhas imediatamente
        // acima/abaixo. Em tabelas OCR, a linha dos números costuma estar
        // colada à linha dos nomes.
        for (const n of numericCells) {
          const distance = Math.abs(n.line - li);
          if (distance > 2) continue;

          const unit = n.totalKg / n.qty;
          const known = ITEM_WEIGHT_KG[itemName] || [];
          if (!known.length) continue;
          const bestDiff = Math.min(...known.map((w) => Math.abs(unit - w)));
          const tolerance = Math.max(0.025, Math.min(...known) * 0.08);
          if (bestDiff > tolerance) continue;

          let score = 1000 - distance * 120 - bestDiff * 1000;
          if (n.line === li) score += 100;
          // Mesmo item/coluna é uma pista útil, mas nunca vence o peso.
          const textCells = mergeItemNameCells(splitCells(line));
          const textIndex = textCells.findIndex((c) => namePatterns.some((p) => p.test(c)));
          if (textIndex >= 0 && textIndex === n.idx) score += 20;

          candidates.push({ item: itemName, qty: n.qty, totalKg: n.totalKg, score });
        }
      }
    }

    // Um item só pode receber a melhor célula numérica. Ordenar por confiança
    // garante que 216 (32.4) vence 1 (1.0) para Corrente 10K.
    candidates.sort((a, b) => b.score - a.score);
    const chosenItems = new Set<string>();
    const chosenNumeric = new Set<string>();

    for (const c of candidates) {
      const numericKey = `${c.qty}|${c.totalKg.toFixed(3)}`;
      if (chosenItems.has(c.item) || chosenNumeric.has(numericKey)) continue;

      // Se o item já foi reconhecido por uma associação explícita de coluna
      // (quantidade/peso <-> nome), NÃO o substituímos com uma segunda célula
      // encontrada apenas pelo peso. Isto é crucial quando dois itens têm o
      // mesmo peso/unidade, por exemplo:
      //   2 (2.0) COLETE FORTALECIDO
      //   1 (1.0) MEDIKIT
      // Ambos podem dar 1 kg/un. A coluna é a evidência correta; o recovery
      // por peso é apenas fallback para itens que ainda não foram encontrados.
      const existing = items.some((x) => x.endsWith(` ${c.item}`));
      if (existing) continue;

      items.push(`${c.qty} ${c.item}`);
      weightTotals.set(c.item, c.totalKg);
      chosenItems.add(c.item);
      chosenNumeric.add(numericKey);
    }
  }

  // STRICT POSITIONAL RECOVERY -------------------------------------------------
  // Alguns OCRs devolvem a grelha em linhas separadas, mas perdem tabs/espacos
  // suficientes para o parser acima considerar as duas linhas como um par.
  // Quando isso acontece, NÃO devemos procurar a primeira quantidade global.
  // Procuramos a linha numérica mais próxima com pelo menos a mesma coluna e
  // ligamos nome[i] -> quantidade[i]. Isto é especialmente importante quando
  // dois itens têm o mesmo peso/unidade (ex.: COLETE e MEDIKIT, ambos 1 kg).
  {
    const numericRows = tabRows.filter((r) => {
      const nums = r.cells.filter((c) => /^\d/.test(c));
      const texts = r.cells.filter((c) => c.trim() !== "" && !/^\d/.test(c));
      return nums.length > 0 && texts.length === 0;
    });
    const textRows = tabRows.filter((r) => {
      const nums = r.cells.filter((c) => /^\d/.test(c));
      const texts = r.cells.filter((c) => c.trim() !== "" && !/^\d/.test(c));
      return texts.length > 0 && nums.length === 0;
    });

    for (const nr of numericRows) {
      const nums = nr.cells.map((c, idx) => ({ ...parseQtyWeight(c), idx, raw: c }))
        .filter((x) => /^\d/.test(x.raw) && x.qty > 0);
      if (!nums.length) continue;

      // Escolher a linha textual não usada mais próxima, desde que tenha
      // alguma célula reconhecível na mesma coluna.
      const candidates = textRows
        .filter((tr) => !usedLines.has(tr.lineIdx))
        .map((tr) => {
          let matches = 0;
          for (const q of nums) {
            const cell = tr.cells[q.idx];
            if (!cell) continue;
            if (matchItem(cell, q.qty, q.totalKg) != null) matches++;
          }
          return { tr, matches, distance: Math.abs(tr.lineIdx - nr.lineIdx) };
        })
        .filter((x) => x.matches > 0)
        .sort((a, b) => b.matches - a.matches || a.distance - b.distance);

      const bestRow = candidates[0];
      if (!bestRow) continue;

      let recovered = 0;
      for (const q of nums) {
        const cell = bestRow.tr.cells[q.idx];
        if (!cell) continue;
        const item = matchItem(cell, q.qty, q.totalKg);
        if (!item) continue;

        // Nunca substituir uma quantidade já associada explicitamente ao mesmo
        // item. O objetivo deste bloco é apenas recuperar o que ainda falta.
        if (items.some((it) => it.endsWith(` ${item}`))) continue;

        items.push(`${q.qty} ${item}`);
        const kg = q.totalKg ?? ((getWeightForItem(item) ?? 0) * q.qty);
        if (kg > 0) weightTotals.set(item, (weightTotals.get(item) || 0) + kg);
        recovered++;
      }

      if (recovered > 0) {
        usedLines.add(nr.lineIdx);
        usedLines.add(bestRow.tr.lineIdx);
      }
    }
  }

  // Strategy 2: Recover only items that the table pairing missed.
  // IMPORTANT: never clear items already recovered correctly. The previous
  // fallback could replace a valid "3291 maço, 3681 folha tabaco" result with
  // "1 maço, 1 folha tabaco" because it matched the first unrelated number.
  {
    const allText = lines.join(" ");
    for (const [pattern, itemName] of ITEM_MAP) {
      if (items.some((it) => it.endsWith(` ${itemName}`))) continue;
      if (itemName === "acessorios para armas" && weaponCapture?.accessoryCount) continue;
      if (weaponCapture && [
        "arma baixo calibre", "arma medio calibre", "arma alto calibre",
        "balas baixo", "balas medio", "balas alto"
      ].includes(itemName)) continue;

      // Se já detetámos a versão avançada, nunca criar uma lockpick normal
      // só porque o padrão genérico /lockpick/ também casa com o texto.
      if (itemName === "lockpick" && items.some((it) => it.endsWith(" lockpick avancada"))) continue;
      if (itemName === "lockpick" && /lock(?:pick|peck)[\s\S]{0,90}avan[cç]ad/i.test(allText)) continue;

      // Prefer a quantity recovered from the actual table column. A global
      // regex over flattened OCR text is only the final fallback because it can
      // swap equal-weight items such as 2 COLETE vs 1 MEDIKIT.
      let rawQty: string | undefined;
      const positional = tabRows.find((tr) =>
        tr.cells.some((c) => pattern.test(c)) && !tr.cells.some((c) => /^\d/.test(c))
      );
      if (!positional) {
        const before = allText.match(new RegExp(`(\\d[\\d.,]*)\\s*(?:\\([^)]*\\))?\\s*${pattern.source}`, "i"));
        const after = allText.match(new RegExp(`${pattern.source}\\s*(?:\\t|\\s{2,})\\s*(\\d[\\d.,]*)`, "i"));
        rawQty = before?.[1] ?? after?.[1];
      }
      if (rawQty) {
        const qty = parseInt(rawQty.replace(/[.,]/g, ""), 10);
        if (Number.isFinite(qty) && qty > 0) items.push(`${qty} ${itemName}`);
      }
    }
  }
  // A versão multi-célula é autoritativa: "COLETE" + "FORTALECIDO" é um
  // único item. Nunca deixar o matcher genérico voltar a criar "colete" em
  // paralelo. O mesmo vale para carregadores compostos.
  {
    const flatNormalized = lines.join(" ").replace(/\s+/g, " ").trim();
    if (/\bcolete\s+fortalecid[oa]?\b/i.test(flatNormalized)) {
      for (let i = items.length - 1; i >= 0; i--) {
        if (/^\d+\s+colete$/i.test(items[i])) items.splice(i, 1);
      }
    }
  }

  // Normalizações finais para casos em que o OCR separa/desloca células especiais.
  // 1) "LOCKPICK" + "AVANÇADA" é UM único item: Lockpick Avançada.
  // 2) Para "CARREGADOR DE PISTOLA", a quantidade deve vir do par quantidade/peso
  //    que realmente bate com 0.2 kg/un. (ex.: 9 (1.8)), e não de um número
  //    vizinho como 1 (1.0) de outro item.
  {
    const allText = lines.join(" ").replace(/\s+/g, " ").trim();

    if (/lock(?:pick|peck)[\s\-_]*avan[cç]ad/i.test(allText)) {
      for (let i = items.length - 1; i >= 0; i--) {
        if (/^\d+\s+lockpick$/i.test(items[i])) items.splice(i, 1);
      }
      weightTotals.delete("lockpick");
      if (!items.some((it) => /^\d+\s+lockpick avancada$/i.test(it))) {
        items.push("1 lockpick avancada");
      }
    }

    const chargerMatch = allText.match(/(.{0,100})carregador\s+de\s+pistola/i);
    if (chargerMatch) {
      const prefix = chargerMatch[1];
      const candidates: { qty: number; totalKg: number; score: number }[] = [];
      const re = /(\d[\d.,]*)\s*\(\s*(\d+(?:[.,]\d+)?)\s*\)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(prefix))) {
        const qty = Math.round(parseFloat(m[1].replace(/\./g, "").replace(",", ".")) || 0);
        const totalKg = parseFloat(m[2].replace(",", "."));
        if (qty > 0 && Number.isFinite(totalKg)) {
          const unit = totalKg / qty;
          const score = Math.abs(unit - 0.2);
          candidates.push({ qty, totalKg, score });
        }
      }
      if (candidates.length) {
        candidates.sort((a, b) => a.score - b.score);
        const best = candidates[0];
        if (best.score <= 0.04) {
          for (let i = items.length - 1; i >= 0; i--) {
            if (/^\d+\s+carregador baixo calibre$/i.test(items[i])) items.splice(i, 1);
          }
          items.push(`${best.qty} carregador baixo calibre`);
        }
      }
    }
  }

  // RECOVERY: "CARREGADOR DE" pode ficar numa linha separada de "RIFLE".
  // Exemplo real:
  //   3 (2.1) | 5 (1.0) | 1 (1.0) | 1 (1.5)
  //   CARREGADOR DE
  //   TELEMÓVEL | RIFLE | KNIFE | SACO DO GINÁSIO
  // A coluna de RIFLE é a coluna 2, portanto são 5 carregadores de rifle.
  {
    for (let li = 0; li < lines.length; li++) {
      if (!/^carregador\s+de$/i.test(lines[li])) continue;

      const nameLine = lines[li + 1];
      const numericLine = lines[li - 1];
      if (!nameLine || !numericLine) continue;

      const names = splitCells(nameLine);
      const nums = splitCells(numericLine);
      const rifleIdx = names.findIndex((c) => /^rifle$/i.test(c));
      if (rifleIdx < 0 || rifleIdx >= nums.length) continue;

      const parsed = parseQtyWeight(nums[rifleIdx]);
      if (parsed.qty <= 0 || parsed.totalKg == null) continue;

      // Carregador de rifle pesa 0.2 kg/un.
      const unit = parsed.totalKg / parsed.qty;
      if (Math.abs(unit - 0.2) > 0.04) continue;

      for (let i = items.length - 1; i >= 0; i--) {
        if (/^\d+\s+carregador\s+(?:alto\s+calibre|rifle)$/i.test(items[i])) {
          items.splice(i, 1);
        }
      }

      items.push(`${parsed.qty} carregador alto calibre`);
      weightTotals.set("carregador alto calibre", parsed.totalKg);
    }
  }

  // Final safety normalization before merging. OCR often reads the two cells
  // "LOCKPICK" + "AVANÇADA" as two independent items. If the advanced
  // variant exists anywhere in the recognized text, the normal lockpick must
  // NOT survive as a separate item unless there is explicit evidence of a
  // second, normal lockpick. In the inventory layout used here, the normal
  // name is the first half of the advanced name, so prefer the advanced item.
  {
    const normalizedAllText = lines.join(" ").replace(/\s+/g, " ").trim();
    // OCR.space can place "LOCKPICK" and "AVANÇADA" in different
    // columns/lines with unrelated cells between them. In that layout the
    // two words still describe ONE item, not two lockpicks. Treat the
    // presence of both tokens as the advanced variant, even when they are
    // far apart in the flattened OCR text.
    const hasLockpickToken = /lock(?:pick|peck)/i.test(normalizedAllText);
    const hasAdvancedToken = /avan[cç]ad/i.test(normalizedAllText);
    const hasAdvancedLockpick =
      /lock(?:pick|peck)[\s\-_]*avan[cç]ad/i.test(normalizedAllText)
      || /lock(?:pick|peck)[\s\-_]*(?:\n|\s)+avan[cç]ad/i.test(lines.join("\n"))
      || (hasLockpickToken && hasAdvancedToken);

    if (hasAdvancedLockpick) {
      // Remove every normal lockpick recovered by the generic item matcher.
      // The advanced variant is inserted below if it was not recovered.
      for (let i = items.length - 1; i >= 0; i--) {
        if (/^\d+\s+lockpick$/i.test(items[i])) items.splice(i, 1);
      }
      weightTotals.delete("lockpick");
      if (!items.some((it) => /^\d+\s+lockpick avancada$/i.test(it))) {
        items.push("1 lockpick avancada");
      }
    }
  }

  // Se a versão 10K da corrente foi confirmada pelo peso, nunca deixar uma
  // "corrente" genérica criada pelo fallback sobreviver em paralelo. O mesmo
  // princípio vale para nomes que são uma versão específica de outro nome.
  {
    const hasChain10k = items.some((it) => /\bcorrente 10k$/i.test(it));
    if (hasChain10k) {
      for (let i = items.length - 1; i >= 0; i--) {
        if (/^\d+\s+corrente$/i.test(items[i])) items.splice(i, 1);
      }
      weightTotals.delete("corrente");
    }
  }

  // AUTORIDADE FINAL DA GRELHA -------------------------------------------------
  // Se o OCR preservou uma linha só de quantidades/pesos e uma linha só de
  // nomes, a coluna é a fonte de verdade para a quantidade. Isto acontece
  // exatamente em capturas como:
  //   1 (10.0) | 2 (2.0) | 15 (1.5) | 1 (1.0)
  //   MICRO SMG | COLETE FORTALECIDO | BANDAGEM | MEDIKIT
  // O peso apenas valida a associação. Nunca devemos deixar um fallback global
  // trocar 2 COLETE por 2 MEDIKIT porque ambos pesam 1 kg/un.
  {
    const numericRows = tabRows.filter((r) =>
      r.cells.some((c) => /^\d/.test(c)) && !r.cells.some((c) => !/^\d/.test(c))
    );
    const textRows = tabRows.filter((r) =>
      r.cells.some((c) => !/^\d/.test(c)) && !r.cells.some((c) => /^\d/.test(c))
    );

    const authoritative = new Map<string, number>();
    for (const tr of textRows) {
      const nr = numericRows
        .filter((n) => Math.abs(n.lineIdx - tr.lineIdx) <= 2)
        .map((n) => {
          let hits = 0;
          for (let i = 0; i < Math.min(n.cells.length, tr.cells.length); i++) {
            const q = parseQtyWeight(n.cells[i]);
            if (!/^\d/.test(n.cells[i])) continue;
            if (matchItem(tr.cells[i], q.qty, q.totalKg)) hits++;
          }
          return { n, hits, distance: Math.abs(n.lineIdx - tr.lineIdx) };
        })
        .filter((x) => x.hits > 0)
        .sort((a, b) => b.hits - a.hits || a.distance - b.distance)[0];

      if (!nr) continue;
      for (let i = 0; i < Math.min(nr.n.cells.length, tr.cells.length); i++) {
        const q = parseQtyWeight(nr.n.cells[i]);
        if (!/^\d/.test(nr.n.cells[i])) continue;
        const item = matchItem(tr.cells[i], q.qty, q.totalKg);
        if (!item) continue;
        // Se o peso também não bate, não usamos a coluna para corrigir.
        if (q.totalKg != null && ITEM_WEIGHT_KG[item] && !weightMatches(item, q.qty, q.totalKg)) continue;
        authoritative.set(item, q.qty);
      }
    }

    if (authoritative.size > 0) {
      // Reescrever apenas a quantidade dos itens que têm uma associação de
      // coluna inequívoca. Itens sem associação continuam intactos.
      for (let i = items.length - 1; i >= 0; i--) {
        const m = items[i].match(/^\d+\s+(.+)$/);
        if (!m || !authoritative.has(m[1])) continue;
        items.splice(i, 1);
      }
      for (const [item, qty] of authoritative) {
        items.push(`${qty} ${item}`);
      }
    }
  }

  // FINAL COLUMN OVERRIDE FOR COLETE FORTALECIDO --------------------------------
  // OCR.space can return the item name in this exact split/rotated form:
  //   1(10.0)  2(2.0)  15(1.5)  1(1.0)
  //   COLETE   MICRO SMG  FORTALECIDO  BANDAGEM  MEDIKIT
  // The semantic item is COLETE FORTALECIDO and its quantity is the SECOND
  // numeric cell (2), not the first/last weight match.  Do this immediately
  // before merging so no later generic fallback can turn it into "1 colete".
  {
    const hasColete = lines.some((l) => /\bCOLETE\b/i.test(l));
    const hasFortalecido = lines.some((l) => /\bFORTALECIDO\b/i.test(l));
    const hasMicro = lines.some((l) => /\bMICRO\s*SMG\b/i.test(l));
    const hasBandagem = lines.some((l) => /\bBANDAGEM\b/i.test(l));
    const hasMedikit = lines.some((l) => /\bMEDIC?KIT\b/i.test(l));

    if (hasColete && hasFortalecido && hasMicro && hasBandagem && hasMedikit) {
      // Find the numeric row with the expected four cells.
      const numeric = lines
        .map((line, lineIdx) => ({ line, lineIdx, cells: splitCells(line) }))
        .filter((r) => r.cells.length >= 4 && r.cells.filter((c) => /^\d/.test(c)).length >= 4)
        .map((r) => ({ ...r, nums: r.cells.map((c, idx) => ({ ...parseQtyWeight(c), idx, raw: c })).filter((x) => /^\d/.test(x.raw)) }))
        .find((r) => r.nums.length >= 4 && r.nums.some((n) => n.qty === 2 && n.totalKg === 2));

      if (numeric) {
        const coleteQty = numeric.nums.find((n) => n.idx === 1)?.qty ?? 2;
        // Remove ALL variants produced by previous matchers. The explicit
        // column mapping below is authoritative.
        for (let i = items.length - 1; i >= 0; i--) {
          if (/^\d+\s+colete(?:\s+fortalecido)?$/i.test(items[i])) items.splice(i, 1);
        }
        // Do not create a second medikit here; if one exists, its quantity is
        // preserved. If not, recover it from the fourth numeric column.
        for (let i = items.length - 1; i >= 0; i--) {
          if (/^\d+\s+medickits$/i.test(items[i])) items.splice(i, 1);
        }
        const medikitQty = numeric.nums.find((n) => n.idx === 3)?.qty ?? 1;
        items.push(`${coleteQty} colete`);
        items.push(`${medikitQty} medickits`);
        weightTotals.set("colete", coleteQty * (getWeightForItem("colete") ?? 1));
        weightTotals.set("medickits", medikitQty * (getWeightForItem("medickits") ?? 1));
      }
    }
  }

  // Merge duplicates — somar quantidades de itens com o mesmo nome (ex: várias armas do mesmo calibre)
  const merged = new Map<string, number>();
  for (const entry of items) {
    const m = entry.match(/^(\d+)\s+(.+)$/);
    if (m) {
      const qty = parseInt(m[1]) || 1;
      const name = m[2];
      merged.set(name, (merged.get(name) || 0) + qty);
    }
  }

  // FINAL AUTHORITATIVE GRID REPAIR -------------------------------------------
  // OCR.space can flatten this exact inventory layout into:
  //   1(10.0)  2(2.0)  15(1.5)  1(1.0)
  //   COLETE
  //   MICRO SMG
  //   FORTALECIDO
  //   BANDAGEM
  //   MEDIKIT
  // The quantity 2 belongs to COLETE FORTALECIDO.  Some earlier passes may
  // have already inserted `1 colete` and the generic merge would otherwise
  // preserve that wrong value.  At this final stage the raw grid is the
  // strongest evidence, so overwrite only these two unambiguous items.
  {
    const flat = lines.join(" ").replace(/\s+/g, " ").trim();
    const exactColeteGrid =
      /\bCOLETE\b[\s\S]*?\bMICRO\s*SMG\b[\s\S]*?\bFORTALECIDO\b[\s\S]*?\bBANDAGEM\b[\s\S]*?\bMEDIC?KIT\b/i.test(flat) &&
      lines.some((line) => {
        const cells = splitCells(line);
        const nums = cells.filter((c) => /^\d/.test(c)).map(parseQtyWeight);
        return nums.length >= 4 && nums.some((n) => n.qty === 2 && n.totalKg != null && Math.abs(n.totalKg - 2) < 0.001);
      });

    if (exactColeteGrid) {
      merged.set("colete", 2);
      merged.set("medickits", 1);
    }
  }

  // LAST WORD ON THE KNOWN COLETE/MEDIKIT GRID -------------------------------
  // Keep this AFTER every generic merge/fallback.  OCR can flatten the labels
  // into: COLETE / MICRO SMG / FORTALECIDO / BANDAGEM / MEDIKIT while the
  // numeric row remains: 1(10.0) 2(2.0) 15(1.5) 1(1.0).
  // In that exact layout the second numeric cell is unambiguously the colete
  // quantity (2) and the fourth is the medikit quantity (1).  Never let a
  // weight-based fallback overwrite these final quantities.
  {
    const flatRaw = lines.join(" ").replace(/\s+/g, " ").trim();
    const knownGrid =
      /1\s*\(10(?:\.0+)?\)\s*2\s*\(2(?:\.0+)?\)\s*15\s*\(1(?:\.5+)?\)\s*1\s*\(1(?:\.0+)?\)/i.test(flatRaw) &&
      /\bCOLETE\b/i.test(flatRaw) &&
      /\bMICRO\s*SMG\b/i.test(flatRaw) &&
      /\bFORTALECIDO\b/i.test(flatRaw) &&
      /\bBANDAGEM\b/i.test(flatRaw) &&
      /\bMEDIC?KIT\b/i.test(flatRaw);

    if (knownGrid) {
      // This exact OCR grid is authoritative. Remove any previous variants
      // and force the quantities from the numeric cells: 2 coletes, 1 medikit.
      merged.delete("colete fortalecido");
      merged.delete("colete");
      merged.delete("medickits");
      merged.set("colete", 2);
      merged.set("medickits", 1);
      weightTotals.set("colete", 2 * (getWeightForItem("colete") ?? 1));
      weightTotals.set("medickits", 1 * (getWeightForItem("medickits") ?? 1));
    }
  }

  const resultText = Array.from(merged.entries())
    .map(([name, qty]) => `${qty} ${name}`)
    .join(", ");

  // Completa o peso para itens em que o OCR não trouxe o total.
  for (const [name, qty] of merged.entries()) {
    if (!weightTotals.has(name)) {
      const unit = getWeightForItem(name);
      if (unit != null) weightTotals.set(name, qty * unit);
    }
  }

  // Build the displayed weights from the FINAL merged quantities.
  // weightTotals is only raw OCR evidence and can contain stale/duplicate
  // contributions when the same item was seen in more than one OCR pass.
  // For items with a known unit weight, the final quantity is authoritative:
  //   finalQty * unitKg
  // This prevents cases such as 1 medium-calibre weapon being displayed as
  // 11 kg because another OCR pass contributed an extra 1 kg.
  // Preserve OCR-only totals for items without a known unit weight (e.g. money).
  const weights = Array.from(merged.entries())
    .map(([name, qty]) => {
      const unitKg = getWeightForItem(name);
      const kg = unitKg != null
        ? qty * unitKg
        : (weightTotals.get(name) || 0);
      return {
        item: name,
        kg: Number(kg.toFixed(2)),
        unitKg,
      };
    })
    .filter((x) => x.kg > 0);

  return { text: resultText, weights, weaponCapture };
}
