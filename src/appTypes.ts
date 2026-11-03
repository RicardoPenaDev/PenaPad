// Tipos compartilhados pela interface
import type { monaco } from './monaco';
import type { DiffSide } from './components/DiffView';
import type { Pane } from './session';
import type { Encoding, Eol, FileStat } from './types';

export type Ed = monaco.editor.IStandaloneCodeEditor;

export interface Tab {
  pane: Pane; // 0 = vista principal, 1 = segunda vista (tela dividida)
  id: string;
  name: string;
  path: string | null;
  language: string;
  encoding: Encoding;
  eol: Eol;
  dirty: boolean;
  metaDirty: boolean; // ex.: codificação alterada
}

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  whitespace: boolean;
  theme: ThemeMode;
  zoom: number;
  splitDir: 'row' | 'col'; // lado a lado | um em cima do outro
  autoUpdate: boolean; // procura versões novas uma vez por dia
}

export interface RestoreInfo { id: string; dirty: boolean; metaDirty: boolean; language: string; view: monaco.editor.ICodeEditorViewState | null; pane: Pane }

/** Aba fechada guardada para ⇧⌘T. Arquivos sem alterações não guardam o texto (é relido do disco). */
export interface ClosedTab {
  name: string;
  path: string | null;
  language: string;
  encoding: Encoding;
  eol: Eol;
  content: string | null;
  wasDirty: boolean;
  view: monaco.editor.ICodeEditorViewState | null;
  pane: Pane;
  disk: FileStat | null;
}
export const MAX_CLOSED = 10;
export const MAX_CLOSED_CHARS = 20_000_000; // ~40 MB de texto no total

export interface DiffState { original: DiffSide; modified: DiffSide; temp: monaco.editor.ITextModel[]; kind: 'tabs' | 'external' | 'history'; tabId?: string; when?: string }

