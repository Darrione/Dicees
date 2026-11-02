import React, { useState } from 'react';
import {
  X,
  RotateCcw,
  Trash2,
  Download,
  Plus,
  Dices,
} from 'lucide-react';
import {
  CustomDiePreset,
  GemstonePresetId,
  RollHistoryEntry,
} from '../types/dice';
import { GEMSTONE_LIST, GEMSTONE_MATERIALS } from '../constants/gemstones';

export type ActiveModalTab = 'none' | 'history' | 'forge' | 'presets';

interface DrawerModalsProps {
  activeModal: ActiveModalTab;
  onClose: () => void;
  history: RollHistoryEntry[];
  onClearHistory: () => void;
  onRerollEntry: (entry: RollHistoryEntry) => void;
  presets: CustomDiePreset[];
  onSelectPreset: (preset: CustomDiePreset) => void;
  onCreatePreset: (preset: Omit<CustomDiePreset, 'id'>) => void;
  onDeletePreset: (id: string) => void;
}

export const DrawerModals: React.FC<DrawerModalsProps> = ({
  activeModal,
  onClose,
  history,
  onClearHistory,
  onRerollEntry,
  presets,
  onSelectPreset,
  onCreatePreset,
  onDeletePreset,
}) => {
  // Custom Forge form state
  const [forgeName, setForgeName] = useState('Arcane Blast');
  const [forgeCount, setForgeCount] = useState(3);
  const [forgeSides, setForgeSides] = useState(12);
  const [forgeMod, setForgeMod] = useState(2);
  const [forgeGem, setForgeGem] = useState<GemstonePresetId>('amethyst');
  const [forgeDesc, setForgeDesc] = useState(
    'Custom polyhedral invocation forged for tabletop encounters.'
  );

  if (activeModal === 'none') return null;

  const handleExportHistory = () => {
    const dataStr = JSON.stringify(history, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `astral-gem-roll-chronicle-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleForgeSubmit = (e: React.FormEvent, rollImmediately: boolean) => {
    e.preventDefault();
    const cleanName = forgeName.trim() || `Custom ${forgeCount}d${forgeSides}`;
    const newPreset: Omit<CustomDiePreset, 'id'> = {
      name: cleanName,
      diceCount: Math.min(15, Math.max(1, forgeCount)),
      sides: Math.min(100, Math.max(2, forgeSides)),
      modifier: Math.min(20, Math.max(-20, forgeMod)),
      gemstone: forgeGem,
      description: forgeDesc.trim() || 'Custom forged tabletop RPG dice configuration.',
    };
    onCreatePreset(newPreset);
    if (rollImmediately) {
      onSelectPreset({ ...newPreset, id: 'temp' });
      onClose();
    }
  };

  // Compute summary stats for Roll Chronicle
  const totalThrows = history.length;
  const highestTotal = totalThrows > 0 ? Math.max(...history.map((h) => h.total)) : 0;
  const totalCrits = history.reduce((acc, h) => acc + h.criticalCount, 0);
  const meanTotal =
    totalThrows > 0
      ? (history.reduce((acc, h) => acc + h.total, 0) / totalThrows).toFixed(1)
      : '0.0';

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-end bg-black/65"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-xl h-full bg-[#130d09] border-l border-amber-500/25 flex flex-col justify-between p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-4 border-b border-amber-500/20">
            <div>
              <h2 className="text-xl font-bold text-amber-100 tracking-wide">
                {activeModal === 'history' && 'Roll Chronicle'}
                {activeModal === 'forge' && 'Custom Dice Forge'}
                {activeModal === 'presets' && 'Tabletop Dice Presets'}
              </h2>
              <p className="text-xs text-amber-200/60 mt-0.5">
                {activeModal === 'history' &&
                  'Complete ledger of every polyhedral throw, individual die face, and modifier.'}
                {activeModal === 'forge' &&
                  'Craft bespoke polyhedral dice with custom side counts (d2 to d100) and gemstone refraction.'}
                {activeModal === 'presets' &&
                  'Select a saved weapon, spell, or custom oracle roll to throw immediately.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="p-2 rounded-lg text-amber-200/70 hover:text-amber-100 hover:bg-[#211710] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* TAB 1: ROLL CHRONICLE (HISTORY LOG) */}
          {activeModal === 'history' && (
            <div className="mt-5 space-y-5">
              {/* Statistical Summary Strip */}
              <div className="grid grid-cols-4 gap-3 p-3.5 rounded-lg bg-[#1b130d] border border-amber-500/15">
                <div>
                  <div className="text-[11px] text-amber-200/60">Total Throws</div>
                  <div className="text-lg font-semibold text-amber-100 font-mono-tabular">
                    {totalThrows}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-amber-200/60">Average Roll</div>
                  <div className="text-lg font-semibold text-amber-100 font-mono-tabular">
                    {meanTotal}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-amber-200/60">Peak Total</div>
                  <div className="text-lg font-semibold text-amber-300 font-mono-tabular">
                    {highestTotal}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-amber-200/60">Max Faces</div>
                  <div className="text-lg font-semibold text-amber-400 font-mono-tabular">
                    {totalCrits}
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              {history.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-amber-200/60">
                    Showing {history.length} recorded {history.length === 1 ? 'throw' : 'throws'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportHistory}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e150f] hover:bg-[#2a1d14] border border-amber-500/20 text-xs font-medium text-amber-200 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={onClearHistory}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#261313] hover:bg-[#381a1a] border border-rose-500/25 text-xs font-medium text-rose-200 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Log</span>
                    </button>
                  </div>
                </div>
              )}

              {/* History Entries List */}
              {history.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-amber-500/20 rounded-xl">
                  <p className="text-sm text-amber-200/70">No dice throws recorded yet.</p>
                  <p className="text-xs text-amber-200/45 mt-1">
                    Throw dice on the walnut tabletop to populate your session chronicle.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => {
                    const gem = GEMSTONE_MATERIALS[item.gemstone] || GEMSTONE_MATERIALS.ruby;
                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-lg bg-[#1a120c] border border-amber-500/15 hover:border-amber-500/35 transition-colors flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-amber-100">
                              {item.label}
                            </span>
                            <span className="text-xs text-amber-200/40" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-xs font-mono-tabular text-amber-300">
                              {item.notation}
                            </span>
                          </div>

                          {/* Unboxed static metadata with typographic separators */}
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-amber-200/60">
                            <span>{item.timestamp}</span>
                            <span aria-hidden="true">·</span>
                            <span>{gem.name}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular text-amber-100/90">
                              Faces: [{item.individualValues.join(', ')}]
                            </span>
                            {item.modifier !== 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono-tabular">
                                  Mod {item.modifier > 0 ? `+${item.modifier}` : item.modifier}
                                </span>
                              </>
                            )}
                            {item.criticalCount > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-amber-300 font-medium">
                                  {item.criticalCount} Max {item.criticalCount === 1 ? 'Face' : 'Faces'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-[10px] text-amber-200/50">Total</div>
                            <div className="text-xl font-bold text-amber-300 font-mono-tabular">
                              {item.total}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onRerollEntry(item);
                              onClose();
                            }}
                            title="Re-roll this exact configuration"
                            className="p-2 rounded-lg bg-[#261b12] hover:bg-amber-500 hover:text-[#140e0a] text-amber-200 transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CUSTOM DICE FORGE */}
          {activeModal === 'forge' && (
            <form
              onSubmit={(e) => handleForgeSubmit(e, false)}
              className="mt-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-amber-200/80 mb-1.5">
                  Custom Roll / Weapon / Oracle Name
                </label>
                <input
                  type="text"
                  required
                  value={forgeName}
                  onChange={(e) => setForgeName(e.target.value)}
                  placeholder="e.g., Dragonbreath d16 Volley"
                  className="w-full px-3.5 py-2 rounded-lg bg-[#1b130d] border border-amber-500/25 text-sm text-amber-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-amber-200/80 mb-1.5">
                    Number of Dice (1–15)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={forgeCount}
                    onChange={(e) => setForgeCount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[#1b130d] border border-amber-500/25 text-sm font-mono-tabular text-amber-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-200/80 mb-1.5">
                    Sides per Die (2–100)
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={forgeSides}
                    onChange={(e) => setForgeSides(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[#1b130d] border border-amber-500/25 text-sm font-mono-tabular text-amber-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-200/80 mb-1.5">
                    Modifier (-20 to +20)
                  </label>
                  <input
                    type="number"
                    min={-20}
                    max={20}
                    value={forgeMod}
                    onChange={(e) => setForgeMod(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[#1b130d] border border-amber-500/25 text-sm font-mono-tabular text-amber-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Quick Custom Non-Standard Polyhedral Side Pickers */}
              <div>
                <span className="block text-xs font-medium text-amber-200/70 mb-1.5">
                  Quick Polyhedral & Unusual Side Counts
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30, 50, 100].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForgeSides(s)}
                      className={`px-2.5 py-1 rounded text-xs font-mono-tabular transition-colors cursor-pointer ${
                        forgeSides === s
                          ? 'bg-amber-500 text-[#140e0a] font-semibold'
                          : 'bg-[#1e150f] text-amber-200/75 hover:bg-[#2a1d14]'
                      }`}
                    >
                      d{s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gemstone Material Selection */}
              <div>
                <span className="block text-xs font-medium text-amber-200/80 mb-1.5">
                  Gemstone Crystal Material
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {GEMSTONE_LIST.map((gem) => (
                    <button
                      key={gem.id}
                      type="button"
                      onClick={() => setForgeGem(gem.id)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        forgeGem === gem.id
                          ? 'bg-amber-500/15 border-amber-400 text-amber-100'
                          : 'bg-[#1b130d] border-amber-500/15 text-amber-200/75 hover:bg-[#241911]'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full shrink-0 border border-white/30"
                        style={{ backgroundColor: gem.swatchHex }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{gem.name}</div>
                        <div className="text-[10px] text-amber-200/50 truncate">{gem.subtitle}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-amber-200/80 mb-1.5">
                  Chronicle Note / Lore Description
                </label>
                <textarea
                  rows={2}
                  value={forgeDesc}
                  onChange={(e) => setForgeDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-[#1b130d] border border-amber-500/25 text-xs text-amber-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#261b12] hover:bg-[#332418] border border-amber-500/30 text-xs font-semibold text-amber-100 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save to Presets</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleForgeSubmit(e, true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-semibold text-[#140e0a] transition-colors cursor-pointer"
                >
                  <Dices className="w-4 h-4" />
                  <span>Save & Roll Now</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: PRESETS LIBRARY */}
          {activeModal === 'presets' && (
            <div className="mt-5 space-y-3">
              {presets.map((preset) => {
                const gem = GEMSTONE_MATERIALS[preset.gemstone] || GEMSTONE_MATERIALS.ruby;
                const notation = `${preset.diceCount}d${preset.sides}${
                  preset.modifier > 0
                    ? ` + ${preset.modifier}`
                    : preset.modifier < 0
                    ? ` - ${Math.abs(preset.modifier)}`
                    : ''
                }`;

                return (
                  <div
                    key={preset.id}
                    className="p-4 rounded-lg bg-[#1a120c] border border-amber-500/15 hover:border-amber-500/40 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-white/30"
                          style={{ backgroundColor: gem.swatchHex }}
                        />
                        <span className="text-sm font-semibold text-amber-100">
                          {preset.name}
                        </span>
                        <span className="text-xs text-amber-200/40" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-xs font-mono-tabular font-semibold text-amber-300">
                          {notation}
                        </span>
                      </div>
                      <p className="text-xs text-amber-200/65">{preset.description}</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-200/50">
                        <span>{gem.name}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Range: {preset.diceCount + preset.modifier}–
                          {preset.diceCount * preset.sides + preset.modifier}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectPreset(preset);
                          onClose();
                        }}
                        className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-[#140e0a] text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Dices className="w-3.5 h-3.5" />
                        <span>Roll</span>
                      </button>
                      {!preset.id.startsWith('preset-') && (
                        <button
                          type="button"
                          onClick={() => onDeletePreset(preset.id)}
                          aria-label={`Delete ${preset.name}`}
                          className="p-2 rounded-lg bg-[#261414] hover:bg-[#3a1d1d] text-rose-300 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Tip */}
        <div className="pt-4 mt-6 border-t border-amber-500/15 flex items-center justify-between text-xs text-amber-200/50">
          <span>Tip: Click any settled die on the walnut tray to re-throw</span>
          <button
            type="button"
            onClick={onClose}
            className="text-amber-300 hover:underline cursor-pointer"
          >
            Return to Tabletop
          </button>
        </div>
      </div>
    </div>
  );
};
