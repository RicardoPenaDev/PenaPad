// Preferências do usuário (guardadas no armazenamento local do WebView)
import type { Settings } from './appTypes';
import { storeGet } from './storage';

export const DEFAULT_SETTINGS: Settings = { wordWrap: false, minimap: false, lineNumbers: true, whitespace: false, theme: 'system', zoom: 100, splitDir: 'row' };
export const BASE_FONT = 13.5;

export function loadSettings(): Settings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(storeGet('settings') || '{}') }; }
  catch { return DEFAULT_SETTINGS; }
}

export const clampZoom = (z: number) => Math.max(50, Math.min(300, Math.round(z / 10) * 10));

export const clampRatio = (r: number) => Math.max(0.15, Math.min(0.85, r));

