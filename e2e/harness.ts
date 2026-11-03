// Roda a interface do PenaPad no navegador, com a parte nativa (Rust) simulada em memória.
// Os testes (e2e/*.spec.ts) preparam o estado inicial em `window.__ppInit` e leem/alteram `window.__pp`.
import { emit } from '@tauri-apps/api/event';
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';

type Doc = { path: string; name: string; content: string; encoding: string; eol: string; mtime: number; size: number };

interface Init {
  files?: Record<string, string>;
  session?: { meta: string | null; backups: Record<string, string>; problem?: string | null };
  /** Respostas das janelas de confirmação ao fechar uma aba, na ordem */
  confirmClose?: ('save' | 'discard' | 'cancel')[];
  /** Arquivos escolhidos em "Abrir…", um lote por chamada */
  openFiles?: string[][];
  /** Caminhos escolhidos em "Salvar Como…" */
  saveAs?: string[];
  /** Simula disco sem espaço nas gravações da sessão */
  failSession?: boolean;
}

const init: Init = (window as unknown as { __ppInit?: Init }).__ppInit ?? {};

const state = {
  files: new Map(Object.entries(init.files ?? {})),
  mtimes: new Map<string, number>(),
  session: { meta: init.session?.meta ?? null, backups: { ...(init.session?.backups ?? {}) } as Record<string, string>, problem: init.session?.problem ?? null },
  history: new Map<string, { id: string; ts: number; reason: string; size: number; lines: number; name: string; content: string }[]>(),
  clipboard: '',
  calls: [] as { cmd: string; args: unknown }[],
  debug: null as unknown,
  cmds: [] as string[],
  quit: false,
  quitBlocked: null as string | null,
  title: '',
  failSession: !!init.failSession,
  confirmClose: [...(init.confirmClose ?? [])],
  openFiles: [...(init.openFiles ?? [])],
  saveAs: [...(init.saveAs ?? [])],
};

const nameOf = (p: string) => p.split(/[\\/]/).pop() ?? p;
function doc(path: string): Doc | null {
  const content = state.files.get(path);
  if (content === undefined) return null;
  if (!state.mtimes.has(path)) state.mtimes.set(path, 1000);
  return { path, name: nameOf(path), content, encoding: 'utf8', eol: content.includes('\r\n') ? 'CRLF' : 'LF', mtime: state.mtimes.get(path)!, size: content.length };
}
function write(path: string, content: string) {
  state.files.set(path, content);
  state.mtimes.set(path, (state.mtimes.get(path) ?? 1000) + 1);
  return { path, name: nameOf(path), mtime: state.mtimes.get(path)!, size: content.length };
}
const fail = () => { if (state.failSession) throw 'o disco está cheio'; };

type Args = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const handlers: Record<string, (a: Args) => unknown> = {
  debug_enabled: () => true,
  debug_write: (a) => { state.debug = JSON.parse(a.text); },
  debug_take_cmd: () => state.cmds.shift() ?? null,
  renderer_ready: () => [],
  session_load: () => ({ ...state.session, backups: { ...state.session.backups } }),
  session_backup: (a) => { fail(); if (a.content === null) delete state.session.backups[a.id]; else state.session.backups[a.id] = a.content; },
  session_save: (a) => {
    fail();
    state.session.meta = a.meta;
    if (a.prune) for (const id of Object.keys(state.session.backups)) if (!a.keep.includes(id)) delete state.session.backups[id];
  },
  open_files: () => (state.openFiles.shift() ?? []).map(doc).filter(Boolean),
  open_paths: (a) => a.paths.map(doc).filter(Boolean),
  read_paths_quiet: (a) => a.paths.map(doc),
  save_file: (a) => write(a.path, a.content),
  save_as: (a) => { const p = state.saveAs.shift(); return p ? write(p, a.content) : null; },
  stat_paths: (a) => a.paths.map((p: string) => (state.files.has(p) ? { mtime: state.mtimes.get(p) ?? 1000, size: state.files.get(p)!.length } : null)),
  confirm_close: () => state.confirmClose.shift() ?? 'discard',
  confirm_overwrite: () => 'overwrite',
  clipboard_read: () => state.clipboard,
  clipboard_write: (a) => { state.clipboard = a.text; },
  history_save: (a) => {
    const list = state.history.get(a.key) ?? [];
    if (list[0]?.content === a.content) return null;
    const e = { id: `h${list.length + 1}`, ts: Date.now(), reason: a.reason, size: a.content.length, lines: a.content.split('\n').length, name: a.name, content: a.content };
    state.history.set(a.key, [e, ...list]);
    return e;
  },
  history_list: (a) => state.history.get(a.key) ?? [],
  history_read: (a) => state.history.get(a.key)?.find((e) => e.id === a.id)?.content ?? '',
  history_rename: (a) => { const l = state.history.get(a.from); if (l) { state.history.set(a.to, l); state.history.delete(a.from); } },
  set_title: (a) => { state.title = a.title; },
  quit: () => { state.quit = true; },
  quit_blocked: (a) => { state.quitBlocked = a.error; },
};

mockWindows('main');
mockIPC((cmd, args) => {
  state.calls.push({ cmd, args });
  const h = handlers[cmd];
  return h ? h((args ?? {}) as Args) : null; // menus nativos, tema, etc.: nada a fazer no navegador
}, { shouldMockEvents: true });

(window as unknown as { __pp: unknown }).__pp = {
  state,
  /** Comando de teste, como o cmd.txt do app real */
  cmd: (c: string) => state.cmds.push(c),
  emit: (event: string, payload?: unknown) => emit(event, payload),
};

await import('../src/main');
