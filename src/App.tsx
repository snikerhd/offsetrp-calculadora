import { useState, useEffect, useRef, useCallback } from "react";
import {
  Shield, Clock, ShieldAlert, BookOpen, Layers, Calculator, Car,
  Coins, Package, FlaskConical, AlertTriangle, Scale, FileSpreadsheet, Gavel,
  Pencil
} from "lucide-react";
import {
  ITENS_ILEGAIS, PRECOS_DROGAS,
} from "./data";
import {
  normalizeText, fmt, fmt2, cap, calcSequestro, calcMunicao,
  calcArmasGrandeQtde, calcItensIlegais, calcDroga,
  obterItemPorSinonimo, obterDrogaPorSinonimo, parseQuickInput, parseCrimesInput, getAllCrimesFlat,
} from "./utils";
import EntriesPanel from "./EntriesPanel";

// Types
interface CadEntry { desc: string; meses: number; multa: number; }
interface ExtraEntry { desc: string; valor: number; }
interface ProfileCrime { crime: string; multa: number; }

// Edit state for CAD (strings for numeric fields so user can freely type)
interface EditingCAD {
  cc: string;
  index: number;
  desc: string;
  meses: string;
  multa: string;
}

// Edit state for Extra
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
  { id: "Relatório", icon: FileSpreadsheet, label: "Relatório" },
];

type Department = 'DPSA' | 'DPLS' | 'DBC';

export default function App() {
  const [activeTab, setActiveTab] = useState("Coimas Rápidas PT");
  const [department, setDepartment] = useState<Department>('DPLS');
  
  // Usar ref para o tempo para evitar re-renderizações desnecessárias
  const [systemTime, setSystemTime] = useState(new Date());
  const systemTimeRef = useRef(new Date());

  const [ccAtual, setCcAtual] = useState("Geral");
  const [cadPorCC, setCadPorCC] = useState<Record<string, CadEntry[]>>({});
  const [extraPorCC, setExtraPorCC] = useState<Record<string, ExtraEntry[]>>({});

  // Editing states
  const [editingCAD, setEditingCAD] = useState<EditingCAD | null>(null);
  const [editingExtra, setEditingExtra] = useState<EditingExtra | null>(null);
  const [showEntriesPanel, setShowEntriesPanel] = useState(false);

  // Profiles
  const [perfis, setPerfis] = useState<Record<string, ProfileCrime[]>>({});
  const [selectedPerfil, setSelectedPerfil] = useState<string | null>(null);

  // Sequestro
  const [seqCivis, setSeqCivis] = useState(0);
  const [seqFunc, setSeqFunc] = useState(0);

  // Dinheiro
  const [dinheiroValor, setDinheiroValor] = useState(0);

  // Munição
  const [munBalasBaixo, setMunBalasBaixo] = useState(0);
  const [munBalasMedio, setMunBalasMedio] = useState(0);
  const [munBalasAlto, setMunBalasAlto] = useState(0);
  const [munCarrBaixo, setMunCarrBaixo] = useState(0);
  const [munCarrMedio, setMunCarrMedio] = useState(0);
  const [munCarrAlto, setMunCarrAlto] = useState(0);

  // Armas
  const [armasBaixo, setArmasBaixo] = useState(0);
  const [armasMedio, setArmasMedio] = useState(0);
  const [armasAlto, setArmasAlto] = useState(0);

  // Itens
  const [itensInput, setItensInput] = useState("");
  const [itensResultado, setItensResultado] = useState("");
  const [itensTotal, setItensTotal] = useState("");
  const [searchItens, setSearchItens] = useState("");
  const [itensQuantidades, setItensQuantidades] = useState<Record<string, number>>({});

  // Drogas
  const [drogasInput, setDrogasInput] = useState("");
  const [drogasResultado, setDrogasResultado] = useState("");
  const [drogasQuantidades, setDrogasQuantidades] = useState<Record<string, number>>({});

  // Mediação
  const [medCoima, setMedCoima] = useState(0);
  const [medMeses, setMedMeses] = useState(0);
  const [medPercCoima, setMedPercCoima] = useState(100);
  const [medPercMeses, setMedPercMeses] = useState(100);
  const [tentValor, setTentValor] = useState(0);

  // Catálogo
  const [searchCrime, setSearchCrime] = useState("");
  const [selectedCrimes, setSelectedCrimes] = useState<Set<number>>(new Set());

  // Testes
  const [testeInput, setTesteInput] = useState("");
  const [testeHistorico, setTesteHistorico] = useState<string[]>([]);

  // Relatório
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
  const [relCCCoima, setRelCCCoima] = useState("");
  const [relCoimaRapida, setRelCoimaRapida] = useState("");
  const [relCCCrimesNome, setRelCCCrimesNome] = useState("");
  const [relCrimesNome, setRelCrimesNome] = useState("");
  const [relTentativa, setRelTentativa] = useState(false);
  const [relCCCAD, setRelCCCAD] = useState("");
  const [relMesesCAD, setRelMesesCAD] = useState(0);
  const [relValorCAD, setRelValorCAD] = useState(0);

  // Velocidade e EPI
  const [velLimite, setVelLimite] = useState(50);
  const [velRegistrada, setVelRegistrada] = useState(0);
  const [velResultado, setVelResultado] = useState("");
  const [epiColete, setEpiColete] = useState(false);
  const [epiCapacete, setEpiCapacete] = useState(false);
  const [epiBotas, setEpiBotas] = useState(false);
  const [epiCalcas, setEpiCalcas] = useState(false);
  const [epiMascara, setEpiMascara] = useState(false);
  const [epiResultado, setEpiResultado] = useState("");

  // Alert
  const [alertMsg, setAlertMsg] = useState("");
  const alertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load profiles from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("perfis_coimas");
      if (saved) setPerfis(JSON.parse(saved));
    } catch { /* empty */ }
  }, []);

  // System clock - agora só atualiza o ref, não causa re-render
  useEffect(() => {
    const timer = setInterval(() => {
      systemTimeRef.current = new Date();
      // Atualizar state apenas uma vez por segundo para o relógio do header
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

  // All CCs that have entries
  const allCCsWithEntries = Array.from(
    new Set([...Object.keys(cadPorCC), ...Object.keys(extraPorCC)])
  ).filter(cc => (cadPorCC[cc]?.length || 0) > 0 || (extraPorCC[cc]?.length || 0) > 0);

  // Theme colors based on department
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

  // ========== TAB: SEQUESTRO ==========
  const addSequestro = () => {
    const multa = calcSequestro(seqCivis, seqFunc);
    if (multa > 0) {
      const cc = getCc();
      addExtra(cc, `Sequestro: ${seqCivis} civis, ${seqFunc} func. → ${fmt2(multa)} €`, multa);
      showAlert(`Multa de ${fmt2(multa)} € adicionada para CC ${cc}.`);
      setSeqCivis(0); setSeqFunc(0);
    } else showAlert("Nenhum refém informado.");
  };

  // ========== TAB: DINHEIRO ==========
  const addDinheiro = () => {
    if (dinheiroValor <= 10000) { showAlert("Quantidade Legal"); return; }
    const multa = dinheiroValor * 0.75;
    const cc = getCc();
    addExtra(cc, `Dinheiro não declarado: ${fmt2(dinheiroValor)} € → multa ${fmt2(multa)} €`, multa);
    showAlert(`Multa de ${fmt2(multa)} € adicionada para CC ${cc}.`);
    setDinheiroValor(0);
  };

  // ========== TAB: MUNIÇÃO ==========
  const addMunicao = () => {
    const multa = calcMunicao(munBalasBaixo, munBalasMedio, munBalasAlto, munCarrBaixo, munCarrMedio, munCarrAlto);
    if (multa > 0) {
      const cc = getCc();
      let desc = "Munição:\n";
      if (munBalasBaixo > 0) desc += `  ${munBalasBaixo} balas baixo calibre x 500 € = ${fmt(munBalasBaixo * 500)} €\n`;
      if (munBalasMedio > 0) desc += `  ${munBalasMedio} balas médio calibre x 1.000 € = ${fmt(munBalasMedio * 1000)} €\n`;
      if (munBalasAlto > 0) desc += `  ${munBalasAlto} balas alto calibre x 1.500 € = ${fmt(munBalasAlto * 1500)} €\n`;
      if (munCarrBaixo > 0) desc += `  ${munCarrBaixo} carregador baixo calibre x 2.000 € = ${fmt(munCarrBaixo * 2000)} €\n`;
      if (munCarrMedio > 0) desc += `  ${munCarrMedio} carregador médio calibre x 4.000 € = ${fmt(munCarrMedio * 4000)} €\n`;
      if (munCarrAlto > 0) desc += `  ${munCarrAlto} carregador alto calibre x 6.000 € = ${fmt(munCarrAlto * 6000)} €\n`;
      desc = desc.trimEnd();
      addExtra(cc, desc, multa);
      showAlert(`Multa de ${fmt2(multa)} € adicionada para CC ${cc}.`);
      setMunBalasBaixo(0); setMunBalasMedio(0); setMunBalasAlto(0);
      setMunCarrBaixo(0); setMunCarrMedio(0); setMunCarrAlto(0);
    } else showAlert("Nenhuma munição informada.");
  };

  // ========== TAB: ARMAS ==========
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

  // ========== TAB: ITENS ==========
  const calcItensRapido = () => {
    const texto = itensInput.trim();
    if (!texto) { showAlert("Digite uma lista de itens"); return; }
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
      const nome = m[2].trim().toLowerCase();
      const item = obterItemPorSinonimo(nome);
      if (item) {
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

  // ========== TAB: DROGAS ==========
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

  // ========== TAB: MEDIAÇÃO ==========
  const calcMediacao = () => {
    const nc = medCoima * (medPercCoima / 100);
    const nm = medMeses * (medPercMeses / 100);
    showAlert(`Após mediação:\nCoima: ${fmt2(nc)} €\nMeses: ${nm.toFixed(1)} meses`);
  };
  const calcTentativa = () => {
    showAlert(`Valor da tentativa: ${fmt2(tentValor * 0.75)} €`);
  };

  // ========== TAB: CATÁLOGO ==========
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

  // ========== TAB: PERFIS ==========
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

  // ========== TAB: COIMAS RÁPIDAS PT ==========
  const calcularTeste = () => {
    const texto = testeInput.trim();
    if (!texto) { showAlert("Digite algo no formato: quantidade item"); return; }
    const r = parseQuickInput(texto);
    let msg = `> ${texto}\n`;
    
    if (r.drogas.resultados.length) {
      msg += "--- DROGAS ---\n" + r.drogas.resultados.join("\n") + `\nTOTAL DROGAS: ${fmt2(r.drogas.subtotal)} €\n\n`;
    }
    if (r.itens.resultados.length) {
      msg += "--- ITENS ILEGAIS (base 30 000€) ---\n" + r.itens.resultados.join("\n") + `\nTOTAL ITENS: ${fmt2(30000 + r.itens.subtotal)} €\n\n`;
    }
    if (r.municao.resultados.length) {
      msg += "--- MUNIÇÃO ---\n";
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
    if (r.drogas.resultados.length || r.itens.resultados.length || r.municao.resultados.length || r.armas.resultados.length || r.dinheiro.resultados.length || r.sequestro.resultados.length || r.crimes.resultados.length) {
      msg += `TOTAL GERAL: ${fmt2(r.totalGeral)} €`;
    } else {
      msg = "Nenhum item válido foi reconhecido.";
    }
    if (r.erros.length) msg += "\n\nERROS:\n" + r.erros.join("\n");
    setTesteHistorico(prev => [...prev, msg]);
    setTesteInput("");
  };

  // ========== TAB: RELATÓRIO ==========
  const addValorCAD = () => {
    const cc = relCCCAD.trim();
    if (!cc) { showAlert("Indique o CC."); return; }
    addCAD(cc, `Valor recomendado CAD: ${fmt2(relValorCAD)} €`, relMesesCAD, relValorCAD);
    setRelCCCAD(""); setRelMesesCAD(0); setRelValorCAD(0);
    showAlert(`Valor de ${fmt2(relValorCAD)} € e ${relMesesCAD} meses adicionados ao CAD do CC '${cc}'.`);
  };

  const addCoimasRapidasRelatorio = () => {
    const texto = relCoimaRapida.trim();
    const cc = relCCCoima.trim() || "Geral";
    if (!texto) { showAlert("Digite a lista de coimas rápidas."); return; }

    const r = parseQuickInput(texto);
    if (r.totalGeral === 0) { showAlert("Nenhuma coima válida calculada."); return; }

    const blocos: string[] = [];
    if (r.drogas.subtotal > 0) blocos.push(`• Drogas: ${fmt(r.drogas.subtotal)} €`);
    if (r.itens.subtotal > 0) blocos.push(`• Itens Ilegais: ${fmt(30000 + r.itens.subtotal)} €`);
    if (r.municao.total > 0) blocos.push(`• Munição: ${fmt(r.municao.base + r.municao.total)} €`);
    if (r.armas.total > 0) blocos.push(`• Armas Grande Qtde: ${fmt(r.armas.total)} €`);
    if (r.dinheiro.total > 0) blocos.push(`• Dinheiro não declarado: ${fmt(r.dinheiro.total)} €`);
    if (r.sequestro.total > 0) blocos.push(`• Sequestro: ${fmt(r.sequestro.total)} €`);
    if (r.crimes.totalMulta > 0) blocos.push(`• Crimes: ${fmt(r.crimes.totalMulta)} €`);

    const blocoCompleto = blocos.join("\n");
    addExtra(cc, blocoCompleto, r.totalGeral);
    setRelCoimaRapida(""); setRelCCCoima("");
    showAlert(`Coimas extras no valor de ${fmt2(r.totalGeral)} € para CC '${cc}'.`);
  };

  const addCrimesPorNome = () => {
    const texto = relCrimesNome.trim();
    const cc = relCCCrimesNome.trim() || "Geral";
    if (!texto) { showAlert("Digite a lista de crimes."); return; }
    const { descricoes, totalMulta, totalMeses } = parseCrimesInput(texto, relTentativa);
    if (totalMulta === 0 && !descricoes.some(d => d.includes("⚠️"))) {
      showAlert("Nenhum crime válido identificado."); return;
    }
    addCAD(cc, descricoes.join("\n"), totalMeses, totalMulta);
    setRelCrimesNome(""); setRelCCCrimesNome(""); setRelTentativa(false);
    showAlert(`Crimes adicionados ao CAD do CC '${cc}'. Total: ${fmt2(totalMulta)} €, ${totalMeses.toFixed(1)} meses`);
  };

  const gerarRelatorio = () => {
    const ccs = relCCs.trim().split("\n").map(l => l.trim()).filter(Boolean);
    const linhas: string[] = [];

    linhas.push("📝 Resumo:");
    if (relCP) linhas.push(`${relTipo} (cp da ${relCP}), tinha ${relAssaltantes} assaltante e ${relCivis} reféns civis e ${relFunc} funcionários públicos.`);
    else linhas.push(`${relTipo}, tinha ${relAssaltantes} assaltante e ${relCivis} reféns civis e ${relFunc} funcionários públicos.`);
    linhas.push(relObs);
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
      const sequestroMultaRel = calcSequestro(relCivis, relFunc);
      
      if (extraEntries.length || sequestroMultaRel > 0) {
        for (const entry of extraEntries) {
          linhas.push(`  ${entry.desc}`);
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

      const totalCC = cadEntries.reduce((s, e) => s + e.multa, 0) + extraEntries.reduce((s, e) => s + e.valor, 0) + sequestroMultaRel;
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
    linhas.push(`Mediação ao cargo da ${relAdvogado} devido ao facto de não se encontrarem advogados presentes ao serviço no momento da detenção. A mediação foi efetuada após acordo mútuo entre ambas as partes, sendo a coima ajustada para ${relPercCoima}% e a sentença ajustada para ${relPercSentenca}% do valor original.`);
    linhas.push("");

    for (const cc of ccs) {
      const cadEntries = cadPorCC[cc] || [];
      const extraEntries = extraPorCC[cc] || [];
      const sequestroMultaRel = calcSequestro(relCivis, relFunc);
      const totalExtras = extraEntries.reduce((s, e) => s + e.valor, 0);
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
      setCcAtual("Geral");
      setRelatorio("");
      showAlert("Todos os dados foram limpos.");
    }
  };

  // Input/Button styles
  const inputCls = `w-full px-3 py-2 bg-black/40 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-white/30 font-mono`;
  const labelCls = "block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1";

  // Total calculations
  const totalExtra = (extraPorCC[getCc()] || []).reduce((s, e) => s + e.valor, 0);
  const totalCAD = (cadPorCC[getCc()] || []).reduce((s, e) => s + e.multa, 0);

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgGradient} text-white font-sans flex flex-col justify-between relative selection:bg-white/20 overflow-x-hidden`}>
      
      {/* Entries Panel Modal - agora é um componente separado */}
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

      {/* Top flashing light bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 flex z-50">
        <div className={`flex-1 transition-all duration-1000 ${department === 'DPSA' ? 'bg-amber-600 animate-pulse' : department === 'DPLS' ? 'bg-blue-600 animate-pulse' : 'bg-white/80 animate-pulse'}`} />
        <div className="w-12 bg-white/20 animate-ping absolute left-1/2 transform -translate-x-1/2 h-1.5" />
        <div className={`flex-1 transition-all duration-1000 ${department === 'DPSA' ? 'bg-yellow-600 animate-pulse delay-500' : department === 'DPLS' ? 'bg-red-600 animate-pulse delay-500' : 'bg-neutral-400 animate-pulse delay-500'}`} />
      </div>

      {/* Decorative Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-40" />

      {/* Alert */}
      {alertMsg && (
        <div className="fixed top-16 right-4 z-[60] max-w-sm p-4 rounded-lg shadow-lg bg-neutral-900 border border-white/10 text-white">
          <pre className="whitespace-pre-wrap text-sm">{alertMsg}</pre>
        </div>
      )}

      {/* Header */}
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

        {/* Toggles */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Department Toggle */}
          <div className="flex bg-neutral-900/95 border border-white/10 rounded-lg p-0.5 text-xs">
            <button onClick={() => setDepartment('DPSA')} className={`px-3.5 py-1.5 rounded-md font-bold uppercase transition-all duration-200 cursor-pointer ${activeHeaderTab('DPSA')}`}>DPSA</button>
            <button onClick={() => setDepartment('DPLS')} className={`px-3.5 py-1.5 rounded-md font-bold uppercase transition-all duration-200 cursor-pointer ${activeHeaderTab('DPLS')}`}>DPLS</button>
            <button onClick={() => setDepartment('DBC')} className={`px-3.5 py-1.5 rounded-md font-bold uppercase transition-all duration-200 cursor-pointer ${activeHeaderTab('DBC')}`}>DBC</button>
          </div>

          {/* Digital Clock */}
          <div className="hidden lg:flex items-center gap-2 bg-neutral-900/95 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider text-gray-300">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>{systemTime.toLocaleTimeString('pt-PT')}</span>
          </div>
        </div>
      </header>

      {/* Bottom bar - CC */}
      <div className="border-b border-white/10 bg-slate-950/90 px-4 py-3 z-10 relative">
        <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
          <label className="text-sm font-bold text-white">CC Atual:</label>
          <input value={ccAtual} onChange={e => setCcAtual(e.target.value)} className={`${inputCls} !w-40`} />
          <div className="px-3 py-1 rounded-lg bg-neutral-900/80 border border-white/10">
            <span className="text-sm text-gray-400">Extra: <strong className="text-amber-400">{fmt2(totalExtra)} €</strong></span>
            <span className="mx-2 text-gray-600">|</span>
            <span className="text-sm text-gray-400">CAD: <strong className="text-green-400">{fmt2(totalCAD)} €</strong></span>
          </div>
          {/* EDIT ENTRIES BUTTON */}
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

      {/* Tabs */}
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

      {/* Tab Content */}
      <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full z-10 relative">
        {/* SEQUESTRO */}
        {activeTab === "Sequestro" && (
          <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
            <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2">
              <Shield className={`w-5 h-5 ${accentColor}`} /> Sequestro
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
              <div>
                <label className={labelCls}>Civis:</label>
                <input type="number" value={seqCivis} onChange={e => setSeqCivis(Number(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Funcionários Públicos:</label>
                <input type="number" value={seqFunc} onChange={e => setSeqFunc(Number(e.target.value))} className={inputCls} />
              </div>
            </div>
            <button onClick={addSequestro} className={`w-full mt-4 py-3 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${fillBtnTheme} cursor-pointer`}>Calcular e Adicionar</button>
          </div>
        )}

        {/* DINHEIRO */}
        {activeTab === "Dinheiro" && (
          <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
            <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2">
              <Coins className={`w-5 h-5 ${accentColor}`} /> Dinheiro Não Declarado
            </h2>
            <div className="max-w-md">
              <label className={labelCls}>Valor em dinheiro apreendido (€):</label>
              <input type="number" value={dinheiroValor} onChange={e => setDinheiroValor(Number(e.target.value))} className={inputCls} />
            </div>
            <button onClick={addDinheiro} className={`w-full mt-4 py-3 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${fillBtnTheme} cursor-pointer`}>Calcular e Adicionar</button>
          </div>
        )}

        {/* MUNIÇÃO */}
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

        {/* ARMAS */}
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

        {/* ITENS ILEGAIS */}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4 max-h-64 overflow-y-auto">
              {Object.entries(ITENS_ILEGAIS)
                .filter(([item]) => !searchItens || normalizeText(item).includes(normalizeText(searchItens)))
                .map(([item, preco]) => (
                  <div key={item} className="bg-black/40 rounded-lg border border-white/10 p-3 text-center">
                    <div className="text-xs font-bold text-gray-300">{item}</div>
                    <div className="text-[10px] text-gray-500">{fmt(preco)} €</div>
                    <input type="number" min={0} value={itensQuantidades[item] || 0} onChange={e => setItensQuantidades(prev => ({ ...prev, [item]: Number(e.target.value) }))} className={`${inputCls} !mt-2 text-center text-xs`} />
                  </div>
                ))}
            </div>
            <button onClick={addItensGrid} className={`w-full py-3 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${fillBtnTheme} cursor-pointer`}>Calcular e Adicionar</button>
          </div>
        )}

        {/* DROGAS */}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4 max-h-64 overflow-y-auto">
              {Object.keys(PRECOS_DROGAS).map(droga => (
                <div key={droga} className="bg-black/40 rounded-lg border border-white/10 p-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-gray-300">{droga}:</label>
                    <span className="text-xs text-amber-400/70">{fmt(PRECOS_DROGAS[droga])} €</span>
                  </div>
                  <input type="number" min={0} value={drogasQuantidades[droga] || 0} onChange={e => setDrogasQuantidades(prev => ({ ...prev, [droga]: Number(e.target.value) }))} className={`${inputCls} mt-1`} />
                </div>
              ))}
            </div>
            <button onClick={addDrogasGrid} className={`w-full py-3 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${fillBtnTheme} cursor-pointer`}>Calcular e Adicionar</button>
          </div>
        )}

        {/* MEDIAÇÃO/TENTATIVA */}
        {activeTab === "Mediação/Tentativa" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2">
                <Scale className={`w-5 h-5 ${accentColor}`} /> Mediação
              </h2>
              <div className="space-y-3">
                <div><label className={labelCls}>Coima original (CAD):</label><input type="number" value={medCoima} onChange={e => setMedCoima(Number(e.target.value))} className={inputCls} /></div>
                <div><label className={labelCls}>Meses originais:</label><input type="number" value={medMeses} onChange={e => setMedMeses(Number(e.target.value))} className={inputCls} /></div>
                <div><label className={labelCls}>Percentagem da coima (%):</label><input type="number" value={medPercCoima} onChange={e => setMedPercCoima(Number(e.target.value))} className={inputCls} /></div>
                <div><label className={labelCls}>Percentagem da sentença (%):</label><input type="number" value={medPercMeses} onChange={e => setMedPercMeses(Number(e.target.value))} className={inputCls} /></div>
              </div>
              <button onClick={calcMediacao} className={`w-full mt-4 py-3 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${fillBtnTheme} cursor-pointer`}>Calcular Mediação</button>
            </div>
            <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2">
                <Gavel className={`w-5 h-5 ${accentColor}`} /> Tentativa de Crime (75%)
              </h2>
              <div><label className={labelCls}>Valor do crime consumado:</label><input type="number" value={tentValor} onChange={e => setTentValor(Number(e.target.value))} className={inputCls} /></div>
              <button onClick={calcTentativa} className={`w-full mt-4 py-3 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${fillBtnTheme} cursor-pointer`}>Calcular Tentativa</button>
            </div>
          </div>
        )}

        {/* VELOCIDADE E EPI */}
        {activeTab === "Velocidade/EPI" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2">
                <Car className={`w-5 h-5 ${accentColor}`} /> Excesso de Velocidade
              </h2>
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
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2">
                <ShieldAlert className={`w-5 h-5 ${accentColor}`} /> Falta de EPI
              </h2>
              <div className="space-y-2">
                {[{ label: "Colete Refletor", val: epiColete, set: setEpiColete }, { label: "Capacete (mineiros)", val: epiCapacete, set: setEpiCapacete }, { label: "Botas biqueira aço", val: epiBotas, set: setEpiBotas }, { label: "Calças largas", val: epiCalcas, set: setEpiCalcas }, { label: "Máscara proteção", val: epiMascara, set: setEpiMascara }].map(({ label, val, set }) => (
                  <label key={label} className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-white">
                    <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} className="accent-amber-500" /> {label}
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 mt-2">Nota: Cada peça em falta = 2.500€, máximo 12.500€</p>
              <button onClick={() => { const falta = [epiColete, epiCapacete, epiBotas, epiCalcas, epiMascara].filter(v => !v).length; const total = Math.min(falta * 2500, 12500); setEpiResultado(falta === 0 ? "Todas presentes. Sem multa." : `Multa: ${fmt2(total)} € (${falta} peça(s) x 2.500€)`); }} className={`w-full mt-3 py-3 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${fillBtnTheme} cursor-pointer`}>Calcular Multa</button>
              {epiResultado && <div className={`mt-3 p-3 rounded-lg text-xs ${epiResultado.includes("Todas") ? "bg-green-900/30 text-green-400" : "bg-amber-900/30 text-amber-400"}`}>{epiResultado}</div>}
            </div>
          </div>
        )}

        {/* CATÁLOGO */}
        {activeTab === "Catálogo" && (
          <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
            <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2">
              <BookOpen className={`w-5 h-5 ${accentColor}`} /> Catálogo de Crimes
            </h2>
            <div className="flex gap-2 mb-4">
              <input value={searchCrime} onChange={e => setSearchCrime(e.target.value)} className={inputCls} placeholder="Pesquisar crime..." />
              <button onClick={() => setSearchCrime("")} className="px-3 py-2 rounded bg-white/10 text-xs text-gray-400 hover:text-white cursor-pointer">Limpar</button>
              <button onClick={addCrimesCatalogo} className={`px-4 py-2 rounded text-xs font-bold uppercase ${fillBtnTheme} cursor-pointer`}>Adicionar</button>
            </div>
            <div className="overflow-auto max-h-[60vh] rounded border border-white/10">
              <table className="w-full text-xs font-mono">
                <thead className="bg-neutral-900 sticky top-0">
                  <tr>
                    <th className="p-2 text-left w-8"><input type="checkbox" onChange={e => handleSelectAllCrimes(e.target.checked)} checked={selectedCrimes.size > 0} /></th>
                    <th className="p-2 text-left">Categoria</th>
                    <th className="p-2 text-left">Crime</th>
                    <th className="p-2 text-center">Meses</th>
                    <th className="p-2 text-right">Multa</th>
                  </tr>
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

        {/* PERFIS */}
        {activeTab === "Perfis" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-3">Perfis Guardados</h2>
              <div className="space-y-1 mb-3 max-h-96 overflow-auto">
                {Object.keys(perfis).map(nome => (
                  <button key={nome} onClick={() => setSelectedPerfil(nome)} className={`w-full text-left px-3 py-2 rounded text-xs font-mono transition-colors cursor-pointer ${selectedPerfil === nome ? "bg-amber-600 text-white" : "bg-black/40 hover:bg-white/10 text-gray-400"}`}>{nome}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={novoPerfil} className="px-3 py-1.5 rounded bg-white/10 text-xs text-gray-300 hover:text-white cursor-pointer">Novo</button>
                <button onClick={eliminarPerfil} className="px-3 py-1.5 rounded bg-red-900/40 text-xs text-red-300 hover:bg-red-900/60 cursor-pointer">Eliminar</button>
              </div>
            </div>
            <div className={`md:col-span-2 bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-3">Crimes no Perfil: {selectedPerfil || "—"}</h2>
              {perfilCrimes.length === 0 ? <p className="text-xs text-gray-500">Nenhum crime.</p> : (
                <div className="space-y-1 mb-3 max-h-64 overflow-auto">
                  {perfilCrimes.map((c, idx) => (
                    <div key={idx} className="flex justify-between items-center px-3 py-2 rounded bg-black/40">
                      <span className="text-xs text-gray-300">{c.crime}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-400">{fmt(c.multa)} €</span>
                        <button onClick={() => removePerfilCrime(idx)} className="text-red-500 text-xs hover:underline cursor-pointer">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-right font-bold mb-3 text-amber-400">Total: {fmt2(perfilTotal)} €</p>
              <div className="flex gap-2">
                <button onClick={aplicarPerfil} className={`px-4 py-2 rounded text-xs font-bold uppercase ${fillBtnTheme} cursor-pointer`}>Aplicar Perfil</button>
                <button onClick={() => setActiveTab("Catálogo")} className="px-3 py-2 rounded bg-white/10 text-xs text-gray-400 hover:text-white cursor-pointer">Ir ao Catálogo</button>
              </div>
            </div>
          </div>
        )}

        {/* COIMAS RÁPIDAS PT */}
        {activeTab === "Coimas Rápidas PT" && (
          <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
            <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4 flex items-center gap-2">
              <Calculator className={`w-5 h-5 ${accentColor}`} /> Coimas Rápidas Portugal
            </h2>
            <p className="text-xs text-gray-500 mb-2">Escreva quantidade e item (ex: 45 maços). Para vários, separe por vírgulas.</p>
            <div className="flex gap-2 mb-4">
              <input value={testeInput} onChange={e => setTesteInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") calcularTeste(); }} className={inputCls} placeholder="45 maços, 6 óleos, 100 balas baixo..." />
              <button onClick={calcularTeste} className={`px-4 py-2 rounded text-xs font-bold uppercase ${fillBtnTheme} cursor-pointer`}>Calcular</button>
              <button onClick={() => setTesteHistorico([])} className="px-3 py-2 rounded bg-white/10 text-xs text-gray-400 hover:text-white cursor-pointer">Limpar</button>
            </div>
            <div className="rounded-lg border border-white/10 p-4 max-h-96 overflow-auto bg-black/60 font-mono text-xs text-green-400">
              <pre>{testeHistorico.join("\n" + "—".repeat(50) + "\n\n") || "// Resultados aparecerão aqui..."}</pre>
            </div>
          </div>
        )}

        {/* RELATÓRIO */}
        {activeTab === "Relatório" && (
          <div className="space-y-4">
            {/* Dados */}
            <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4">📝 Dados da Ocorrência</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelCls}>Tipo de crime:</label><select value={relTipo} onChange={e => setRelTipo(e.target.value)} className={inputCls}><option>Assalto a loja</option><option>Assalto a casa</option><option>Assalto a joalharia</option><option>Assalto a banco</option><option>Assalto a loja de armas</option><option>Assalto a carrinha de valores</option><option>Roubo</option><option>Furto</option><option>Outro</option></select></div>
                <div><label className={labelCls}>Número de assaltantes:</label><input type="number" value={relAssaltantes} onChange={e => setRelAssaltantes(Number(e.target.value))} className={inputCls} /></div>
                <div><label className={labelCls}>Número de reféns (civis):</label><input type="number" value={relCivis} onChange={e => setRelCivis(Number(e.target.value))} className={inputCls} /></div>
                <div><label className={labelCls}>Funcionários Públicos:</label><input type="number" value={relFunc} onChange={e => setRelFunc(Number(e.target.value))} className={inputCls} /></div>
                <div><label className={labelCls}>CP (Código Postal/Processo):</label><input value={relCP} onChange={e => setRelCP(e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Observações:</label><input value={relObs} onChange={e => setRelObs(e.target.value)} className={inputCls} /></div>
              </div>
            </div>

            {/* Coimas Extras */}
            <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4">💰 Coimas Extras Rápidas</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div><label className={labelCls}>CC:</label><input value={relCCCoima} onChange={e => setRelCCCoima(e.target.value)} className={inputCls} /></div>
                <div className="md:col-span-2"><label className={labelCls}>Lista de itens:</label><input value={relCoimaRapida} onChange={e => setRelCoimaRapida(e.target.value)} className={inputCls} placeholder="122 balas baixo, 2 armas baixo..." /></div>
                <div className="flex items-end"><button onClick={addCoimasRapidasRelatorio} className={`w-full py-2 rounded text-xs font-bold uppercase ${fillBtnTheme} cursor-pointer`}>Adicionar</button></div>
              </div>
            </div>

            {/* Crimes por Nome */}
            <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4">⚖️ Adicionar Crimes por Nome</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div><label className={labelCls}>CC:</label><input value={relCCCrimesNome} onChange={e => setRelCCCrimesNome(e.target.value)} className={inputCls} /></div>
                <div className="md:col-span-2"><label className={labelCls}>Lista de crimes:</label><input value={relCrimesNome} onChange={e => setRelCrimesNome(e.target.value)} className={inputCls} placeholder="1 assalto a loja, 2 sequestro..." /></div>
                <div className="flex items-end gap-2"><label className="flex items-center gap-1 text-xs text-gray-400"><input type="checkbox" checked={relTentativa} onChange={e => setRelTentativa(e.target.checked)} /> Tentativa</label><button onClick={addCrimesPorNome} className={`px-3 py-2 rounded text-xs font-bold uppercase ${fillBtnTheme} cursor-pointer`}>Adicionar</button></div>
              </div>
            </div>

            {/* Valor CAD */}
            <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
              <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4">📋 Valor do CAD</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div><label className={labelCls}>CC:</label><input value={relCCCAD} onChange={e => setRelCCCAD(e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Meses:</label><input type="number" value={relMesesCAD} onChange={e => setRelMesesCAD(Number(e.target.value))} className={inputCls} /></div>
                <div><label className={labelCls}>Valor (€):</label><input type="number" value={relValorCAD} onChange={e => setRelValorCAD(Number(e.target.value))} className={inputCls} /></div>
                <div className="flex items-end"><button onClick={addValorCAD} className={`w-full py-2 rounded text-xs font-bold uppercase ${fillBtnTheme} cursor-pointer`}>Adicionar</button></div>
              </div>
            </div>

            {/* CCs */}
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

            {/* Entradas Registadas - Inline Preview */}
            {allCCsWithEntries.length > 0 && (
              <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-amber-400" />
                    Entradas Registadas ({allCCsWithEntries.length} CC)
                  </h2>
                  <button
                    onClick={() => setShowEntriesPanel(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/30 text-amber-300 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" /> Editar / Eliminar
                  </button>
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
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">CC: {cc}</span>
                          <div className="flex gap-3 text-[10px]">
                            <span className="text-green-400">CAD: {fmt2(totalCadCC)} € ({cadEntries.length})</span>
                            <span className="text-amber-400">Extra: {fmt2(totalExtraCC)} € ({extraEntries.length})</span>
                            <span className="text-white font-bold">Total: {fmt2(totalCadCC + totalExtraCC)} €</span>
                            {totalMesesCC > 0 && <span className="text-blue-400">{totalMesesCC.toFixed(1)} meses</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <button onClick={gerarRelatorio} className={`px-6 py-3 rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all ${fillBtnTheme} cursor-pointer`}>Gerar Relatório</button>
              <button onClick={copiarRelatorio} className="px-4 py-3 rounded-lg bg-white/10 text-xs text-gray-300 hover:text-white hover:bg-white/20 cursor-pointer">Copiar Relatório</button>
              <button onClick={() => setRelatorio("")} className="px-3 py-3 rounded bg-white/10 text-xs text-gray-400 hover:text-white cursor-pointer">Limpar</button>
            </div>

            {/* Output */}
            {relatorio && (
              <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
                <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-4">📄 Relatório Gerado</h2>
                <div className="rounded-lg border border-white/10 p-4 bg-black/60 max-h-96 overflow-auto">
                  <pre className="text-xs whitespace-pre-wrap font-mono text-green-400">{relatorio}</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-slate-950 py-3 text-center text-[10px] text-gray-500 font-mono z-10 relative">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span className="flex items-center justify-center sm:justify-start gap-1">
            <ShieldAlert className="w-4 h-4 text-red-500/80 animate-pulse" />
            <span>PORTAL OFICIAL DE SEGURANÇA RODOVIÁRIA • OFFSET PORTUGAL ROLEPLAY</span>
          </span>
          <span className="opacity-60">
            © {systemTime.getFullYear()} {department} Los Santos • Codificação UTF-8
          </span>
        </div>
      </footer>
    </div>
  );
}
