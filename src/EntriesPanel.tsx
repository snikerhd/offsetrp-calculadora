import { useCallback } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";

interface CadEntry {
  desc: string;
  meses: number;
  multa: number;
}

interface ExtraEntry {
  desc: string;
  valor: number;
}

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

interface EntriesPanelProps {
  showEntriesPanel: boolean;
  setShowEntriesPanel: (show: boolean) => void;
  cadPorCC: Record<string, CadEntry[]>;
  extraPorCC: Record<string, ExtraEntry[]>;
  setCadPorCC: React.Dispatch<React.SetStateAction<Record<string, CadEntry[]>>>;
  setExtraPorCC: React.Dispatch<React.SetStateAction<Record<string, ExtraEntry[]>>>;
  editingCAD: EditingCAD | null;
  setEditingCAD: React.Dispatch<React.SetStateAction<EditingCAD | null>>;
  editingExtra: EditingExtra | null;
  setEditingExtra: React.Dispatch<React.SetStateAction<EditingExtra | null>>;
  onShowAlert: (msg: string) => void;
  fmt2: (n: number) => string;
}

const inputCls = "w-full px-3 py-2 bg-black/40 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-white/30 font-mono";

export default function EntriesPanel({
  showEntriesPanel,
  setShowEntriesPanel,
  cadPorCC,
  extraPorCC,
  setCadPorCC,
  setExtraPorCC,
  editingCAD,
  setEditingCAD,
  editingExtra,
  setEditingExtra,
  onShowAlert,
  fmt2,
}: EntriesPanelProps) {
  if (!showEntriesPanel) return null;

  const allCCsWithEntries = Array.from(
    new Set([...Object.keys(cadPorCC), ...Object.keys(extraPorCC)])
  ).filter(
    (cc) => (cadPorCC[cc]?.length || 0) > 0 || (extraPorCC[cc]?.length || 0) > 0
  );

  const saveEditCAD = useCallback(() => {
    if (!editingCAD) return;
    const mesesNum = parseFloat(editingCAD.meses) || 0;
    const multaNum = parseFloat(editingCAD.multa) || 0;
    setCadPorCC((prev) => {
      const entries = [...(prev[editingCAD.cc] || [])];
      entries[editingCAD.index] = {
        desc: editingCAD.desc,
        meses: mesesNum,
        multa: multaNum,
      };
      return { ...prev, [editingCAD.cc]: entries };
    });
    onShowAlert(`Entrada CAD atualizada: ${fmt2(multaNum)} € / ${mesesNum} meses`);
    setEditingCAD(null);
  }, [editingCAD, setCadPorCC, onShowAlert, fmt2, setEditingCAD]);

  const deleteCAD = useCallback(
    (cc: string, index: number) => {
      setCadPorCC((prev) => {
        const entries = [...(prev[cc] || [])];
        entries.splice(index, 1);
        return { ...prev, [cc]: entries };
      });
      onShowAlert("Entrada CAD eliminada.");
    },
    [setCadPorCC, onShowAlert]
  );

  const saveEditExtra = useCallback(() => {
    if (!editingExtra) return;
    const valorNum = parseFloat(editingExtra.valor) || 0;
    setExtraPorCC((prev) => {
      const entries = [...(prev[editingExtra.cc] || [])];
      entries[editingExtra.index] = {
        desc: editingExtra.desc,
        valor: valorNum,
      };
      return { ...prev, [editingExtra.cc]: entries };
    });
    onShowAlert(`Coima extra atualizada: ${fmt2(valorNum)} €`);
    setEditingExtra(null);
  }, [editingExtra, setExtraPorCC, onShowAlert, fmt2, setEditingExtra]);

  const deleteExtra = useCallback(
    (cc: string, index: number) => {
      setExtraPorCC((prev) => {
        const entries = [...(prev[cc] || [])];
        entries.splice(index, 1);
        return { ...prev, [cc]: entries };
      });
      onShowAlert("Coima extra eliminada.");
    },
    [setExtraPorCC, onShowAlert]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={() => {
        setShowEntriesPanel(false);
        setEditingCAD(null);
        setEditingExtra(null);
      }}
    >
      <div
        className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
            <Pencil className="w-4 h-4 text-amber-400" />
            Gerir Entradas — Editar / Eliminar
          </h2>
          <button
            onClick={() => {
              setShowEntriesPanel(false);
              setEditingCAD(null);
              setEditingExtra(null);
            }}
            className="text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-60px)] p-6 space-y-6">
          {allCCsWithEntries.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-8">
              Nenhuma entrada registada. Adicione coimas para poder geri-las aqui.
            </p>
          )}

          {allCCsWithEntries.map((cc) => {
            const cadEntries = cadPorCC[cc] || [];
            const extraEntries = extraPorCC[cc] || [];
            const totalCadCC = cadEntries.reduce((s, e) => s + e.multa, 0);
            const totalExtraCC = extraEntries.reduce((s, e) => s + e.valor, 0);

            return (
              <div
                key={cc}
                className="bg-black/30 rounded-xl border border-white/5 overflow-hidden"
              >
                {/* CC Header */}
                <div className="px-4 py-3 bg-white/5 flex items-center justify-between">
                  <span className="text-sm font-bold text-white">CC: {cc}</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-green-400">
                      CAD: {fmt2(totalCadCC)} €
                    </span>
                    <span className="text-amber-400">
                      Extra: {fmt2(totalExtraCC)} €
                    </span>
                    <span className="text-white font-bold">
                      Total: {fmt2(totalCadCC + totalExtraCC)} €
                    </span>
                  </div>
                </div>

                {/* CAD Entries */}
                {cadEntries.length > 0 && (
                  <div className="px-4 py-3">
                    <h3 className="text-xs font-bold text-green-400 uppercase tracking-wider mb-2">
                      Coimas CAD
                    </h3>
                    <div className="space-y-2">
                      {cadEntries.map((entry, idx) => {
                        const isEditing =
                          editingCAD?.cc === cc && editingCAD?.index === idx;

                        if (isEditing && editingCAD) {
                          return (
                            <div
                              key={`edit-cad-${cc}-${idx}`}
                              className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 space-y-2"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Pencil className="w-3 h-3 text-green-400" />
                                <span className="text-xs font-bold text-green-400 uppercase">
                                  A editar
                                </span>
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase">
                                  Descrição:
                                </label>
                                <input
                                  value={editingCAD.desc}
                                  onChange={(e) =>
                                    setEditingCAD({
                                      ...editingCAD,
                                      desc: e.target.value,
                                    })
                                  }
                                  className={inputCls}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] text-gray-500 uppercase">
                                    Meses:
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={editingCAD.meses}
                                    onChange={(e) =>
                                      setEditingCAD({
                                        ...editingCAD,
                                        meses: e.target.value,
                                      })
                                    }
                                    className={inputCls}
                                    placeholder="0"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 uppercase">
                                    Multa (€):
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={editingCAD.multa}
                                    onChange={(e) =>
                                      setEditingCAD({
                                        ...editingCAD,
                                        multa: e.target.value,
                                      })
                                    }
                                    className={inputCls}
                                    placeholder="0"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={saveEditCAD}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors cursor-pointer"
                                >
                                  <Check className="w-3 h-3" /> Guardar
                                </button>
                                <button
                                  onClick={() => setEditingCAD(null)}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 text-xs font-bold transition-colors cursor-pointer"
                                >
                                  <X className="w-3 h-3" /> Cancelar
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={`cad-${cc}-${idx}`}
                            className="flex items-start justify-between gap-3 bg-black/20 rounded-lg p-3 group hover:bg-black/30 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-300 whitespace-pre-wrap break-words">
                                {entry.desc}
                              </p>
                              <p className="text-[10px] text-gray-500 mt-1">
                                {entry.meses > 0 && (
                                  <span className="mr-3">
                                    ⏱ {entry.meses.toFixed(1)} meses
                                  </span>
                                )}
                                <span className="text-green-400 font-bold">
                                  💰 {fmt2(entry.multa)} €
                                </span>
                              </p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                onClick={() =>
                                  setEditingCAD({
                                    cc,
                                    index: idx,
                                    desc: entry.desc,
                                    meses: String(entry.meses),
                                    multa: String(entry.multa),
                                  })
                                }
                                className="p-1.5 rounded bg-amber-600/80 hover:bg-amber-500 text-white transition-colors cursor-pointer"
                                title="Editar"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => {
                                  if (
                                    confirm("Eliminar esta entrada CAD?")
                                  )
                                    deleteCAD(cc, idx);
                                }}
                                className="p-1.5 rounded bg-red-600/80 hover:bg-red-500 text-white transition-colors cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Extra Entries */}
                {extraEntries.length > 0 && (
                  <div className="px-4 py-3 border-t border-white/5">
                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                      Coimas Extras
                    </h3>
                    <div className="space-y-2">
                      {extraEntries.map((entry, idx) => {
                        const isEditing =
                          editingExtra?.cc === cc && editingExtra?.index === idx;

                        if (isEditing && editingExtra) {
                          return (
                            <div
                              key={`edit-extra-${cc}-${idx}`}
                              className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3 space-y-2"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Pencil className="w-3 h-3 text-amber-400" />
                                <span className="text-xs font-bold text-amber-400 uppercase">
                                  A editar
                                </span>
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase">
                                  Descrição:
                                </label>
                                <textarea
                                  value={editingExtra.desc}
                                  onChange={(e) =>
                                    setEditingExtra({
                                      ...editingExtra,
                                      desc: e.target.value,
                                    })
                                  }
                                  className={`${inputCls} min-h-[60px]`}
                                  rows={3}
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase">
                                  Valor (€):
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={editingExtra.valor}
                                  onChange={(e) =>
                                    setEditingExtra({
                                      ...editingExtra,
                                      valor: e.target.value,
                                    })
                                  }
                                  className={inputCls}
                                  placeholder="0"
                                />
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={saveEditExtra}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors cursor-pointer"
                                >
                                  <Check className="w-3 h-3" /> Guardar
                                </button>
                                <button
                                  onClick={() => setEditingExtra(null)}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 text-xs font-bold transition-colors cursor-pointer"
                                >
                                  <X className="w-3 h-3" /> Cancelar
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={`extra-${cc}-${idx}`}
                            className="flex items-start justify-between gap-3 bg-black/20 rounded-lg p-3 group hover:bg-black/30 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-300 whitespace-pre-wrap break-words">
                                {entry.desc}
                              </p>
                              <p className="text-[10px] mt-1">
                                <span className="text-amber-400 font-bold">
                                  💰 {fmt2(entry.valor)} €
                                </span>
                              </p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                onClick={() =>
                                  setEditingExtra({
                                    cc,
                                    index: idx,
                                    desc: entry.desc,
                                    valor: String(entry.valor),
                                  })
                                }
                                className="p-1.5 rounded bg-amber-600/80 hover:bg-amber-500 text-white transition-colors cursor-pointer"
                                title="Editar"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => {
                                  if (
                                    confirm("Eliminar esta coima extra?")
                                  )
                                    deleteExtra(cc, idx);
                                }}
                                className="p-1.5 rounded bg-red-600/80 hover:bg-red-500 text-white transition-colors cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
