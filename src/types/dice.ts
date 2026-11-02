export type GemstonePresetId =
  | 'ruby'
  | 'sapphire'
  | 'emerald'
  | 'amethyst'
  | 'citrine'
  | 'obsidian'
  | 'moonstone';

export interface GemstoneMaterialConfig {
  id: GemstonePresetId;
  name: string;
  subtitle: string;
  color: string;
  attenuationColor: string;
  inlayColor: string;
  coreColor: string;
  ior: number;
  roughness: number;
  transmission: number;
  swatchHex: string;
}

export interface CustomDiePreset {
  id: string;
  name: string;
  diceCount: number;
  sides: number;
  modifier: number;
  gemstone: GemstonePresetId;
  description: string;
}

export interface IndividualDieResult {
  dieIndex: number;
  sides: number;
  value: number;
  isMax: boolean;
  isMin: boolean;
  gemstone: GemstonePresetId;
}

export interface RollHistoryEntry {
  id: string;
  timestamp: string;
  label: string;
  notation: string;
  diceCount: number;
  sides: number;
  modifier: number;
  gemstone: GemstonePresetId;
  individualValues: number[];
  rawSum: number;
  total: number;
  highest: number;
  lowest: number;
  average: number;
  criticalCount: number;
  fumbleCount: number;
}

export type CameraViewId = 'tavern' | 'overhead' | 'closeup';
