"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Shield, Clock, ShieldAlert, BookOpen, Layers, Calculator, Car,
  Coins, Package, FlaskConical, AlertTriangle, Scale, FileSpreadsheet, Gavel,
  Pencil, Link
} from "lucide-react";
import {
  ITENS_ILEGAIS, PRECOS_DROGAS,
} from "@/lib/data";
import {
  normalizeText, fmt, fmt2, cap, calcSequestro, calcMunicao,
  calcArmasGrandeQtde, calcItensIlegais, calcDroga,
  obterItemPorSinonimo, obterDrogaPorSinonimo, parseQuickInput, parseCrimesInput, getAllCrimesFlat,
} from "@/lib/utils";
import { ITEM_BY_NAME } from "@/lib/item-weights";
import EntriesPanel from "@/components/EntriesPanel";
import OcrBlock from "@/components/OcrBlock";

// ==================== IMAGENS DOS ITENS ====================
// Fonte visual: commit 99a5cf1 do repositório original.
// Usamos os ficheiros desse commit como fonte de verdade para evitar as
// imagens incorretas/renomeadas que foram introduzidas nas versões posteriores.
const ORIGINAL_IMAGE_COMMIT = "99a5cf1bba3403477362cca2607d5231b2ae4a95";
const ORIGINAL_IMAGE_BASE = `https://raw.githubusercontent.com/snikerhd/offsetrp-calculadora/${ORIGINAL_IMAGE_COMMIT}/src/assets/items`;

const ORIGINAL_IMAGE_FILES: Record<string, string> = {
  "acessorios-para-armas": 'Acessórios para armas.png',
  "adaga-templaria": 'Adaga templária.png',
  "algemas": 'Algemas.png',
  "alto-1": 'Alto (1).png',
  "alto": 'Alto.png',
  "anel-de-diamante": 'Anel de Diamante.png',
  "anel": 'Anel de Diamante.png',
  "baixo-1": 'Baixo (1).png',
  "baixo": 'Baixo.png',
  "baleia": 'Baleia.png',
  "barras-ouro": 'Barras Ouro.png',
  "barra-de-ouro": 'Barras Ouro.png',
  "barras-de-ouro": 'Barras Ouro.png',
  "bau-especiarias": 'Baú Especiarias.png',
  "bens-de-assalto-a-casa": 'Bens de assalto a casa.png',
  "bomba-2-guerra": 'Bomba 2ª Guerra.png',
  "c4": 'C4.png',
  "cabecos-de-cannabis": 'Cabeços de Cannabis.png',
  "charros": 'Charros.png',
  "chifres": 'Chifres.png',
  "civil": 'Civil.png',
  "colete": 'Colete.png',
  "corrente-de-ouro-10k": 'Corrente de Ouro 10k.png',
  "corrente-de-ouro": 'Corrente de Ouro.png',
  "cristal-processado": 'Cristal Processado.png',
  "cristal": 'Cristal.png',
  "diamante": 'Diamante.png',
  "dinheirosujo": 'Dinheirosujo.png',
  "diario-de-bordo": 'Diário de Bordo.png',
  "enxofre": 'Enxofre.png',
  "esquemas-de-armas": 'Esquemas de armas.png',
  "estanho": 'Estanho.png',
  "estimulante": 'Estimulante.png',
  "lockpick": 'Lockpick.png',
  "maco-tabaco": 'Maço tabaco.png',
  "medickits": 'Medickits.png',
  "minerios": 'Minérios.png',
  "nitro": 'Nitro.png',
  "niquel": 'Níquel.png',
  "pack-safira": 'Pack Safira.png',
  "pacote-ilegal": 'Pacote Ilegal.png',
  "pacote-de-droga": 'Pacote de Droga.png',
  "pager": 'Pager.png',
  "pepitas-de-ouro": 'Pepitas de ouro.png',
  "pecas-arma": 'Peças Arma.png',
  "policia": 'Policia.png',
  "polvora": 'Polvora.png',
  "rebarbadora": 'Rebarbadora.png',
  "relogio-de-ouro": 'Relógio de Ouro.png',
  "relogio-ouro": 'Relógio de Ouro.png',
  "saco-de-cannabis": 'Saco de Cannabis.png',
  "safiras": 'Safiras.png',
  "sementes-de-cannabis": 'Sementes de Cannabis.png',
  "tubarao-branco": 'Tubarão Branco.png',
  "tubarao-martelo": 'Tubarão Martelo.png',
  "medio": 'medio.png',
  "orca": 'orca.png',
  "polvo": 'polvo.png',
  "raia": 'raia.png',
  "idolo-inca": 'Ídolo Inca.png',
  "oleo-de-cannabis": 'Óleo de Cannabis.png',
};

function itemImageSlug(name: string): string {
  return normalizeText(name).replace(/\s+/g, "-");
}

// As imagens da aplicação estão em public/items.
// IMPORTANTE: no browser, public/ NÃO faz parte do URL; o caminho é /items/... .
const LOCAL_IMAGE_FILES: Record<string, string> = {
  "anel": "anel-de-diamante.png",
  "anel-de-diamante": "anel-de-diamante.png",
  "barras-ouro": "barras-ouro.png",
  "barra-de-ouro": "barras-ouro.png",
  "barras-de-ouro": "barras-ouro.png",
  "corrente-de-ouro": "corrente-de-ouro.png",
  "corrente-de-ouro-10k": "corrente-de-ouro-10k.png",
  "relogio-ouro": "relogio-de-ouro.png",
  "relogio-de-ouro": "relogio-de-ouro.png",
  "polvora": "polvora.png",
  "tubarao-branco": "tubarao-branco.png",
  "tubarao-martelo": "tubarao-martelo.png",
  "bens-de-assalto-a-casa": "bens-de-assalto-a-casa.png",
  "pepitas-de-ouro": "pepitas-de-ouro.png",
  "diamante": "diamante.png",
  "diamante-bruto": "diamante.png",
  "safiras": "safiras.png",
  "polvo": "polvo.png",
  "raia": "raia.png",
  "orca": "orca.png",
  "idolo-inca": "idolo-inca.png",
  "oleo-de-cannabis": "oleo-de-cannabis.png",
  "saco-de-cannabis": "saco-de-cannabis.png",
  "sementes-de-cannabis": "sementes-de-cannabis.png",
  "cabecos-de-cannabis": "cabecos-de-cannabis.png",
  "cristal-processado": "cristal-processado.png",
  "cristal": "cristal.png",
  "estimulante": "estimulante.png",
  "estanho": "estanho.png",
  "niquel": "niquel.png",
  "enxofre": "enxofre.png",
  "minerios": "minerios.png",
  "nitro": "nitro.png",
  "bomba-2-guerra": "bomba-2-guerra.png",
  "adaga-templaria": "adaga-templaria.png",
  "chifres": "chifres.png",
  "diario-de-bordo": "diario-de-bordo.png",
  "bau-especiarias": "bau-especiarias.png",
  "pacote-ilegal": "pacote-ilegal.png",
  "pacote-de-droga": "pacote-de-droga.png",
  "maco-tabaco": "maco-tabaco.png",
  "charros": "charros.png",
  "pager": "pager.png",
  "pecas-arma": "pecas-arma.png",
  "algemas": "algemas.png",
  "rebarbadora": "rebarbadora.png",
  "lockpick": "lockpick.png",
  "colete": "colete.png",
  "medickits": "medickits.png",
  "esquemas-de-armas": "esquemas-de-armas.png",
  "acessorios-para-armas": "acessorios-para-armas.png",
  "c4": "c4.png",
  "baleia": "baleia.png",
  "pack-safira": "pack-safira.png",
  "civil": "civil.png",
  "policia": "policia.png",
  "alto": "alto.png",
  "alto-1": "alto-1.png",
  "baixo": "baixo.png",
  "baixo-1": "baixo-1.png",
  "medio": "medio.png",
  "caixa-de-arma": "caixa-de-arma.png",
  "caixa-arma": "caixa-de-arma.png",
  "caixa-contrabando": "caixa-contrabando.png",
  "caixa-de-contrabando": "caixa-contrabando.png",
  "caixa-eletronicos": "caixa-eletronicos.png",
  "caixa-de-eletronicos": "caixa-eletronicos.png",
  "caixa-tabaco": "caixa-tabaco.png",
  "caixa-de-tabaco": "caixa-tabaco.png",
  "joias": "joias.png",
  "mala-diamantes": "mala-diamantes.png",
  "mala-de-diamantes": "mala-diamantes.png",
  "mala-gruppe6": "mala-gruppe6.png",
  "monitor": "monitor.png",
  "patentes": "patentes.png",
  "prototipo-sniper": "prototipo-sniper.png",
  "prototipo-de-sniper": "prototipo-sniper.png",
  "whisky-vintage": "whisky-vintage.png",
};

function itemImageSrc(name: string): string {
  const slug = itemImageSlug(name);
  // Primeiro procura SEMPRE na pasta pública local.
  // Em Next.js, public/items/foo.png é servido como /items/foo.png.
  const localFile = LOCAL_IMAGE_FILES[slug];
  if (localFile) return `/items/${localFile}`;

  // Se o nome já coincide com um ficheiro público normalizado, usa-o diretamente.
  return `/items/${slug}.png`;
}

// ==================== TIPOS ====================
interface CadEntry { desc: string; meses: number; multa: number; }
interface ExtraEntry { desc: string; valor: number; }
interface ProfileCrime { crime: string; multa: number; }

interface EditingCAD {
  cc: string;
  index: number;
  desc: string;
  meses: string;
  multa: string;
}

interface EditingExtra {
  cc: string;
  index: number;
  desc: string;
  valor: string;
}

const TABS = [
  { id: "Sequestro", icon: Shield, label: "Sequestro" },
  { id: "Dinheiro", icon: Coins, label: "Dinheiro" },
  { id: "Munição", icon: FlaskConical, label: "Munição" },
  { id: "Armas G. Qtde", icon: AlertTriangle, label: "Armas G. Qtde" },
  { id: "Itens Ilegais", icon: Package, label: "Itens Ilegais" },
  { id: "Drogas", icon: FlaskConical, label: "Drogas" },
  { id: "Mediação/Tentativa", icon: Scale, label: "Mediação" },
  { id: "Velocidade/EPI", icon: Car, label: "Velocidade/EPI" },
  { id: "Catálogo", icon: BookOpen, label: "Catálogo" },
  { id: "Perfis", icon: Layers, label: "Perfis" },
  { id: "Coimas Rápidas PT", icon: Calculator, label: "Coimas Rápidas" },
  { id: "Homicídios", icon: Gavel, label: "Homicídios" },
  { id: "Relatório", icon: FileSpreadsheet, label: "Relatório" },
];

type Department = 'DPSA' | 'DPLS' | 'DBC';

type RelatorioImagem = { cc: string; url: string };

// Resultado OCR associado ao CC no separador Relatório.
type RelatorioOCR = Record<string, string>;

export default function CalculadoraApp() {
  const [activeTab, setActiveTab] = useState("Coimas Rápidas PT");
  const [department, setDepartment] = useState<Department>('DPLS');
  const [systemTime, setSystemTime] = useState(new Date());
  const systemTimeRef = useRef(new Date());

  const [ccAtual, setCcAtual] = useState("Geral");
  const [cadPorCC, setCadPorCC] = useState<Record<string, CadEntry[]>>({});
  const [extraPorCC, setExtraPorCC] = useState<Record<string, ExtraEntry[]>>({});

  const [editingCAD, setEditingCAD] = useState<EditingCAD | null>(null);
  const [editingExtra, setEditingExtra] = useState<EditingExtra | null>(null);
  const [showEntriesPanel, setShowEntriesPanel] = useState(false);

  const [perfis, setPerfis] = useState<Record<string, ProfileCrime[]>>({});
  const [selectedPerfil, setSelectedPerfil] = useState<string | null>(null);

  const [seqCivis, setSeqCivis] = useState(0);
  const [seqFunc, setSeqFunc] = useState(0);
  const [homCivis,setHomCivis]=useState(0);
  const [homFunc,setHomFunc]=useState(0);
  const [homQCivis,setHomQCivis]=useState(0);
  const [homQFunc,setHomQFunc]=useState(0);
  const [homTent,setHomTent]=useState(false);
  const [homQTent,setHomQTent]=useState(false);

  const [dinheiroValor, setDinheiroValor] = useState(0);

  const [munBalasBaixo, setMunBalasBaixo] = useState(0);
  const [munBalasMedio, setMunBalasMedio] = useState(0);
  const [munBalasAlto, setMunBalasAlto] = useState(0);
  const [munCarrBaixo, setMunCarrBaixo] = useState(0);
  const [munCarrMedio, setMunCarrMedio] = useState(0);
  const [munCarrAlto, setMunCarrAlto] = useState(0);

  const [armasBaixo, setArmasBaixo] = useState(0);
  const [armasMedio, setArmasMedio] = useState(0);
  const [armasAlto, setArmasAlto] = useState(0);

  const [itensInput, setItensInput] = useState("");
  const [itensResultado, setItensResultado] = useState("");
  const [itensTotal, setItensTotal] = useState("");
  const [searchItens, setSearchItens] = useState("");
  const [itensQuantidades, setItensQuantidades] = useState<Record<string, number>>({});

  const [drogasInput, setDrogasInput] = useState("");
  const [drogasResultado, setDrogasResultado] = useState("");
  const [drogasQuantidades, setDrogasQuantidades] = useState<Record<string, number>>({});

  const [medCoima, setMedCoima] = useState(0);
  const [medMeses, setMedMeses] = useState(0);
  const [medPercCoima, setMedPercCoima] = useState(100);
  const [medPercMeses, setMedPercMeses] = useState(100);
  const [tentValor, setTentValor] = useState(0);

  const [searchCrime, setSearchCrime] = useState("");
  const [selectedCrimes, setSelectedCrimes] = useState<Set<number>>(new Set());

  const [testeInput, setTesteInput] = useState("");
  const [testeHistorico, setTesteHistorico] = useState<string[]>([]);

  const [relTipo, setRelTipo] = useState("Assalto a loja");
  const [relAssaltantes, setRelAssaltantes] = useState(1);
  const [relCivis, setRelCivis] = useState(0);
  const [relFunc, setRelFunc] = useState(0);
  const [relCP, setRelCP] = useState("");
  const [relObs, setRelObs] = useState("tentaram fugir mas foram apanhados passado alguns minutos.");
  const [relCCs, setRelCCs] = useState("");
  const [relAdvogado, setRelAdvogado] = useState("DPLS");
  const [relPercCoima, setRelPercCoima] = useState(100);
  const [relPercSentenca, setRelPercSentenca] = useState(100);
  const [relatorio, setRelatorio] = useState("");
  const [relCCCAD, setRelCCCAD] = useState("");
  const [relMesesCAD, setRelMesesCAD] = useState(0);
  const [relValorCAD, setRelValorCAD] = useState(0);
  const [relImagemCC, setRelImagemCC] = useState("");
  const [relImagemUrl, setRelImagemUrl] = useState("");
  const [relImagens, setRelImagens] = useState<RelatorioImagem[]>([]);
  const [relOcrCC, setRelOcrCC] = useState("");
  const [relOcrPorCC, setRelOcrPorCC] = useState<RelatorioOCR>({});

  const [velLimite, setVelLimite] = useState(50);
  const [velRegistrada, setVelRegistrada] = useState(0);
  const [velResultado, setVelResultado] = useState("");
  const [epiColete, setEpiColete] = useState(false);
  const [epiCapacete, setEpiCapacete] = useState(false);
  const [epiBotas, setEpiBotas] = useState(false);
  const [epiCalcas, setEpiCalcas] = useState(false);
  const [epiMascara, setEpiMascara] = useState(false);
  const [epiResultado, setEpiResultado] = useState("");

  const [alertMsg, setAlertMsg] = useState("");
  const alertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load profiles
  useEffect(() => {
    try {
      const saved = localStorage.getItem("perfis_coimas");
      if (saved) setPerfis(JSON.parse(saved));
    } catch { /* empty */ }
  }, []);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => {
      systemTimeRef.current = new Date();
      setSystemTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Save profiles
  useEffect(() => {
    localStorage.setItem("perfis_coimas", JSON.stringify(perfis));
  }, [perfis]);

  const showAlert = useCallback((msg: string) => {
    setAlertMsg(msg);
    if (alertTimer.current) clearTimeout(alertTimer.current);
    alertTimer.current = setTimeout(() => setAlertMsg(""), 3000);
  }, []);

  const getCc = useCallback(() => ccAtual.trim() || "Geral", [ccAtual]);

  const addExtra = useCallback((cc: string, desc: string, valor: number) => {
    setExtraPorCC(prev => ({
      ...prev,
      [cc]: [...(prev[cc] || []), { desc, valor }],
    }));
  }, []);

  const addCAD = useCallback((cc: string, desc: string, meses: number, multa: number) => {
    setCadPorCC(prev => ({
      ...prev,
      [cc]: [...(prev[cc] || []), { desc, meses, multa }],
    }));
  }, []);

  const allCCsWithEntries = Array.from(
    new Set([...Object.keys(cadPorCC), ...Object.keys(extraPorCC)])
  ).filter(cc => (cadPorCC[cc]?.length || 0) > 0 || (extraPorCC[cc]?.length || 0) > 0);

  // Theme
  const accentColor = department === 'DPSA' ? 'text-amber-400' : department === 'DPLS' ? 'text-blue-400' : 'text-white';
  const bgGradient = department === 'DPSA'
    ? 'from-amber-950/95 via-slate-900/98 to-neutral-950/100'
    : department === 'DPLS'
      ? 'from-blue-950/95 via-slate-900/98 to-neutral-950/100'
      : 'from-neutral-900/95 via-slate-950/98 to-neutral-950/100';
  const neonShadow = department === 'DPSA'
    ? 'shadow-[0_0_15px_rgba(245,158,11,0.2)]'
    : department === 'DPLS'
      ? 'shadow-[0_0_15px_rgba(59,130,246,0.2)]'
      : 'shadow-[0_0_15px_rgba(255,255,255,0.15)]';
  const fillBtnTheme = department === 'DPSA'
    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
    : department === 'DPLS'
      ? 'bg-blue-500 hover:bg-blue-400 text-slate-950'
      : 'bg-white hover:bg-neutral-200 text-slate-950';

  const activeHeaderTab = (tab: Department) => {
    if (department === tab) {
      if (tab === 'DPSA') return 'bg-amber-600 text-white shadow-md';
      if (tab === 'DPLS') return 'bg-blue-600 text-white shadow-md';
      return 'bg-white text-slate-950 shadow-md font-extrabold';
    }
    return 'text-gray-400 hover:text-white';
  };

  // ========== FUNÇÕES DAS ABAS ==========
  const addSequestro = () => {
    const multa = calcSequestro(seqCivis, seqFunc);
    if (multa > 0) {
      const cc = getCc();
      addExtra(cc, `Sequestro: ${seqCivis} civis, ${seqFunc} func. → ${fmt2(multa)} €`, multa);
      showAlert(`Multa de ${fmt2(multa)} € adicionada para CC ${cc}.`);
      setSeqCivis(0); setSeqFunc(0);
    } else showAlert("Nenhum refém informado.");
  };

  const addHomicidios = () => {
    const cc = getCc();
    const v1 = ((homCivis*85000)+(homFunc*100000))*(homTent?0.75:1);
    const v2 = ((homQCivis*100000)+(homQFunc*115000))*(homQTent?0.75:1);
    if(v1>0) addExtra(cc,`HOMICÍDIO${homTent?' (Tentativa)':''}: ${homCivis} civis, ${homFunc} func. → ${fmt2(v1)} €`,v1);
    if(v2>0) addExtra(cc,`HOMICÍDIO QUALIFICADO${homQTent?' (Tentativa)':''}: ${homQCivis} civis, ${homQFunc} func. → ${fmt2(v2)} €`,v2);
  };

  const addDinheiro = () => {
    if (dinheiroValor <= 10000) { showAlert("Quantidade Legal"); return; }
    const multa = dinheiroValor * 0.75;
    const cc = getCc();
    addExtra(cc, `Dinheiro não declarado: ${fmt2(dinheiroValor)} € → multa ${fmt2(multa)} €`, multa);
    showAlert(`Multa de ${fmt2(multa)} € adicionada para CC ${cc}.`);
    setDinheiroValor(0);
  };

  const addMunicao = () => {
    const multa = calcMunicao(munBalasBaixo, munBalasMedio, munBalasAlto, munCarrBaixo, munCarrMedio, munCarrAlto);
    if (multa > 0) {
      const cc = getCc();
      let desc = "Munição:\n";
      if (munBalasBaixo > 0) desc += `  ${munBalasBaixo} balas baixo calibre x 150 € = ${fmt(munBalasBaixo * 150)} €\n`;
      if (munBalasMedio > 0) desc += `  ${munBalasMedio} balas médio calibre x 200 € = ${fmt(munBalasMedio * 200)} €\n`;
      if (munBalasAlto > 0) desc += `  ${munBalasAlto} balas alto calibre x 250 € = ${fmt(munBalasAlto * 250)} €\n`;
      if (munCarrBaixo > 0) desc += `  ${munCarrBaixo} carregador baixo calibre x 1.800 € = ${fmt(munCarrBaixo * 1800)} €\n`;
      if (munCarrMedio > 0) desc += `  ${munCarrMedio} carregador médio calibre x 3.000 € = ${fmt(munCarrMedio * 3000)} €\n`;
      if (munCarrAlto > 0) desc += `  ${munCarrAlto} carregador alto calibre x 4.200 € = ${fmt(munCarrAlto * 4200)} €\n`;
      desc = desc.trimEnd();
      addExtra(cc, desc, multa);
      showAlert(`Multa de ${fmt2(multa)} € adicionada para CC ${cc}.`);
      setMunBalasBaixo(0); setMunBalasMedio(0); setMunBalasAlto(0);
      setMunCarrBaixo(0); setMunCarrMedio(0); setMunCarrAlto(0);
    } else showAlert("Nenhuma munição informada.");
  };

  const addArmas = () => {
    const { total, detalhes } = calcArmasGrandeQtde(armasBaixo, armasMedio, armasAlto);
    if (total > 0) {
      const cc = getCc();
      let linha = "Armas Grande Quantidade:";
      for (const [desc] of detalhes) linha += `  ${desc}`;
      linha += `\nTOTAL: ${fmt(total)} €`;
      addExtra(cc, linha, total);
      showAlert(`Multa de ${fmt(total)} € adicionada para CC ${cc}.`);
      setArmasBaixo(0); setArmasMedio(0); setArmasAlto(0);
    } else {
      let msg = "Passar coima base:\n";
      if (armasBaixo > 0 && armasBaixo < 5) msg += `- Baixo: ${armasBaixo} armas (min 5)\n`;
      if (armasMedio > 0 && armasMedio < 4) msg += `- Médio: ${armasMedio} armas (min 4)\n`;
      if (armasAlto > 0 && armasAlto < 3) msg += `- Alto: ${armasAlto} armas (min 3)\n`;
      msg += "\nNão atinge limiar de Grande Quantidade.";
      showAlert(msg);
    }
  };

  const calcItensRapido = () => {
    const textoBruto = itensInput.trim();
    if (!textoBruto) { showAlert("Digite uma lista de itens"); return; }
    // Ignora avisos do OCR (ex.: "— ⚠ ATENÇÃO: ... podem estar trocados") que
    // viriam colados ao último item e impediriam o seu reconhecimento.
    const texto = textoBruto.split("⚠")[0].trim();
    // Aceita separação por vírgulas OU por linhas (texto OCR multilinha).
    const partes = texto.split(/[\n,]+/);
    let totalUnitario = 0;
    const items: string[] = [];
    const erros: string[] = [];
    for (const parte of partes) {
      const p = parte.trim().replace(/[—–]+\s*$/, "").trim();
      if (!p) continue;
      const m = p.match(/^(\d+)\s+(.+)$/);
      if (!m) { erros.push(`Formato inválido: '${p}'`); continue; }
      const qtd = parseInt(m[1]);
      const nome = m[2].trim().toLowerCase();
      const nomeNormalizado = normalizeText(nome);

      // Dinheiro não declarado (75% acima de 10.000€)
      if (nomeNormalizado.includes("dinheiro") || nomeNormalizado.includes("cash") || nomeNormalizado.includes("money")) {
        if (qtd > 10000) {
          const multa = qtd * 0.75;
          totalUnitario += multa;
          items.push(`${fmt(qtd)} € dinheiro não declarado (75%) = ${fmt(multa)}€`);
        }
        continue;
      }

      // Itens legais podem ser reconhecidos no OCR/pesos, mas nunca
      // entram nas Coimas Rápidas. São simplesmente ignorados aqui.
      const itemLegalDireto = ITEM_BY_NAME.get(nomeNormalizado);
      if (itemLegalDireto && !itemLegalDireto.illegal) {
        continue;
      }

      const item = obterItemPorSinonimo(nome);
      if (item) {
        const itemDef = ITEM_BY_NAME.get(normalizeText(item));
        if (itemDef && !itemDef.illegal) {
          continue;
        }

        const unit = ITENS_ILEGAIS[item];
        const sub = qtd * unit;
        totalUnitario += sub;
        items.push(`${qtd} ${item} (${fmt(unit)}€) = ${fmt(sub)}€`);
      } else erros.push(`Item não reconhecido: '${m[2]}'`);
    }
    const base = 30000;
    const totalGeral = base + totalUnitario;
    let msg = `Coima base (posse de itens ilegais): ${fmt2(base)} €\n`;
    if (items.length) msg += "Itens:\n" + items.join("\n") + "\n";
    msg += `Subtotal unitários: ${fmt2(totalUnitario)} €\nTOTAL: ${fmt2(totalGeral)} €`;
    if (erros.length) msg += "\n\nErros:\n" + erros.join("\n");
    setItensResultado(msg);
    setItensTotal(`${fmt2(totalGeral)} €`);
  };

  const addItensGrid = () => {
    const itens: Record<string, number> = {};
    for (const [item, qtd] of Object.entries(itensQuantidades)) {
      if (qtd > 0) itens[item] = qtd;
    }
    if (!Object.keys(itens).length) { showAlert("Nenhum item informativo."); return; }
    const { total, detalhes } = calcItensIlegais(itens);
    const cc = getCc();
    let linha = "Itens Ilegais:\n";
    for (const [item, qtd, unit, val] of detalhes) linha += `  ${qtd} ${item} x ${fmt(unit)} € = ${fmt(val)} €\n`;
    linha = linha.trimEnd();
    addExtra(cc, linha, total);
    showAlert(`Multa de ${fmt(total)} € adicionada para CC ${cc}.`);
    setItensQuantidades({});
  };

  const calcDrogasRapido = () => {
    const texto = drogasInput.trim();
    if (!texto) { showAlert("Digite uma lista de drogas"); return; }
    const partes = texto.split(",");
    let totalUnitario = 0;
    const items: string[] = [];
    const erros: string[] = [];
    for (const parte of partes) {
      const p = parte.trim();
      if (!p) continue;
      const m = p.match(/^(\d+)\s+(.+)$/);
      if (!m) { erros.push(`Formato inválido: '${p}'`); continue; }
      const qtd = parseInt(m[1]);
      const nome = normalizeText(m[2].trim());
      const droga = obterDrogaPorSinonimo(nome);
      if (droga && droga in PRECOS_DROGAS) {
        const unit = PRECOS_DROGAS[droga];
        const sub = qtd * unit;
        totalUnitario += sub;
        items.push(`${qtd} ${cap(droga)} (${fmt(unit)}€) = ${fmt(sub)}€`);
      } else erros.push(`Droga não reconhecida: '${m[2]}'`);
    }
    const base = 22500;
    const totalGeral = base + totalUnitario;
    let msg = `Coima base (posse de droga): ${fmt2(base)} €\n`;
    if (items.length) msg += "Drogas:\n" + items.join("\n") + "\n";
    msg += `Subtotal unitários: ${fmt2(totalUnitario)} €\nTOTAL: ${fmt2(totalGeral)} €`;
    if (erros.length) msg += "\n\nErros:\n" + erros.join("\n");
    setDrogasResultado(msg);
  };

  const addDrogasGrid = () => {
    const quant: Record<string, number> = {};
    for (const [droga, qtd] of Object.entries(drogasQuantidades)) {
      if (qtd > 0) quant[droga] = qtd;
    }
    if (!Object.keys(quant).length) { showAlert("Nenhuma droga informativa."); return; }
    const { total, detalhes } = calcDroga(quant);
    const cc = getCc();
    let linha = "Drogas:\n";
    for (const [desc, qtd, unit, val] of detalhes) linha += `  ${qtd} ${desc} x ${fmt(unit)} € = ${fmt(val)} €\n`;
    linha = linha.trimEnd();
    addExtra(cc, linha, total);
    showAlert(`Multa de ${fmt(total)} € adicionada para CC ${cc}.`);
    setDrogasQuantidades({});
  };

  const calcMediacao = () => {
    const nc = medCoima * (medPercCoima / 100);
    const nm = medMeses * (medPercMeses / 100);
    showAlert(`Após mediação:\nCoima: ${fmt2(nc)} €\nMeses: ${nm.toFixed(1)} meses`);
  };

  const calcTentativa = () => {
    showAlert(`Valor da tentativa: ${fmt2(tentValor * 0.75)} €`);
  };

  const allCrimes = getAllCrimesFlat();
  const filteredCrimes = searchCrime
    ? allCrimes.filter(c => {
      const t = normalizeText(searchCrime);
      return normalizeText(c.nome).includes(t) || normalizeText(c.categoria).includes(t);
    })
    : allCrimes;

  const addCrimesCatalogo = () => {
    if (!selectedCrimes.size) { showAlert("Selecione pelo menos um crime."); return; }
    const cc = getCc();
    const indices = Array.from(selectedCrimes);
    for (const idx of indices) {
      const c = allCrimes[idx];
      if (c) addCAD(cc, c.nome, c.meses, c.multa);
    }
    setSelectedCrimes(new Set());
    showAlert(`${indices.length} crime(s) adicionado(s) ao CAD do CC '${cc}'.`);
  };

  const handleSelectAllCrimes = (checked: boolean) => {
    if (checked) {
      const indices = filteredCrimes.map((_, i) => allCrimes.indexOf(filteredCrimes[i]));
      setSelectedCrimes(new Set(indices));
    } else {
      setSelectedCrimes(new Set());
    }
  };

  const perfilCrimes = selectedPerfil ? (perfis[selectedPerfil] || []) : [];
  const perfilTotal = perfilCrimes.reduce((s, c) => s + c.multa, 0);

  const novoPerfil = () => {
    const nome = prompt("Nome do perfil:");
    if (nome && nome.trim()) {
      if (perfis[nome.trim()]) { showAlert("Já existe um perfil com esse nome."); return; }
      setPerfis(prev => ({ ...prev, [nome.trim()]: [] }));
      showAlert(`Perfil '${nome.trim()}' criado.`);
    }
  };

  const eliminarPerfil = () => {
    if (!selectedPerfil) return;
    if (confirm(`Eliminar o perfil '${selectedPerfil}'?`)) {
      setPerfis(prev => {
        const next = { ...prev };
        delete next[selectedPerfil];
        return next;
      });
      setSelectedPerfil(null);
    }
  };

  const aplicarPerfil = () => {
    if (!selectedPerfil) { showAlert("Selecione um perfil."); return; }
    const crimes = perfis[selectedPerfil] || [];
    if (!crimes.length) { showAlert("Este perfil não contém crimes."); return; }
    const cc = getCc();
    for (const c of crimes) addCAD(cc, c.crime, 0, c.multa);
    showAlert(`${crimes.length} crimes adicionados ao CAD do CC '${cc}'.`);
  };

  const removePerfilCrime = (idx: number) => {
    if (!selectedPerfil) return;
    setPerfis(prev => ({
      ...prev,
      [selectedPerfil]: prev[selectedPerfil].filter((_, i) => i !== idx),
    }));
  };

  const calcularTeste = () => {
    const texto = testeInput.trim();
    if (!texto) { showAlert("Digite algo no formato: quantidade item"); return; }
    const r = parseQuickInput(texto, { posseMunicao: true });
    let msg = `> ${texto}\n`;
    
    if (r.drogas.resultados.length) {
      msg += "--- DROGAS ---\n" + r.drogas.resultados.join("\n") + `\nTOTAL DROGAS: ${fmt2(r.drogas.subtotal)} €\n\n`;
    }
    if (r.itens.resultados.length) {
      msg += "--- ITENS ILEGAIS (base 30 000€) ---\n" + r.itens.resultados.join("\n") + `\nTOTAL ITENS: ${fmt2(30000 + r.itens.subtotal)} €\n\n`;
    }
    if (r.municao.resultados.length) {
      const baseMun = r.municao.base > 0 ? ` (base ${fmt2(r.municao.base)} €)` : "";
      msg += `--- MUNIÇÃO${baseMun} ---\n`;
      msg += r.municao.resultados.join("\n") + `\n`;
      msg += `TOTAL MUNIÇÃO: ${fmt2(r.municao.total)} €\n\n`;
    }
    if (r.armas.resultados.length) {
      msg += "--- ARMAS ---\n" + r.armas.resultados.join("\n") + `\nTOTAL ARMAS: ${fmt2(r.armas.total)} €\n\n`;
    }
    if (r.dinheiro.resultados.length) {
      msg += "--- DINHEIRO ---\n" + r.dinheiro.resultados.join("\n") + `\nTOTAL: ${fmt2(r.dinheiro.total)} €\n\n`;
    }
    if (r.sequestro.resultados.length) {
      msg += "--- SEQUESTRO ---\n" + r.sequestro.resultados.join("\n") + `\nTOTAL: ${fmt2(r.sequestro.total)} €\n\n`;
    }
    if (r.crimes.resultados.length) {
      msg += "--- CRIMES ---\n" + r.crimes.resultados.join("\n") + `\nTOTAL: ${fmt2(r.crimes.totalMulta)} € (meses: ${r.crimes.totalMeses.toFixed(0)})\n\n`;
    }
    if (r.materiaPrima.resultados.length) {
      msg += "--- MATÉRIA PRIMA ---\n" + r.materiaPrima.resultados.join("\n") + `\nTOTAL MATÉRIA PRIMA: ${fmt2(r.materiaPrima.total)} €\n\n`;
    }
    if (r.drogas.resultados.length || r.itens.resultados.length || r.municao.resultados.length || r.armas.resultados.length || r.dinheiro.resultados.length || r.sequestro.resultados.length || r.crimes.resultados.length || r.materiaPrima.resultados.length) {
      msg += `TOTAL GERAL: ${fmt2(r.totalGeral)} €`;
    } else {
      msg = "Nenhum item válido foi reconhecido.";
    }
    if (r.erros.length) msg += "\n\nERROS:\n" + r.erros.join("\n");
    setTesteHistorico(prev => [...prev, msg]);
    setTesteInput("");
  };

  const addValorCAD = () => {
    const cc = relCCCAD.trim();
    if (!cc) { showAlert("Indique o CC."); return; }
    addCAD(cc, `Valor recomendado CAD: ${fmt2(relValorCAD)} €`, relMesesCAD, relValorCAD);
    setRelCCCAD(""); setRelMesesCAD(0); setRelValorCAD(0);
    showAlert(`Valor de ${fmt2(relValorCAD)} € e ${relMesesCAD} meses adicionados ao CAD do CC '${cc}'.`);
  };

  // Associa uma imagem/evidência a um CC para aparecer automaticamente no relatório.
  const addImagemRelatorio = () => {
    const cc = relImagemCC.trim();
    const url = relImagemUrl.trim();
    if (!cc) { showAlert("Indique o CC da imagem."); return; }
    if (!url) { showAlert("Indique o link da imagem."); return; }
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch {
      showAlert("O link da imagem não parece válido.");
      return;
    }
    setRelImagens(prev => [...prev, { cc, url }]);
    setRelImagemUrl("");
    showAlert(`Imagem associada ao CC '${cc}'.`);
  };

  const removerImagemRelatorio = (index: number) => {
    setRelImagens(prev => prev.filter((_, i) => i !== index));
  };

  // No RELATÓRIO, coimas de armas só contam em GRANDE QUANTIDADE
  // (baixo ≥5, médio ≥4, alto ≥3). Armas avulsas (ex.: 1x médio calibre)
  // não entram nas Coimas Extras. Nas Coimas Rápidas mantém-se tudo.
  const ocrArmasGrande = (ocrParsed: ReturnType<typeof parseQuickInput> | null): { linhas: string[]; total: number } => {
    const linhas = (ocrParsed?.armas.resultados || []).filter((l) => l.includes("GRANDE QUANTIDADE"));
    const total = linhas.reduce((s, l) => {
      const m = l.match(/(\d[\d.]*)\s*€\s*$/);
      return s + (m ? parseInt(m[1].replace(/\./g, ""), 10) : 0);
    }, 0);
    return { linhas, total };
  };

  // ========== FUNÇÃO GERAR RELATÓRIO (COM PRODUÇÃO DE DROGA) ==========
  const gerarRelatorio = () => {
    // O relatório inclui tanto os CC introduzidos manualmente como os CC
    // associados às imagens, evitando que uma evidência fique de fora.
    // Também inclui CCs que tenham coimas CAD ou Extras registadas.
    const ccsManuais = relCCs.trim().split("\n").map(l => l.trim()).filter(Boolean);
    const ccsComDados = Array.from(new Set([...Object.keys(cadPorCC), ...Object.keys(extraPorCC)]));
    const ccs = Array.from(new Set([...ccsManuais, ...relImagens.map(img => img.cc), ...Object.keys(relOcrPorCC), ...ccsComDados]));
    const linhas: string[] = [];

    let resumo = "📝 Resumo:\n";
    const isProducaoDroga = relTipo === "Produção de droga";

    if (isProducaoDroga) {
      if (relCP) {
        resumo += `Recebemos um alerta de produção de droga, chegamos ao local no cp ${relCP} encontramos ${relAssaltantes} sujeito${relAssaltantes !== 1 ? 's' : ''} a processar.`;
      } else {
        resumo += `Recebemos um alerta de produção de droga, chegamos ao local encontramos ${relAssaltantes} sujeito${relAssaltantes !== 1 ? 's' : ''} a processar.`;
      }
      let obs = relObs.trim();
      obs = obs.replace(/passado alguns minutos\.?/i, '').trim();
      if (obs) {
        obs = obs.charAt(0).toUpperCase() + obs.slice(1);
        resumo += ` ${obs}`;
      }
    } else {
      if (relCP) {
        resumo += `Houve um ${relTipo} no cp ${relCP}, tinha ${relAssaltantes} assaltante${relAssaltantes !== 1 ? 's' : ''} e ${relCivis} refém${relCivis !== 1 ? 's' : ''} civis`;
      } else {
        resumo += `Houve um ${relTipo}, tinha ${relAssaltantes} assaltante${relAssaltantes !== 1 ? 's' : ''} e ${relCivis} refém${relCivis !== 1 ? 's' : ''} civis`;
      }
      if (relFunc > 0) {
        resumo += ` e ${relFunc} funcionário${relFunc !== 1 ? 's' : ''} públicos`;
      }
      let obs = relObs.trim();
      obs = obs.replace(/passado alguns minutos\.?/i, '').trim();
      if (obs) {
        obs = obs.charAt(0).toUpperCase() + obs.slice(1);
        resumo += `, os assaltantes ${obs}.`;
      } else {
        resumo += `.`;
      }
    }
    linhas.push(resumo);
    linhas.push("");

    linhas.push("-----------------------------📸 EVIDÊNCIAS 📸------------------------------");
    for (const cc of ccs) {
      linhas.push(cc);
      linhas.push("➙ Foto 1 - Sujeito");
      linhas.push("➙ Foto 2 - Pertences");
      linhas.push("➙ Foto 3 - Identificação");
      linhas.push("➙ Foto 4 - Historial C.A.D.");
    }
    linhas.push("");

    for (const cc of ccs) {
      linhas.push(`================== CC: ${cc} ==================`);
      linhas.push("--- Coimas CAD ---");
      const cadEntries = cadPorCC[cc] || [];
      if (cadEntries.length) {
        for (const entry of cadEntries) {
          linhas.push(`  ${entry.desc}`);
          linhas.push(`      Meses: ${entry.meses.toFixed(1)}  |  Multa: ${fmt2(entry.multa)} €`);
        }
      } else {
        linhas.push("  (Nenhuma coima CAD registada)");
      }

      linhas.push("--- Coimas Extras ---");
      const extraEntries = extraPorCC[cc] || [];
      const ocrTexto = relOcrPorCC[cc];
      const ocrParsed = ocrTexto ? parseQuickInput(ocrTexto) : null;
      const ocrItensExtra = ocrParsed?.itens.subtotal || 0;
      const ocrDrogasExtra = ocrParsed?.drogas.subtotal || 0;
      const ocrMunicaoExtra = ocrParsed?.municao.total || 0;
      const ocrDinheiroExtra = ocrParsed?.dinheiro.total || 0;
      const { linhas: ocrArmasGrandeLinhas, total: ocrArmasExtra } = ocrArmasGrande(ocrParsed);
      const ocrExtraTotal = ocrItensExtra + ocrDrogasExtra + ocrMunicaoExtra + ocrDinheiroExtra + ocrArmasExtra;
      const sequestroMultaRel = calcSequestro(relCivis, relFunc);
      if (extraEntries.length || ocrExtraTotal > 0 || sequestroMultaRel > 0) {
        for (const entry of extraEntries) {
          linhas.push(`  ${entry.desc}`);
        }
        if (ocrParsed?.itens.resultados.length) {
          linhas.push("  Itens Ilegais:");
          for (const linha of ocrParsed.itens.resultados) {
            linhas.push(`  ${linha.trim().replace(/^(\d+)x /, "$1 ").replace(/ = /, " € = ").replace(/(\d+)$/, "$1 €")}`);
          }
        }
        if (ocrParsed?.drogas.resultados.length) {
          linhas.push("  Drogas:");
          for (const linha of ocrParsed.drogas.resultados) {
            linhas.push(`  ${linha.trim().replace(/^(\d+)x /, "$1 ").replace(/ = /, " € = ").replace(/(\d+)$/, "$1 €")}`);
          }
        }
        if (ocrArmasGrandeLinhas.length) {
          linhas.push("  Armas em Grande Quantidade:");
          for (const linha of ocrArmasGrandeLinhas) {
            linhas.push(`  ${linha.trim().replace(/^(\d+)x /, "$1 ").replace(/ = /, " € = ").replace(/(\d+)$/, "$1 €")}`);
          }
        }
        if (ocrParsed?.municao.resultados.length) {
          linhas.push("  Munição:");
          for (const linha of ocrParsed.municao.resultados) {
            linhas.push(`  ${linha.trim().replace(/^(\d+)x /, "$1 ").replace(/ = /, " € = ").replace(/(\d+)$/, "$1 €")}`);
          }
        }
        if (ocrParsed?.dinheiro.resultados.length) {
          for (const linha of ocrParsed.dinheiro.resultados) {
            linhas.push(`  Dinheiro não declarado: ${linha.trim().replace(/ € x 75% = /, " € → multa ")}`);
          }
        }
        if (sequestroMultaRel > 0) {
          let seqDesc = `  Sequestro: ${relCivis} civis (9.000€)`;
          if (relFunc > 0) seqDesc += ` + ${relFunc} func. públicos (15.000€)`;
          seqDesc += ` = ${fmt2(sequestroMultaRel)} €`;
          linhas.push(seqDesc);
        }
      } else {
        linhas.push("  (Nenhuma coima extra registada)");
      }

      const totalCC = cadEntries.reduce((s, e) => s + e.multa, 0) + extraEntries.reduce((s, e) => s + e.valor, 0) + ocrExtraTotal + sequestroMultaRel;
      const mesesCC = cadEntries.reduce((s, e) => s + e.meses, 0);
      linhas.push(`💰 Total Coimas: ${fmt2(totalCC)} €`);
      const mesesCappedBase = Math.min(mesesCC, 60);
      if (mesesCC > 60) {
        linhas.push(`⚖️ Sentença base: ${mesesCappedBase.toFixed(1)} meses (máx. 60 meses)`);
      } else {
        linhas.push(`⚖️ Sentença base: ${mesesCappedBase.toFixed(1)} meses`);
      }
      linhas.push("");
    }

    linhas.push("------------------------------- MEDIAÇÃO -------------------------------");
    linhas.push(`Mediação ao cargo da ${relAdvogado} devido ao facto de não se encontrarem advogados presentes ao serviço no momento da detenção. A mediação foi efetuada após acordo mútuo entre ambas as partes, sendo a coima a ${relPercCoima}% e a sentença a ${relPercSentenca}%.`);
    linhas.push("");

    for (const cc of ccs) {
      const cadEntries = cadPorCC[cc] || [];
      const extraEntries = extraPorCC[cc] || [];
      const ocrTexto = relOcrPorCC[cc] || "";
      const ocrParsed = ocrTexto ? parseQuickInput(ocrTexto) : null;
      const ocrItensExtra = ocrParsed?.itens.subtotal || 0;
      const ocrDrogasExtra = ocrParsed?.drogas.subtotal || 0;
      const ocrMunicaoExtra = ocrParsed?.municao.total || 0;
      const ocrDinheiroExtra = ocrParsed?.dinheiro.total || 0;
      const { total: ocrArmasExtra } = ocrArmasGrande(ocrParsed);
      const ocrExtraTotal = ocrItensExtra + ocrDrogasExtra + ocrMunicaoExtra + ocrDinheiroExtra + ocrArmasExtra;
      const sequestroMultaRel = calcSequestro(relCivis, relFunc);
      const totalExtras = extraEntries.reduce((s, e) => s + e.valor, 0) + ocrExtraTotal;
      const totalCC = cadEntries.reduce((s, e) => s + e.multa, 0) + totalExtras + sequestroMultaRel;
      const mesesCC = cadEntries.reduce((s, e) => s + e.meses, 0);
      const coimaFinal = totalCC * (relPercCoima / 100);
      linhas.push(cc);
      linhas.push(`Coima Total: ${fmt2(coimaFinal)} €`);
      const mesesBaseCapped = Math.min(mesesCC, 60);
      const mesesComMediação = mesesBaseCapped * (relPercSentenca / 100);
      if (mesesCC > 60) {
        linhas.push(`Sentença após mediação: ${mesesComMediação.toFixed(0)} meses (${relPercSentenca}% de ${mesesBaseCapped})`);
      } else {
        linhas.push(`Sentença após mediação: ${mesesComMediação.toFixed(0)} meses (${relPercSentenca}%)`);
      }
      linhas.push("");
    }

    setRelatorio(linhas.join("\n"));
  };

  const copiarRelatorio = () => {
    if (!relatorio) { showAlert("Nenhum relatório gerado."); return; }
    navigator.clipboard.writeText(relatorio).then(() => showAlert("Relatório copiado!"));
  };

  const limparTudo = () => {
    if (confirm("Tem certeza que deseja limpar TODOS os dados?")) {
      setCadPorCC({});
      setExtraPorCC({});
      setRelCCs("");
      setRelImagens([]);
      setRelOcrPorCC({});
      setRelOcrCC("");
      setCcAtual("Geral");
      setRelatorio("");
      showAlert("Todos os dados foram limpos.");
    }
  };

  const inputCls = `w-full px-3 py-2 bg-black/40 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-white/30 font-mono`;
  const BENS_ASSALTO_CASA_OCULTOS = new Set([
  "perfume",
  "phone 7",
  "tv led 75",
  "computador",
  "pack vinhos",
  "ouro estatal",
  "arma de colecao",
  "tigre",
  "quadro",
  "documentos",
  "relogio ouro",
  "pulseira ouro",
  "aguia de bronze",
  "crypto pen",
  "cripto pen",
  "coroa",
  "barra de ouro",
  "barras ouro",
  // Nota: Protótipo Sniper, Mala Gruppe6, Monitor, Patentes, Whisky Vintage,
  // Joias, Mala Diamantes e Caixas (Eletrónicos/Tabaco/Contrabando) têm agora
  // valores próprios no Código Penal V13 e imagem própria, por isso aparecem
  // individualmente na grelha "Itens Ilegais".
]);

const labelCls = "block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1";

  const totalExtra = (extraPorCC[getCc()] || []).reduce((s, e) => s + e.valor, 0);
  const totalCAD = (cadPorCC[getCc()] || []).reduce((s, e) => s + e.multa, 0);

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgGradient} text-white font-sans flex flex-col justify-between relative selection:bg-white/20 overflow-x-hidden`}>
      
      <EntriesPanel
        showEntriesPanel={showEntriesPanel}
        setShowEntriesPanel={setShowEntriesPanel}
        cadPorCC={cadPorCC}
        extraPorCC={extraPorCC}
        setCadPorCC={setCadPorCC}
        setExtraPorCC={setExtraPorCC}
        editingCAD={editingCAD}
        setEditingCAD={setEditingCAD}
        editingExtra={editingExtra}
        setEditingExtra={setEditingExtra}
        onShowAlert={showAlert}
        fmt2={fmt2}
      />

      <div className="absolute top-0 left-0 right-0 h-1.5 flex z-50">
        <div className={`flex-1 transition-all duration-1000 ${department === 'DPSA' ? 'bg-amber-600 animate-pulse' : department === 'DPLS' ? 'bg-blue-600 animate-pulse' : 'bg-white/80 animate-pulse'}`} />
        <div className="w-12 bg-white/20 animate-ping absolute left-1/2 transform -translate-x-1/2 h-1.5" />
        <div className={`flex-1 transition-all duration-1000 ${department === 'DPSA' ? 'bg-yellow-600 animate-pulse delay-500' : department === 'DPLS' ? 'bg-red-600 animate-pulse delay-500' : 'bg-neutral-400 animate-pulse delay-500'}`} />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-40" />

      {alertMsg && (
        <div className="fixed top-16 right-4 z-[60] max-w-sm p-4 rounded-lg shadow-lg bg-neutral-900 border border-white/10 text-white">
          <pre className="whitespace-pre-wrap text-sm">{alertMsg}</pre>
        </div>
      )}

      <header className="border-b border-white/10 bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 z-10 relative">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-neutral-900 border ${department === 'DPSA' ? 'border-amber-500/30' : department === 'DPLS' ? 'border-blue-500/30' : 'border-white/30'}`}>
            <Shield className={`w-8 h-8 ${accentColor}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold tracking-widest font-mono uppercase">
                {department === 'DPSA' ? 'DPSA - DEPARTAMENTO DE POLÍCIA DE SAN ANDREAS' : department === 'DPLS' ? 'DPLS - DEPARTAMENTO DE POLÍCIA DE LOS SANTOS' : 'DBC - DEPARTAMENTO BLAINE COUNTY'}
              </h1>
              <span className="animate-ping w-2 h-2 rounded-full bg-red-500" />
            </div>
            <p className="text-[10px] sm:text-xs text-gray-400 font-mono flex items-center gap-1.5">
              <span>SISTEMA DE FISCALIZAÇÃO & COIMAS</span>
              <span className="text-gray-600">•</span>
              <span className="text-amber-400/90 font-bold">OFFSET PORTUGAL RP</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-neutral-900/95 border border-white/10 rounded-lg p-0.5 text-xs">
            <button onClick={() => setDepartment('DPSA')} className={`px-3.5 py-1.5 rounded-md font-bold uppercase transition-all duration-200 cursor-pointer ${activeHeaderTab('DPSA')}`}>DPSA</button>
            <button onClick={() => setDepartment('DPLS')} className={`px-3.5 py-1.5 rounded-md font-bold uppercase transition-all duration-200 cursor-pointer ${activeHeaderTab('DPLS')}`}>DPLS</button>
            <button onClick={() => setDepartment('DBC')} className={`px-3.5 py-1.5 rounded-md font-bold uppercase transition-all duration-200 cursor-pointer ${activeHeaderTab('DBC')}`}>DBC</button>
          </div>

          <div className="hidden lg:flex items-center gap-2 bg-neutral-900/95 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider text-gray-300">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>{systemTime.toLocaleTimeString('pt-PT')}</span>
          </div>
        </div>
      </header>

      <div className="border-b border-white/10 bg-slate-950/90 px-4 py-3 z-10 relative">
        <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
          <label className="text-sm font-bold text-white">CC Atual:</label>
          <input value={ccAtual} onChange={e => setCcAtual(e.target.value)} className={`${inputCls} !w-40`} />
          <div className="px-3 py-1 rounded-lg bg-neutral-900/80 border border-white/10">
            <span className="text-sm text-gray-400">Extra: <strong className="text-amber-400">{fmt2(totalExtra)} €</strong></span>
            <span className="mx-2 text-gray-600">|</span>
            <span className="text-sm text-gray-400">CAD: <strong className="text-green-400">{fmt2(totalCAD)} €</strong></span>
          </div>
          <button
            onClick={() => setShowEntriesPanel(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/30 text-amber-300 transition-colors cursor-pointer"
            title="Editar / Eliminar entradas registadas"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Editar Entradas</span>
            {allCCsWithEntries.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold">
                {allCCsWithEntries.length}
              </span>
            )}
          </button>
          <button onClick={limparTudo} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-900/40 hover:bg-red-900/60 border border-red-500/20 text-red-300 transition-colors cursor-pointer">Limpar Tudo</button>
        </div>
      </div>

      <div className="border-b border-white/10 bg-slate-950/60 overflow-x-auto z-10 relative">
        <div className="max-w-7xl mx-auto flex">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-3 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all flex items-center gap-2 ${
                activeTab === id
                  ? "border-amber-400 text-amber-400 bg-white/5"
                  : "border-transparent text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full z-10 relative">
        {/* SEQUESTRO */}
        {activeTab === "Sequestro" && (
          <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
            <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2">
              <Shield className={`w-5 h-5 ${accentColor}`} /> Sequestro
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
              <div><label className={labelCls}>Civis:</label><input type="number" value={seqCivis} onChange={e => setSeqCivis(Number(e.target.value))} className={inputCls} /></div>
              <div><label className={labelCls}>Funcionários Públicos:</label><input type="number" value={seqFunc} onChange={e => setSeqFunc(Number(e.target.value))} className={inputCls} /></div>
            </div>
            <button onClick={addSequestro} className={`w-full mt-4 py-3 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${fillBtnTheme} cursor-pointer`}>Calcular e Adicionar</button>
          </div>
        )}

        {activeTab === "Homicídios" && (
          <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
            <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4">Homicídios</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Homicídio Civis</label><input type="number" value={homCivis} onChange={e=>setHomCivis(Number(e.target.value))} className={inputCls}/></div>
              <div><label className={labelCls}>Homicídio Func.</label><input type="number" value={homFunc} onChange={e=>setHomFunc(Number(e.target.value))} className={inputCls}/></div>
            </div>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={homTent} onChange={e=>setHomTent(e.target.checked)}/> Tentativa x0.75</label>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div><label className={labelCls}>Hom. Qualificado Civis</label><input type="number" value={homQCivis} onChange={e=>setHomQCivis(Number(e.target.value))} className={inputCls}/></div>
              <div><label className={labelCls}>Hom. Qualificado Func.</label><input type="number" value={homQFunc} onChange={e=>setHomQFunc(Number(e.target.value))} className={inputCls}/></div>
            </div>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={homQTent} onChange={e=>setHomQTent(e.target.checked)}/> Tentativa x0.75</label>
            <button onClick={addHomicidios} className={`w-full mt-4 py-3 rounded-lg ${fillBtnTheme}`}>Adicionar</button>
          </div>
        )}

        {activeTab === "Dinheiro" && (
          <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
            <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2">
              <Coins className={`w-5 h-5 ${accentColor}`} /> Dinheiro Não Declarado
            </h2>
            <div className="max-w-md"><label className={labelCls}>Valor em dinheiro apreendido (€):</label><input type="number" value={dinheiroValor} onChange={e => setDinheiroValor(Number(e.target.value))} className={inputCls} /></div>
            <button onClick={addDinheiro} className={`w-full mt-4 py-3 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${fillBtnTheme} cursor-pointer`}>Calcular e Adicionar</button>
            <div className="mt-4 p-3 bg-black/30 rounded-lg border border-white/5 max-h-40 overflow-y-auto">
              <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Coimas Extras (CC: {getCc()})</p>
              {(extraPorCC[getCc()] || []).length === 0 ? (
                <p className="text-xs text-gray-500">Nenhuma coima extra para este CC.</p>
              ) : (
                <div className="space-y-1">
                  {(extraPorCC[getCc()] || []).map((entry, idx) => (
                    <div key={idx} className="text-xs text-gray-300 bg-black/20 p-2 rounded">
                      <div className="flex justify-between">
                        <span className="truncate pr-2">{entry.desc}</span>
                        <span className="text-amber-400 font-bold">{fmt2(entry.valor)} €</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "Munição" && (
          <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
            <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2">
              <FlaskConical className={`w-5 h-5 ${accentColor}`} /> Munição
            </h2>
            <p className="text-xs text-gray-500 mb-3">Balas dentro da arma:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mb-4">
              <div><label className={labelCls}>Baixo calibre:</label><input type="number" value={munBalasBaixo} onChange={e => setMunBalasBaixo(Number(e.target.value))} className={inputCls} /></div>
              <div><label className={labelCls}>Médio calibre:</label><input type="number" value={munBalasMedio} onChange={e => setMunBalasMedio(Number(e.target.value))} className={inputCls} /></div>
              <div><label className={labelCls}>Alto calibre:</label><input type="number" value={munBalasAlto} onChange={e => setMunBalasAlto(Number(e.target.value))} className={inputCls} /></div>
            </div>
            <p className="text-xs text-gray-500 mb-3">Carregadores avulsos:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mb-4">
              <div><label className={labelCls}>Baixo calibre:</label><input type="number" value={munCarrBaixo} onChange={e => setMunCarrBaixo(Number(e.target.value))} className={inputCls} /></div>
              <div><label className={labelCls}>Médio calibre:</label><input type="number" value={munCarrMedio} onChange={e => setMunCarrMedio(Number(e.target.value))} className={inputCls} /></div>
              <div><label className={labelCls}>Alto calibre:</label><input type="number" value={munCarrAlto} onChange={e => setMunCarrAlto(Number(e.target.value))} className={inputCls} /></div>
            </div>
            <button onClick={addMunicao} className={`w-full py-3 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${fillBtnTheme} cursor-pointer`}>Calcular e Adicionar</button>
          </div>
        )}

        {activeTab === "Armas G. Qtde" && (
          <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
            <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${accentColor}`} /> Armas em Grande Quantidade
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mb-4">
              <div><label className={labelCls}>Baixo calibre:</label><input type="number" value={armasBaixo} onChange={e => setArmasBaixo(Number(e.target.value))} className={inputCls} /></div>
              <div><label className={labelCls}>Médio calibre:</label><input type="number" value={armasMedio} onChange={e => setArmasMedio(Number(e.target.value))} className={inputCls} /></div>
              <div><label className={labelCls}>Alto calibre:</label><input type="number" value={armasAlto} onChange={e => setArmasAlto(Number(e.target.value))} className={inputCls} /></div>
            </div>
            <button onClick={addArmas} className={`w-full py-3 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${fillBtnTheme} cursor-pointer`}>Calcular e Adicionar</button>
          </div>
        )}

        {/* ITENS ILEGAIS - IMAGENS GRANDES À DIREITA */}
        {activeTab === "Itens Ilegais" && (
          <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
            <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2">
              <Package className={`w-5 h-5 ${accentColor}`} /> Itens Ilegais
            </h2>
            <div className="bg-black/40 rounded-lg border border-white/10 p-3 mb-4">
              <label className={labelCls}>Cálculo Rápido (ex: 10 lockpick, 5 algemas):</label>
              <div className="flex gap-2 mt-1">
                <input value={itensInput} onChange={e => setItensInput(e.target.value)} className={inputCls} placeholder="10 lockpick, 5 algemas" />
                <button onClick={calcItensRapido} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${fillBtnTheme} cursor-pointer`}>Calcular</button>
              </div>
              {itensResultado && <pre className="mt-2 text-xs whitespace-pre-wrap text-amber-400 font-mono">{itensResultado}</pre>}
              {itensTotal && <button onClick={() => { navigator.clipboard.writeText(itensTotal); showAlert("Copiado!"); }} className="mt-2 px-3 py-1 rounded bg-white/10 text-xs text-gray-400 hover:text-white cursor-pointer">Copiar Total</button>}
            </div>
            <div className="mb-3">
              <input value={searchItens} onChange={e => setSearchItens(e.target.value)} className={inputCls} placeholder="Pesquisar item..." />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4">
              {Object.entries(ITENS_ILEGAIS)
                // Estes artigos continuam válidos para o cálculo/coimas rápidas,
                // mas não devem aparecer individualmente na grelha "Itens Ilegais".
                // EXCEÇÃO: se o OCR lhes deu quantidade > 0, aparecem para serem
                // visíveis e ajustáveis (ex.: TV LED 75" detetada no inventário).
                .filter(([item]) => !BENS_ASSALTO_CASA_OCULTOS.has(normalizeText(item)) || (itensQuantidades[item] || 0) > 0)
                .filter(([item]) => !searchItens || normalizeText(item).includes(normalizeText(searchItens)))
                .map(([item, preco]) => {
                  const imgSrc = itemImageSrc(item);
                  return (
                    <div key={item} className="bg-black/40 rounded-lg border border-white/10 p-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <div className="text-xs font-bold text-gray-300">{item}</div>
                          <div className="text-[10px] text-gray-500">{fmt(preco)} €</div>
                        </div>
                        {<img src={imgSrc} alt={item} className="w-16 h-16 object-contain" />}
                      </div>
                      <input
                        type="number"
                        min={0}
                        value={itensQuantidades[item] || 0}
                        onChange={e => setItensQuantidades(prev => ({ ...prev, [item]: Number(e.target.value) }))}
                        className={`${inputCls} !mt-2 text-center text-xs`}
                      />
                    </div>
                  );
                })}
            </div>
            <button onClick={addItensGrid} className={`w-full py-3 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${fillBtnTheme} cursor-pointer`}>Calcular e Adicionar</button>
          </div>
        )}

        {/* DROGAS - IMAGENS GRANDES À ESQUERDA */}
        {activeTab === "Drogas" && (
          <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
            <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2">
              <FlaskConical className={`w-5 h-5 ${accentColor}`} /> Drogas
            </h2>
            <div className="bg-black/40 rounded-lg border border-white/10 p-3 mb-4">
              <label className={labelCls}>Cálculo Rápido (ex: 45 maços, 6 óleos):</label>
              <div className="flex gap-2 mt-1">
                <input value={drogasInput} onChange={e => setDrogasInput(e.target.value)} className={inputCls} placeholder="45 maços, 6 óleos" />
                <button onClick={calcDrogasRapido} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${fillBtnTheme} cursor-pointer`}>Calcular</button>
              </div>
              {drogasResultado && <pre className="mt-2 text-xs whitespace-pre-wrap text-amber-400 font-mono">{drogasResultado}</pre>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              {Object.keys(PRECOS_DROGAS).map(droga => {
                const imgSrc = itemImageSrc(droga);
                return (
                  <div key={droga} className="bg-black/40 rounded-lg border border-white/10 p-3">
                    <div className="flex items-center gap-3">
                      {<img src={imgSrc} alt={droga} className="w-16 h-16 object-contain" />}
                      <div className="flex-1">
                        <label className="text-xs font-bold text-gray-300">{droga}:</label>
                        <div className="text-[10px] text-amber-400/70">{fmt(PRECOS_DROGAS[droga])} €</div>
                      </div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={drogasQuantidades[droga] || 0}
                      onChange={e => setDrogasQuantidades(prev => ({ ...prev, [droga]: Number(e.target.value) }))}
                      className={`${inputCls} mt-2`}
                    />
                  </div>
                );
              })}
            </div>
            <button onClick={addDrogasGrid} className={`w-full py-3 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${fillBtnTheme} cursor-pointer`}>Calcular e Adicionar</button>
          </div>
        )}

        {activeTab === "Mediação/Tentativa" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2"><Scale className={`w-5 h-5 ${accentColor}`} /> Mediação</h2>
              <div className="space-y-3">
                <div><label className={labelCls}>Coima original (CAD):</label><input type="number" value={medCoima} onChange={e => setMedCoima(Number(e.target.value))} className={inputCls} /></div>
                <div><label className={labelCls}>Meses originais:</label><input type="number" value={medMeses} onChange={e => setMedMeses(Number(e.target.value))} className={inputCls} /></div>
                <div><label className={labelCls}>Percentagem da coima (%):</label><input type="number" value={medPercCoima} onChange={e => setMedPercCoima(Number(e.target.value))} className={inputCls} /></div>
                <div><label className={labelCls}>Percentagem da sentença (%):</label><input type="number" value={medPercMeses} onChange={e => setMedPercMeses(Number(e.target.value))} className={inputCls} /></div>
              </div>
              <button onClick={calcMediacao} className={`w-full mt-4 py-3 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${fillBtnTheme} cursor-pointer`}>Calcular Mediação</button>
            </div>
            <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2"><Gavel className={`w-5 h-5 ${accentColor}`} /> Tentativa de Crime (75%)</h2>
              <div><label className={labelCls}>Valor do crime consumado:</label><input type="number" value={tentValor} onChange={e => setTentValor(Number(e.target.value))} className={inputCls} /></div>
              <button onClick={calcTentativa} className={`w-full mt-4 py-3 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${fillBtnTheme} cursor-pointer`}>Calcular Tentativa</button>
            </div>
          </div>
        )}

        {activeTab === "Velocidade/EPI" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2"><Car className={`w-5 h-5 ${accentColor}`} /> Excesso de Velocidade</h2>
              <div className="space-y-3">
                <div><label className={labelCls}>Limite de velocidade (km/h):</label><input type="number" value={velLimite} onChange={e => setVelLimite(Number(e.target.value))} className={inputCls} /></div>
                <div><label className={labelCls}>Velocidade registada (km/h):</label><input type="number" value={velRegistrada} onChange={e => setVelRegistrada(Number(e.target.value))} className={inputCls} /></div>
              </div>
              <button onClick={() => {
                if (velRegistrada <= velLimite + 5) setVelResultado("Sem multa (dentro do limite + 5km/h de tolerância)");
                else { const excesso = velRegistrada - velLimite - 5; const blocos = Math.ceil(excesso / 10); const total = Math.min(3000 + blocos * 1500, 10000); setVelResultado(`Multa: ${fmt2(total)} € (Excesso: ${excesso} km/h, ${blocos} bloco(s))`); }
              }} className={`w-full mt-4 py-3 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${fillBtnTheme} cursor-pointer`}>Calcular Multa</button>
              {velResultado && <div className={`mt-3 p-3 rounded-lg text-xs ${velResultado.includes("Sem") ? "bg-green-900/30 text-green-400" : "bg-amber-900/30 text-amber-400"}`}>{velResultado}</div>}
            </div>
            <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2"><ShieldAlert className={`w-5 h-5 ${accentColor}`} /> Falta de EPI</h2>
              <div className="space-y-2">
                {[{ label: "Colete Refletor", val: epiColete, set: setEpiColete }, { label: "Capacete (mineiros)", val: epiCapacete, set: setEpiCapacete }, { label: "Botas biqueira aço", val: epiBotas, set: setEpiBotas }, { label: "Calças largas", val: epiCalcas, set: setEpiCalcas }, { label: "Máscara proteção", val: epiMascara, set: setEpiMascara }].map(({ label, val, set }) => (
                  <label key={label} className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-white"><input type="checkbox" checked={val} onChange={e => set(e.target.checked)} className="accent-amber-500" /> {label}</label>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 mt-2">Nota: Cada peça em falta = 2.500€, máximo 12.500€</p>
              <button onClick={() => { const falta = [epiColete, epiCapacete, epiBotas, epiCalcas, epiMascara].filter(v => !v).length; const total = Math.min(falta * 2500, 12500); setEpiResultado(falta === 0 ? "Todas presentes. Sem multa." : `Multa: ${fmt2(total)} € (${falta} peça(s) x 2.500€)`); }} className={`w-full mt-3 py-3 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${fillBtnTheme} cursor-pointer`}>Calcular Multa</button>
              {epiResultado && <div className={`mt-3 p-3 rounded-lg text-xs ${epiResultado.includes("Todas") ? "bg-green-900/30 text-green-400" : "bg-amber-900/30 text-amber-400"}`}>{epiResultado}</div>}
            </div>
          </div>
        )}

        {activeTab === "Catálogo" && (
          <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
            <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2"><BookOpen className={`w-5 h-5 ${accentColor}`} /> Catálogo de Crimes</h2>
            <div className="flex gap-2 mb-4">
              <input value={searchCrime} onChange={e => setSearchCrime(e.target.value)} className={inputCls} placeholder="Pesquisar crime..." />
              <button onClick={() => setSearchCrime("")} className="px-3 py-2 rounded bg-white/10 text-xs text-gray-400 hover:text-white cursor-pointer">Limpar</button>
              <button onClick={addCrimesCatalogo} className={`px-4 py-2 rounded text-xs font-bold uppercase ${fillBtnTheme} cursor-pointer`}>Adicionar</button>
            </div>
            <div className="overflow-auto max-h-[60vh] rounded border border-white/10">
              <table className="w-full text-xs font-mono">
                <thead className="bg-neutral-900 sticky top-0">
                  <tr><th className="p-2 text-left w-8"><input type="checkbox" onChange={e => handleSelectAllCrimes(e.target.checked)} checked={selectedCrimes.size > 0} /></th><th className="p-2 text-left">Categoria</th><th className="p-2 text-left">Crime</th><th className="p-2 text-center">Meses</th><th className="p-2 text-right">Multa</th></tr>
                </thead>
                <tbody>
                  {filteredCrimes.map((c) => {
                    const realIdx = allCrimes.indexOf(c);
                    return (
                      <tr key={realIdx} className={`border-t border-white/5 ${selectedCrimes.has(realIdx) ? "bg-amber-900/20" : ""} hover:bg-white/5`}>
                        <td className="p-2"><input type="checkbox" checked={selectedCrimes.has(realIdx)} onChange={e => { const next = new Set(selectedCrimes); e.target.checked ? next.add(realIdx) : next.delete(realIdx); setSelectedCrimes(next); }} /></td>
                        <td className="p-2 text-gray-400">{c.categoria}</td>
                        <td className="p-2">{c.nome}</td>
                        <td className="p-2 text-center">{c.meses}</td>
                        <td className="p-2 text-right text-amber-400">{fmt(c.multa)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "Perfis" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-3">Perfis Guardados</h2>
              <div className="space-y-1 mb-3 max-h-96 overflow-auto">
                {Object.keys(perfis).map(nome => <button key={nome} onClick={() => setSelectedPerfil(nome)} className={`w-full text-left px-3 py-2 rounded text-xs font-mono transition-colors cursor-pointer ${selectedPerfil === nome ? "bg-amber-600 text-white" : "bg-black/40 hover:bg-white/10 text-gray-400"}`}>{nome}</button>)}
              </div>
              <div className="flex gap-2"><button onClick={novoPerfil} className="px-3 py-1.5 rounded bg-white/10 text-xs text-gray-300 hover:text-white cursor-pointer">Novo</button><button onClick={eliminarPerfil} className="px-3 py-1.5 rounded bg-red-900/40 text-xs text-red-300 hover:bg-red-900/60 cursor-pointer">Eliminar</button></div>
            </div>
            <div className={`md:col-span-2 bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-3">Crimes no Perfil: {selectedPerfil || "—"}</h2>
              {perfilCrimes.length === 0 ? <p className="text-xs text-gray-500">Nenhum crime.</p> : (
                <div className="space-y-1 mb-3 max-h-64 overflow-auto">
                  {perfilCrimes.map((c, idx) => <div key={idx} className="flex justify-between items-center px-3 py-2 rounded bg-black/40"><span className="text-xs text-gray-300">{c.crime}</span><div className="flex items-center gap-2"><span className="text-xs font-bold text-amber-400">{fmt(c.multa)} €</span><button onClick={() => removePerfilCrime(idx)} className="text-red-500 text-xs hover:underline cursor-pointer">✕</button></div></div>)}
                </div>
              )}
              <p className="text-right font-bold mb-3 text-amber-400">Total: {fmt2(perfilTotal)} €</p>
              <div className="flex gap-2"><button onClick={aplicarPerfil} className={`px-4 py-2 rounded text-xs font-bold uppercase ${fillBtnTheme} cursor-pointer`}>Aplicar Perfil</button><button onClick={() => setActiveTab("Catálogo")} className="px-3 py-2 rounded bg-white/10 text-xs text-gray-400 hover:text-white cursor-pointer">Ir ao Catálogo</button></div>
            </div>
          </div>
        )}

        {activeTab === "Coimas Rápidas PT" && (
          <div className="space-y-4">
            {/* ══════ ANÁLISE DE FOTO (OCR) — NOVO ══════ */}
            <OcrBlock
              inputCls={inputCls}
              fillBtnTheme={fillBtnTheme}
              neonShadow={neonShadow}
              accentColor={accentColor}
              mode="coimas"
              onResult={(txt: string) => setTesteInput(txt)}
            />

            {/* ══════ CALCULADORA ORIGINAL ══════ */}
            <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2"><Calculator className={`w-5 h-5 ${accentColor}`} /> Coimas Rápidas Portugal</h2>
              <p className="text-xs text-gray-500 mb-2">Escreva quantidade e item (ex: 45 maços). Para vários, separe por vírgulas.</p>
              <div className="flex gap-2 mb-4">
                <input value={testeInput} onChange={e => setTesteInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") calcularTeste(); }} className={inputCls} placeholder="45 maços, 6 óleos, 100 balas baixo..." />
                <button onClick={calcularTeste} className={`px-4 py-2 rounded text-xs font-bold uppercase ${fillBtnTheme} cursor-pointer`}>Calcular</button>
                <button onClick={() => setTesteHistorico([])} className="px-3 py-2 rounded bg-white/10 text-xs text-gray-400 hover:text-white cursor-pointer">Limpar</button>
              </div>
              <div className="rounded-lg border border-white/10 p-4 max-h-96 overflow-auto bg-black/60 font-mono text-xs text-green-400"><pre>{testeHistorico.join("\n" + "—".repeat(50) + "\n\n") || "// Resultados aparecerão aqui..."}</pre></div>
            </div>
          </div>
        )}

        {/* RELATÓRIO - APENAS COM VALOR DO CAD RESTAURADO */}
        {activeTab === "Relatório" && (
          <div className="space-y-4">
            <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4">📝 Dados da Ocorrência</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelCls}>Tipo de crime:</label>
                  <select value={relTipo} onChange={e => setRelTipo(e.target.value)} className={inputCls}>
                    <option>Assalto a loja</option>
                    <option>Assalto a casa</option>
                    <option>Assalto a joalharia</option>
                    <option>Assalto a banco</option>
                    <option>Assalto a AmmuNation</option>
                    <option>Assalto a contentor</option>
                    <option>Produção de droga</option>
                    <option>Outro</option>
                  </select>
                </div>
                <div><label className={labelCls}>Número de assaltantes / sujeitos:</label><input type="number" value={relAssaltantes} onChange={e => setRelAssaltantes(Number(e.target.value))} className={inputCls} /></div>
                <div><label className={labelCls}>Número de reféns (civis):</label><input type="number" value={relCivis} onChange={e => setRelCivis(Number(e.target.value))} className={inputCls} /></div>
                <div><label className={labelCls}>Funcionários Públicos:</label><input type="number" value={relFunc} onChange={e => setRelFunc(Number(e.target.value))} className={inputCls} /></div>
                <div><label className={labelCls}>CP (Código Postal/Processo):</label><input value={relCP} onChange={e => setRelCP(e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Observações:</label><input value={relObs} onChange={e => setRelObs(e.target.value)} className={inputCls} /></div>
              </div>
            </div>

            {/* ===== SECÇÃO VALOR DO CAD ===== */}
            <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4">📋 Valor do CAD</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div><label className={labelCls}>CC:</label><input value={relCCCAD} onChange={e => setRelCCCAD(e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Meses:</label><input type="number" value={relMesesCAD} onChange={e => setRelMesesCAD(Number(e.target.value))} className={inputCls} /></div>
                <div><label className={labelCls}>Valor (€):</label><input type="number" value={relValorCAD} onChange={e => setRelValorCAD(Number(e.target.value))} className={inputCls} /></div>
                <div className="flex items-end"><button onClick={addValorCAD} className={`w-full py-2 rounded text-xs font-bold uppercase ${fillBtnTheme} cursor-pointer`}>Adicionar</button></div>
              </div>
            </div>

            {/* ===== OCR / EVIDÊNCIA DO INVENTÁRIO POR CC ===== */}
            <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-2 flex items-center gap-2">
                🔍 OCR de Evidência por CC
              </h2>
              <p className="text-[10px] text-gray-500 mb-4">
                Escolhe o CC e usa o mesmo OCR das Coimas Rápidas. O resultado fica associado ao CC e é usado automaticamente nas Coimas Extras do relatório.
              </p>
              <div className="mb-4">
                <label className={labelCls}>CC da evidência OCR:</label>
                <input
                  value={relOcrCC}
                  onChange={e => setRelOcrCC(e.target.value)}
                  className={inputCls}
                  placeholder="222"
                />
              </div>
              <OcrBlock
                inputCls={inputCls}
                fillBtnTheme={fillBtnTheme}
                neonShadow={neonShadow}
                accentColor={accentColor}
                onResult={(txt: string) => {
                  const cc = relOcrCC.trim();
                  if (!cc) {
                    showAlert("Indique primeiro o CC da evidência OCR.");
                    return;
                  }
                  const parsed = parseQuickInput(txt);
                  setRelOcrPorCC(prev => ({
                    ...prev,
                    [cc]: prev[cc] ? `${prev[cc]}, ${txt}` : txt,
                  }));
                  const detected: string[] = [];
                  if (parsed.itens.resultados.length) detected.push(...parsed.itens.resultados.map(x => x.trim()));
                  if (parsed.armas.resultados.length) detected.push(...parsed.armas.resultados.map(x => x.trim()));
                  if (parsed.municao.resultados.length) detected.push(...parsed.municao.resultados.map(x => x.trim()));
                  if (parsed.dinheiro.resultados.length) detected.push(...parsed.dinheiro.resultados.map(x => x.trim()));
                  const ocrExtraTotalPreview = parsed.itens.subtotal + parsed.drogas.subtotal + parsed.municao.total + parsed.dinheiro.total + ocrArmasGrande(parsed).total;
                  if (detected.length) {
                    showAlert(`CC ${cc}: detetado(s) ${detected.join("; ")} → total ${fmt2(ocrExtraTotalPreview)} €.`);
                  } else {
                    showAlert(`OCR associado ao CC '${cc}', mas não foram encontrados itens com coima.`);
                  }
                }}
              />
              {Object.keys(relOcrPorCC).length > 0 && (
                <div className="mt-4 space-y-2">
                  {Object.entries(relOcrPorCC).map(([cc, txt]) => (
                    <div key={cc} className="rounded border border-white/5 bg-black/30 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white">CC: {cc}</span>
                        <button
                          onClick={() => setRelOcrPorCC(prev => {
                            const next = { ...prev };
                            delete next[cc];
                            return next;
                          })}
                          className="ml-auto text-red-400 hover:text-red-300 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="text-gray-300 font-mono whitespace-pre-wrap">
                        {(() => {
                          const parsed = parseQuickInput(txt);
                          const detected = [
                            ...parsed.itens.resultados.map(x => x.trim()),
                            ...parsed.armas.resultados.map(x => x.trim()),
                            ...parsed.municao.resultados.map(x => x.trim()),
                            ...parsed.dinheiro.resultados.map(x => x.trim()),
                          ];
                          return detected.length ? detected.join("\n") : txt;
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CC dos Suspeitos */}
            <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4">👥 CC dos Suspeitos (um por linha)</h2>
              <textarea value={relCCs} onChange={e => setRelCCs(e.target.value)} rows={4} className={inputCls} placeholder={"222\n333"} />
            </div>

            {/* Mediação */}
            <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4">🤝 Mediação</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={labelCls}>Advogado:</label><input value={relAdvogado} onChange={e => setRelAdvogado(e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>% Coima:</label><input type="number" value={relPercCoima} onChange={e => setRelPercCoima(Number(e.target.value))} className={inputCls} /></div>
                <div><label className={labelCls}>% Sentença:</label><input type="number" value={relPercSentenca} onChange={e => setRelPercSentenca(Number(e.target.value))} className={inputCls} /></div>
              </div>
            </div>

            {/* Entradas Registadas */}
            {allCCsWithEntries.length > 0 && (
              <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 flex items-center gap-2"><Pencil className="w-4 h-4 text-amber-400" /> Entradas Registadas ({allCCsWithEntries.length} CC)</h2>
                  <button onClick={() => setShowEntriesPanel(true)} className="flex items-center gap-1 px-3 py-1.5 rounded bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/30 text-amber-300 text-xs font-bold transition-colors cursor-pointer"><Pencil className="w-3 h-3" /> Editar / Eliminar</button>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {allCCsWithEntries.map(cc => {
                    const cadEntries = cadPorCC[cc] || [];
                    const extraEntries = extraPorCC[cc] || [];
                    const totalCadCC = cadEntries.reduce((s, e) => s + e.multa, 0);
                    const totalExtraCC = extraEntries.reduce((s, e) => s + e.valor, 0);
                    const totalMesesCC = cadEntries.reduce((s, e) => s + e.meses, 0);
                    return (
                      <div key={cc} className="bg-black/30 rounded-lg border border-white/5 px-4 py-3">
                        <div className="flex items-center justify-between"><span className="text-xs font-bold text-white">CC: {cc}</span><div className="flex gap-3 text-[10px]"><span className="text-green-400">CAD: {fmt2(totalCadCC)} € ({cadEntries.length})</span><span className="text-amber-400">Extra: {fmt2(totalExtraCC)} € ({extraEntries.length})</span><span className="text-white font-bold">Total: {fmt2(totalCadCC + totalExtraCC)} €</span>{totalMesesCC > 0 && <span className="text-blue-400">{totalMesesCC.toFixed(1)} meses</span>}</div></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-3">
              <button onClick={gerarRelatorio} className={`px-6 py-3 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${fillBtnTheme} cursor-pointer`}>Gerar Relatório</button>
              <button onClick={copiarRelatorio} className="px-4 py-3 rounded-lg bg-white/10 text-xs text-gray-300 hover:text-white hover:bg-white/20 cursor-pointer">Copiar Relatório</button>
              <button onClick={() => setRelatorio("")} className="px-3 py-3 rounded bg-white/10 text-xs text-gray-400 hover:text-white cursor-pointer">Limpar</button>
            </div>

            {/* Output */}
            {relatorio && (
              <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
                <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4">📄 Relatório Gerado</h2>
                <div className="rounded-lg border border-white/10 p-4 bg-black/60 max-h-96 overflow-auto"><pre className="text-xs whitespace-pre-wrap font-mono text-green-400">{relatorio}</pre></div>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="border-t border-white/5 bg-slate-950 py-3 text-center text-[10px] text-gray-500 font-mono z-10 relative">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span className="flex items-center justify-center sm:justify-start gap-1"><ShieldAlert className="w-4 h-4 text-red-500/80 animate-pulse" /><span>PORTAL OFICIAL DE SEGURANÇA RODOVIÁRIA • OFFSET PORTUGAL ROLEPLAY</span></span>
          <span className="opacity-60">© {systemTime.getFullYear()} {department} Los Santos • Codificação UTF-8</span>
        </div>
      </footer>
    </div>
  );
}