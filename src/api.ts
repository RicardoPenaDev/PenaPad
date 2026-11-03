import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getVersion } from '@tauri-apps/api/app';
import type { Encoding, FileStat, OpenedDoc } from './types';

export interface HistoryEntry { id: string; ts: number; reason: string; size: number; lines: number; name: string }

type Saved = { path: string; name: string; mtime: number; size: number };

function subscribe<T>(event: string, cb: (payload: T) => void): () => void {
  const p = listen<T>(event, (e) => cb(e.payload));
  return () => { p.then((off) => off()); };
}

export const api = {
  openFiles: () => invoke<OpenedDoc[]>('open_files'),
  openPaths: (paths: string[]) => invoke<OpenedDoc[]>('open_paths', { paths }),
  save: (p: { path: string; content: string; encoding: Encoding }) => invoke<Saved>('save_file', p),
  saveAs: (p: { content: string; encoding: Encoding; suggestedName?: string }) => invoke<Saved | null>('save_as', p),
  historySave: (key: string, name: string, reason: string, content: string) => invoke<HistoryEntry | null>('history_save', { key, name, reason, content }),
  historyList: (key: string) => invoke<HistoryEntry[]>('history_list', { key }),
  historyRead: (key: string, id: string) => invoke<string>('history_read', { key, id }),
  historyRename: (from: string, to: string) => invoke<void>('history_rename', { from, to }),
  debugEnabled: () => invoke<boolean>('debug_enabled'),
  debugTakeCmd: () => invoke<string | null>('debug_take_cmd'),
  debugWrite: (text: string) => invoke<void>('debug_write', { text }),
  stat: (paths: string[]) => invoke<(FileStat | null)[]>('stat_paths', { paths }),
  confirmOverwrite: (name: string) => invoke<'compare' | 'overwrite' | 'cancel'>('confirm_overwrite', { name }),
  confirmClose: (name: string) => invoke<'save' | 'discard' | 'cancel'>('confirm_close', { name }),
  clipboardRead: () => invoke<string>('clipboard_read'),
  clipboardWrite: (text: string) => invoke<void>('clipboard_write', { text }),
  sessionLoad: () => invoke<{ meta: string | null; backups: Record<string, string>; problem: string | null }>('session_load'),
  sessionBackup: (id: string, content: string | null) => invoke<void>('session_backup', { id, content }),
  sessionSave: (meta: string, keep: string[], prune: boolean) => invoke<void>('session_save', { meta, keep, prune }),
  readPathsQuiet: (paths: string[]) => invoke<(OpenedDoc | null)[]>('read_paths_quiet', { paths }),
  tabMenu: (tabId: string, moveLabel: string) => { invoke('show_tab_menu', { tabId, moveLabel }); },
  contextMenu: (p: { hasSelection: boolean; canUndo: boolean; canRedo: boolean }) => { invoke('show_context_menu', p); },
  setTitle: (title: string) => { invoke('set_title', { title }); },
  toggleFullscreen: () => { invoke('toggle_fullscreen'); },
  requestQuit: () => { invoke('request_quit_cmd'); },
  setTheme: (mode: 'system' | 'light' | 'dark') => { invoke('set_theme', { mode }); },
  /** Idioma dos menus e janelas nativas: 'auto' segue o sistema */
  setLanguage: (pref: 'auto' | 'pt' | 'en') => { invoke('set_language', { pref }).catch(() => {}); },
  quit: () => { invoke('quit'); },
  updateCheck: () => invoke<import('./components/UpdateBanner').UpdateInfo | null>('update_check'),
  updateInstall: () => invoke<void>('update_install'),
  openReleases: (version?: string) => { invoke('open_releases', { version: version ?? null }); },
  openLink: (kind: string) => { invoke('open_link', { kind }); },
  donateEnabled: () => invoke<boolean>('donate_enabled').catch(() => false),
  appVersion: () => getVersion().catch(() => '?'),
  /** Não deu para gravar a sessão ao sair: o app pergunta antes de fechar */
  quitBlocked: (error: string) => { invoke('quit_blocked', { error }); },
  /** Mostra a janela e devolve arquivos recebidos do Finder antes da interface carregar */
  ready: () => invoke<OpenedDoc[]>('renderer_ready'),
  onMenu: (cb: (cmd: string, arg?: string) => void) => subscribe<{ cmd: string; arg?: string | null }>('menu', (p) => cb(p.cmd, p.arg ?? undefined)),
  onSessionFlush: (cb: () => void) => subscribe<null>('session-flush', () => cb()),
  onWindowFocus: (cb: () => void) => {
    const p = getCurrentWindow().onFocusChanged(({ payload }) => { if (payload) cb(); });
    return () => { p.then((off) => off()); };
  },
  onFileOpened: (cb: (doc: OpenedDoc) => void) => subscribe<OpenedDoc>('file-opened', cb),
  onDropFiles: (cb: (paths: string[]) => void) => {
    const p = getCurrentWebview().onDragDropEvent((e) => { if (e.payload.type === 'drop') cb(e.payload.paths); });
    return () => { p.then((off) => off()); };
  },
};
