import React from 'react';
import {
  Volume2,
  VolumeX,
  Dices,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  Camera,
  Sparkles,
} from 'lucide-react';
import {
  CameraViewId,
  GemstonePresetId,
} from '../types/dice';
import {
  GEMSTONE_LIST,
  STANDARD_DICE_SIDES,
} from '../constants/gemstones';

interface BottomControlDockProps {
  diceCount: number;
  setDiceCount: (count: number) => void;
  sides: number;
  setSides: (sides: number) => void;
  modifier: number;
  setModifier: (mod: number) => void;
  gemstone: GemstonePresetId;
  setGemstone: (gem: GemstonePresetId) => void;
  cameraView: CameraViewId;
  setCameraView: (view: CameraViewId) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  isRolling: boolean;
  onRoll: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  diceCount,
  setDiceCount,
  sides,
  setSides,
  modifier,
  setModifier,
  gemstone,
  setGemstone,
  cameraView,
  setCameraView,
  soundEnabled,
  onToggleSound,
  isRolling,
  onRoll,
  isCollapsed,
  onToggleCollapse,
}) => {
  const notationStr = `${diceCount}d${sides}${
    modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${Math.abs(modifier)}` : ''
  }`;

  return (
    <div
      className="fixed z-20 left-1/2 -translate-x-1/2 bottom-4 w-[94vw] max-w-[940px] pointer-events-none flex flex-col items-center"
      role="region"
      aria-label="Dice Controls Dock"
    >
      {/* Collapse / Expand Cinema Mode Toggle Tab */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="pointer-events-auto flex items-center gap-1.5 px-4 py-1.5 rounded-t-lg bg-[#16100b] border border-b-0 border-amber-500/25 text-xs font-medium text-amber-200/80 hover:text-amber-100 hover:bg-[#1f1710] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        title="Toggle Cinema Mode (Shortcut: H)"
      >
        {isCollapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
            <span>Show Controls ({notationStr})</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
            <span>Hide Controls</span>
          </>
        )}
      </button>

      {/* Main Dock Container - Uses solid rich walnut-obsidian surface (no backdrop-filter over WebGL) */}
      <div
        className={`pointer-events-auto w-full rounded-xl bg-[#140e0a]/96 border border-amber-500/25 shadow-2xl transition-transform duration-200 ease-out origin-bottom ${
          isCollapsed
            ? 'translate-y-[115%] opacity-0 pointer-events-none h-0 overflow-hidden p-0 border-0'
            : 'translate-y-0 opacity-100 p-4'
        }`}
      >
        <div className="flex flex-col gap-3.5">
          {/* Row 1: Dice Count, Polyhedral Sides (Standard + Custom Input), and Modifier */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
            {/* Number of Dice Simultaneously (1 - 15) */}
            <div className="lg:col-span-3 flex items-center justify-between bg-[#1d140e] border border-amber-500/15 rounded-lg px-3 py-2">
              <div className="flex flex-col">
                <span className="text-[11px] text-amber-200/60 font-medium">Dice Count</span>
                <span className="text-sm font-semibold text-amber-100 font-mono-tabular">
                  {diceCount} {diceCount === 1 ? 'Die' : 'Dice'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDiceCount(Math.max(1, diceCount - 1))}
                  disabled={diceCount <= 1}
                  aria-label="Decrease dice count"
                  className="w-7 h-7 rounded bg-[#2a1d14] hover:bg-[#38271b] disabled:opacity-40 text-amber-200 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={diceCount}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!Number.isNaN(v)) setDiceCount(Math.min(15, Math.max(1, v)));
                  }}
                  aria-label="Number of dice to roll"
                  className="w-10 text-center bg-transparent text-sm font-semibold text-amber-100 font-mono-tabular focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setDiceCount(Math.min(15, diceCount + 1))}
                  disabled={diceCount >= 15}
                  aria-label="Increase dice count"
                  className="w-7 h-7 rounded bg-[#2a1d14] hover:bg-[#38271b] disabled:opacity-40 text-amber-200 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Sides Per Die: Standard Polyhedrals + Custom Sides Input */}
            <div className="lg:col-span-6 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-[#1d140e] border border-amber-500/15 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1 overflow-x-auto">
                {STANDARD_DICE_SIDES.map((s) => {
                  const active = sides === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSides(s)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold font-mono-tabular transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-amber-500 text-[#140e0a] shadow-sm'
                          : 'bg-[#2a1d14] text-amber-200/80 hover:text-amber-100 hover:bg-[#38271b]'
                      }`}
                    >
                      d{s}
                    </button>
                  );
                })}
              </div>

              {/* Custom Sides Input (2 - 100) */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-amber-500/15 shrink-0">
                <label htmlFor="custom-sides-input" className="text-[11px] text-amber-200/60 whitespace-nowrap">
                  Sides:
                </label>
                <input
                  id="custom-sides-input"
                  type="number"
                  min={2}
                  max={100}
                  value={sides}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!Number.isNaN(v)) setSides(Math.min(100, Math.max(2, v)));
                  }}
                  className="w-13 px-1.5 py-1 rounded bg-[#120c08] border border-amber-500/25 text-center text-xs font-semibold text-amber-200 font-mono-tabular focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Modifier Control (-20 to +20) */}
            <div className="lg:col-span-3 flex items-center justify-between bg-[#1d140e] border border-amber-500/15 rounded-lg px-3 py-2">
              <div className="flex flex-col">
                <span className="text-[11px] text-amber-200/60 font-medium">Modifier</span>
                <span className="text-sm font-semibold text-amber-100 font-mono-tabular">
                  {modifier >= 0 ? `+${modifier}` : modifier}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setModifier(Math.max(-20, modifier - 1))}
                  aria-label="Decrease roll modifier"
                  className="w-7 h-7 rounded bg-[#2a1d14] hover:bg-[#38271b] text-amber-200 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setModifier(0)}
                  className="px-2 h-7 rounded bg-[#2a1d14] hover:bg-[#38271b] text-[11px] text-amber-200/80 font-mono-tabular transition-colors cursor-pointer"
                  title="Reset modifier to 0"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setModifier(Math.min(20, modifier + 1))}
                  aria-label="Increase roll modifier"
                  className="w-7 h-7 rounded bg-[#2a1d14] hover:bg-[#38271b] text-amber-200 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Gemstone Material Swatches, Camera Angle, Audio Clatter Toggle, and Primary Roll Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-amber-500/15">
            {/* Translucent Gemstone Swatches */}
            <div className="flex items-center gap-2 overflow-x-auto py-0.5">
              <span className="text-xs text-amber-200/60 flex items-center gap-1 whitespace-nowrap shrink-0 mr-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Gemstone:
              </span>
              {GEMSTONE_LIST.map((gem) => {
                const isSelected = gemstone === gem.id;
                return (
                  <button
                    key={gem.id}
                    type="button"
                    onClick={() => setGemstone(gem.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-100 border border-amber-400/70'
                        : 'bg-[#1d140e] text-amber-200/70 border border-transparent hover:bg-[#2a1d14] hover:text-amber-100'
                    }`}
                    title={`${gem.name} (${gem.subtitle})`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border border-white/30"
                      style={{ backgroundColor: gem.swatchHex }}
                    />
                    <span>{gem.name.split(' ')[1] || gem.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Camera View + Sound Effect Clatter Toggle + Roll Button */}
            <div className="flex items-center gap-2 ml-auto">
              {/* Camera Presets */}
              <div className="hidden sm:flex items-center bg-[#1d140e] border border-amber-500/15 rounded-lg p-0.5">
                <Camera className="w-3.5 h-3.5 text-amber-200/50 ml-2 mr-1 shrink-0" />
                {(['tavern', 'overhead', 'closeup'] as CameraViewId[]).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setCameraView(view)}
                    className={`px-2 py-1 rounded-md text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      cameraView === view
                        ? 'bg-amber-500/25 text-amber-100'
                        : 'text-amber-200/60 hover:text-amber-100'
                    }`}
                  >
                    {view === 'closeup' ? 'Close-Up' : view}
                  </button>
                ))}
              </div>

              {/* Sound Effect Clatter Toggle */}
              <button
                type="button"
                onClick={onToggleSound}
                aria-pressed={soundEnabled}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  soundEnabled
                    ? 'bg-[#1d140e] border-amber-500/30 text-amber-100 hover:bg-[#2a1d14]'
                    : 'bg-[#17110c] border-amber-500/10 text-amber-200/50 hover:text-amber-200'
                }`}
                title="Toggle dice rolling clatter sound effects"
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    <span>Clatter On</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 text-amber-200/50" />
                    <span>Muted</span>
                  </>
                )}
              </button>

              {/* Primary Roll Action Button */}
              <button
                type="button"
                onClick={onRoll}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-[#140e0a] font-semibold text-sm shadow-lg transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Dices className="w-4 h-4" />
                <span>{isRolling ? 'Re-Throw' : `Roll ${notationStr}`}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
