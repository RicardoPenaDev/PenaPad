// Sessão: o que fica gravado ao fechar e como é restaurado ao abrir.
// Regra principal: todo backup que estiver no disco volta como aba. Se a lista de abas sumir ou estragar,
// os textos voltam como "Recuperado N", em vez de serem apagados na próxima gravação.

import type { monaco } from './monaco';
import type { Encoding, Eol, FileStat } from './types';

export type Pane = 0 | 1;

/** Como cada aba é gravada na sessão (o conteúdo vai em arquivo de backup separado) */
export interface SessionTab {
  id: string;
  name: string;
  path: string | null;
  language: string;
  encoding: Encoding;
  eol: Eol;
  dirty: boolean;
  metaDirty: boolean;
  view: monaco.editor.ICodeEditorViewState | null;
  pane?: Pane;
  disk?: FileStat | null;
}

export interface SessionMeta {
  v: 1;
  active: string;
  tabs: SessionTab[];
  actives?: [string, string];
  split?: boolean;
  ratio?: number;
  focus?: Pane;
}

/** Lê a lista de abas gravada; null se não houver ou não for reconhecida */
export function parseSession(text: string | null | undefined): SessionMeta | null {
  if (!text) return null;
  try {
    const m = JSON.parse(text) as SessionMeta;
    if (m?.v !== 1 || !Array.isArray(m.tabs)) return null;
    // Descarta entradas sem id ou nome (não dá para restaurar com segurança)
    m.tabs = m.tabs.filter((t) => t && typeof t.id === 'string' && typeof t.name === 'string');
    return m;
  } catch {
    return null;
  }
}

export interface RestorePlan {
  /** Abas da lista gravada, na ordem, com o texto do backup quando houver */
  tabs: { tab: SessionTab; backup?: string }[];
  /** Arquivos sem alterações: o texto é relido do disco */
  toRead: string[];
  /** Backups que a lista não menciona: voltam como abas "Recuperado N" */
  orphans: { id: string; text: string }[];
}

export function planRestore(meta: SessionMeta | null, backups: Record<string, string>): RestorePlan {
  const tabs = (meta?.tabs ?? []).map((tab) => ({ tab, backup: backups[tab.id] }));
  const known = new Set(tabs.map((t) => t.tab.id));
  const toRead = tabs.filter((t) => t.tab.path && t.backup === undefined).map((t) => t.tab.path!);
  const orphans = Object.entries(backups)
    .filter(([id, text]) => !known.has(id) && text.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, text]) => ({ id, text }));
  return { tabs, toRead, orphans };
}
