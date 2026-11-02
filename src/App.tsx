import React, { useState, useEffect, useCallback } from 'react';
import {
  CameraViewId,
  CustomDiePreset,
  GemstonePresetId,
  IndividualDieResult,
  RollHistoryEntry,
} from './types/dice';
import {
  DEFAULT_CUSTOM_PRESETS,
  GEMSTONE_MATERIALS,
} from './constants/gemstones';
import { DiceArenaCanvas } from './components/DiceArenaCanvas';
import { BottomControlDock } from './components/BottomControlDock';
import { ActiveModalTab, DrawerModals } from './components/DrawerModals';
import { diceAudio } from './utils/audio';

const STORAGE_HISTORY_KEY = 'astral_gem_dice_history_v1';
const STORAGE_PRESETS_KEY = 'astral_gem_dice_presets_v1';

export default function App() {
  // Dice configuration state
  const [diceCount, setDiceCount] = useState<number>(3);
  const [sides, setSides] = useState<number>(20);
  const [modifier, setModifier] = useState<number>(2);
  const [rollLabel, setRollLabel] = useState<string>('Custom Throw');
  const [gemstone, setGemstone] = useState<GemstonePresetId>('ruby');
  const [cameraView, setCameraView] = useState<CameraViewId>('tavern');

  // Audio & UI state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [rollTrigger, setRollTrigger] = useState<number>(0);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [activeModal, setActiveModal] = useState<ActiveModalTab>('none');

  // Latest settled result & persistent history chronicle
  const [latestEntry, setLatestEntry] = useState<RollHistoryEntry | null>(null);
  const [history, setHistory] = useState<RollHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [presets, setPresets] = useState<CustomDiePreset[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PRESETS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_CUSTOM_PRESETS;
    } catch {
      return DEFAULT_CUSTOM_PRESETS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
    } catch {
      // Ignore storage quota errors
    }
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PRESETS_KEY, JSON.stringify(presets));
    } catch {
      // Ignore storage quota errors
    }
  }, [presets]);

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      diceAudio.setEnabled(next);
      return next;
    });
  }, []);

  const triggerRoll = useCallback(() => {
    setRollTrigger((prev) => prev + 1);
  }, []);

  // Keyboard shortcuts: 'H' toggles Cinema Mode dock, 'Space' throws dice when no input is focused
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === ' ' && activeModal === 'none') {
        e.preventDefault();
        triggerRoll();
      } else if (e.key === 'Escape' && activeModal !== 'none') {
        setActiveModal('none');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeModal, triggerRoll]);

  const handleRollStart = useCallback(() => {
    setIsRolling(true);
  }, []);

  const handleRollComplete = useCallback(
    (results: IndividualDieResult[]) => {
      setIsRolling(false);
      if (results.length === 0) return;

      const values = results.map((r) => r.value);
      const rawSum = values.reduce((a, b) => a + b, 0);
      const total = rawSum + modifier;
      const highest = Math.max(...values);
      const lowest = Math.min(...values);
      const average = Number((rawSum / values.length).toFixed(1));
      const criticalCount = results.filter((r) => r.isMax && r.sides >= 4).length;
      const fumbleCount = results.filter((r) => r.isMin && r.sides >= 20).length;

      const notation = `${diceCount}d${sides}${
        modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${Math.abs(modifier)}` : ''
      }`;

      const now = new Date();
      const timestamp = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const entry: RollHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp,
        label: rollLabel || `${ GEMSTONE_MATERIALS[gemstone].name } Throw`,
        notation,
        diceCount,
        sides,
        modifier,
        gemstone,
        individualValues: values,
        rawSum,
        total,
        highest,
        lowest,
        average,
        criticalCount,
        fumbleCount,
      };

      setLatestEntry(entry);
      setHistory((prev) => [entry, ...prev.slice(0, 99)]);
    },
    [diceCount, sides, modifier, gemstone, rollLabel]
  );

  const handleSelectPreset = (preset: CustomDiePreset) => {
    setDiceCount(preset.diceCount);
    setSides(preset.sides);
    setModifier(preset.modifier);
    setGemstone(preset.gemstone);
    setRollLabel(preset.name);
    setTimeout(() => {
      setRollTrigger((prev) => prev + 1);
    }, 10);
  };

  const handleRerollHistoryEntry = (entry: RollHistoryEntry) => {
    setDiceCount(entry.diceCount);
    setSides(entry.sides);
    setModifier(entry.modifier);
    setGemstone(entry.gemstone);
    setRollLabel(entry.label);
    setTimeout(() => {
      setRollTrigger((prev) => prev + 1);
    }, 10);
  };

  const handleCreatePreset = (newPreset: Omit<CustomDiePreset, 'id'>) => {
    const created: CustomDiePreset = {
      ...newPreset,
      id: `custom-${Date.now()}`,
    };
    setPresets((prev) => [created, ...prev]);
  };

  const handleDeletePreset = (id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0e0b08] select-none">
      {/* 1. Strict 3-Zone Top Bar Contract */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between gap-8 px-6 py-3.5 bg-[#120c08]/95 border-b border-amber-500/20">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#tabletop"
          onClick={(e) => {
            e.preventDefault();
            setActiveModal('none');
          }}
          className="text-lg font-bold tracking-wider text-amber-100 font-display whitespace-nowrap shrink-0"
        >
          Astral Gem
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-amber-200/75">
          <button
            type="button"
            onClick={() => setActiveModal('none')}
            className={`hover:text-amber-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModal === 'none' ? 'text-amber-300 underline' : ''
            }`}
          >
            Tabletop
          </button>
          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'history' ? 'none' : 'history')}
            className={`hover:text-amber-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModal === 'history' ? 'text-amber-300 underline' : ''
            }`}
          >
            Roll Chronicle ({history.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'forge' ? 'none' : 'forge')}
            className={`hover:text-amber-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModal === 'forge' ? 'text-amber-300 underline' : ''
            }`}
          >
            Custom Forge
          </button>
          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'presets' ? 'none' : 'presets')}
            className={`hover:text-amber-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModal === 'presets' ? 'text-amber-300 underline' : ''
            }`}
          >
            Presets
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={triggerRoll}
            className="px-4 py-2 text-xs font-semibold text-[#140e0a] bg-amber-500 rounded-lg hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Throw Dice
          </button>
        </div>
      </header>

      {/* 2. Top-Center Compact Horological Outcome Banner (Zero Center Viewport Occlusion) */}
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex flex-col items-center">
        {latestEntry && (
          <button
            type="button"
            onClick={() => setActiveModal('history')}
            title="Click to inspect full Roll Chronicle"
            className="pointer-events-auto px-5 py-2 rounded-xl bg-[#140e0a]/92 border border-amber-500/30 shadow-xl flex items-center gap-4 hover:border-amber-400/60 transition-colors cursor-pointer"
          >
            <div className="text-left">
              <div className="text-[11px] text-amber-200/65 flex items-center gap-1.5">
                <span>{ isRolling ? 'Tumbling on Walnut Tray...' : latestEntry.label }</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular text-amber-300">{latestEntry.notation}</span>
              </div>
              <div className="text-xs text-amber-100/85 font-mono-tabular mt-0.5 flex items-center gap-1.5">
                <span>
                  Faces: [{latestEntry.individualValues.join(', ')}]
                </span>
                {latestEntry.modifier !== 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Mod {latestEntry.modifier > 0 ? `+${latestEntry.modifier}` : latestEntry.modifier}
                    </span>
                  </>
                )}
                {latestEntry.criticalCount > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-300 font-semibold">
                      Max Roll ({latestEntry.criticalCount})
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="pl-4 border-l border-amber-500/20 text-right">
              <div className="text-[10px] text-amber-200/50">Total</div>
              <div className="text-2xl font-bold text-amber-300 font-mono-tabular leading-none">
                {isRolling ? '•••' : latestEntry.total}
              </div>
            </div>
          </button>
        )}
      </div>

      {/* 3. Full-Viewport 3D Gemstone Dice & Walnut Tabletop Canvas */}
      <main className="w-full h-full">
        <DiceArenaCanvas
          rollTrigger={rollTrigger}
          diceCount={diceCount}
          sides={sides}
          gemstone={gemstone}
          cameraView={cameraView}
          onRollStart={handleRollStart}
          onRollComplete={handleRollComplete}
        />
      </main>

      {/* 4. Collapsible Bottom Control Dock */}
      <BottomControlDock
        diceCount={diceCount}
        setDiceCount={(c) => {
          setDiceCount(c);
          setRollLabel('Custom Throw');
        }}
        sides={sides}
        setSides={(s) => {
          setSides(s);
          setRollLabel('Custom Throw');
        }}
        modifier={modifier}
        setModifier={setModifier}
        gemstone={gemstone}
        setGemstone={setGemstone}
        cameraView={cameraView}
        setCameraView={setCameraView}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        isRolling={isRolling}
        onRoll={triggerRoll}
        isCollapsed={dockCollapsed}
        onToggleCollapse={() => setDockCollapsed((prev) => !prev)}
      />

      {/* 5. Slide-Over Drawers for Roll Chronicle, Custom Dice Forge, and RPG Presets */}
      <DrawerModals
        activeModal={activeModal}
        onClose={() => setActiveModal('none')}
        history={history}
        onClearHistory={() => setHistory([])}
        onRerollEntry={handleRerollHistoryEntry}
        presets={presets}
        onSelectPreset={handleSelectPreset}
        onCreatePreset={handleCreatePreset}
        onDeletePreset={handleDeletePreset}
      />
    </div>
  );
}
