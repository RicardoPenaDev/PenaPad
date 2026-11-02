import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { monaco, detectLanguage, allLanguages } from './monaco';
import { api, type HistoryEntry } from './api';
import type { Encoding, Eol, FileStat, OpenedDoc } from './types';
import TitleBar from './components/TitleBar';
import Ribbon, { type RibbonState } from './components/Ribbon';
import TabBar from './components/TabBar';
import FindPanel, { type FindController } from './components/FindPanel';
import StatusBar, { type Problem, type StatusInfo } from './components/StatusBar';
import DiffView, { type DiffSide } from './components/DiffView';
import PromptDialog from './components/PromptDialog';
import PickDialog, { type PickItem } from './components/PickDialog';
import { applyLineOp, type LineOp } from './lineOps';
import CommandPalette, { type PaletteItem } from './components/CommandPalette';
import { COMMANDS } from './commands';
import { storeGet, storeSet } from './storage';
import { IS_MAC, keys, kt } from './platform';
import { parseSession, planRestore, type Pane, type SessionMeta } from './session';

// Evita redesenhar a faixa de opções e as abas a cada movimento do cursor
const RibbonM = memo(Ribbon);
const TabBarM = memo(TabBar);

type Ed = monaco.editor.IStandaloneCodeEditor;

interface Tab {
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

type ThemeMode = 'system' | 'light' | 'dark';

interface Settings {
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  whitespace: boolean;
  theme: ThemeMode;
  zoom: number;
  splitDir: 'row' | 'col'; // lado a lado | um em cima do outro
}

const DEFAULT_SETTINGS: Settings = { wordWrap: false, minimap: false, lineNumbers: true, whitespace: false, theme: 'system', zoom: 100, splitDir: 'row' };
const BASE_FONT = 13.5;

function loadSettings(): Settings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(storeGet('settings') || '{}') }; }
  catch { return DEFAULT_SETTINGS; }
}

const clampZoom = (z: number) => Math.max(50, Math.min(300, Math.round(z / 10) * 10));

let untitledCounter = 0;

interface RestoreInfo { id: string; dirty: boolean; metaDirty: boolean; language: string; view: monaco.editor.ICodeEditorViewState | null; pane: Pane }

const EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  model: null,
  automaticLayout: true,
  fontFamily: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Monaco, 'Cascadia Mono', Consolas, 'DejaVu Sans Mono', 'Liberation Mono', 'Ubuntu Mono', monospace",
  fontSize: BASE_FONT,
  lineHeight: 1.55,
  fontLigatures: false,
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  padding: { top: 10, bottom: 10 },
  scrollBeyondLastLine: false,
  roundedSelection: true,
  renderLineHighlight: 'all',
  bracketPairColorization: { enabled: true },
  guides: { bracketPairs: 'active', indentation: true },
  stickyScroll: { enabled: false },
  dropIntoEditor: { enabled: false },
  multiCursorModifier: 'ctrlCmd', // Option+arrastar = seleção em coluna; Cmd+clique = cursor extra
  folding: true,
  showFoldingControls: 'mouseover',
  scrollbar: { verticalScrollbarSize: 11, horizontalScrollbarSize: 11, useShadows: false },
  fixedOverflowWidgets: true,
  contextmenu: false, // usamos o menu nativo do macOS
  wordBasedSuggestions: 'currentDocument',
  links: false,
  hover: { enabled: 'off' },
};

const clampRatio = (r: number) => Math.max(0.15, Math.min(0.85, r));

/** Aba fechada guardada para ⇧⌘T. Arquivos sem alterações não guardam o texto (é relido do disco). */
interface ClosedTab {
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
const MAX_CLOSED = 10;
const MAX_CLOSED_CHARS = 20_000_000; // ~40 MB de texto no total

interface DiffState { original: DiffSide; modified: DiffSide; temp: monaco.editor.ITextModel[]; kind: 'tabs' | 'external' | 'history'; tabId?: string; when?: string }

/** Chave do histórico: arquivos pelo caminho (continua ao reabrir), textos sem arquivo pela aba */
const historyKey = (t: { id: string; path: string | null }) => (t.path ? `f:${t.path}` : `u:${t.id}`);

const REASONS: Record<string, string> = {
  aberto: 'Ao abrir o arquivo',
  salvo: 'Salvo',
  auto: 'Automático (durante a edição)',
  fechado: 'Aba fechada sem salvar',
  recarregar: 'Antes de recarregar do disco',
  sobrescrever: 'Versão do disco antes de sobrescrever',
  restaurar: 'Antes de restaurar uma versão',
};

function formatWhen(ts: number): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const today = new Date();
  const yest = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return `hoje às ${time}`;
  if (d.toDateString() === yest.toDateString()) return `ontem às ${time}`;
  return `${d.toLocaleDateString('pt-BR')} às ${time}`;
}
const formatSize = (n: number) => (n < 1024 ? `${n} bytes` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

// Mensagens do validador de JSON (em inglês) → português
const JSON_MSGS: [RegExp, string][] = [
  [/^Expected comma or closing bracket/i, 'falta uma vírgula ou o colchete de fechamento ( ] )'],
  [/^Expected comma or closing brace/i, 'falta uma vírgula ou a chave de fechamento ( } )'],
  [/^Expected comma/i, 'falta uma vírgula'],
  [/^Colon expected/i, 'falta o dois-pontos ( : ) depois da chave'],
  [/^Value expected/i, 'falta um valor'],
  [/^Property expected/i, 'falta uma propriedade'],
  [/^Property keys must be doublequoted/i, 'as chaves precisam estar entre aspas duplas'],
  [/^Trailing comma/i, 'vírgula sobrando antes do fechamento'],
  [/^End of file expected/i, 'há conteúdo depois do fim do JSON'],
  [/^Comments are not permitted/i, 'comentários não são permitidos em JSON'],
  [/^(Unexpected end of string|Unterminated string)/i, 'texto (string) sem as aspas de fechamento'],
  [/^Closing bracket expected/i, 'falta o colchete de fechamento ( ] )'],
  [/^Closing brace expected/i, 'falta a chave de fechamento ( } )'],
  [/^Duplicate object key/i, 'chave repetida no mesmo objeto'],
  [/^Invalid number format/i, 'número em formato inválido'],
  [/^Invalid escape character/i, 'caractere de escape ( \\ ) inválido no texto'],
  [/^Invalid unicode sequence/i, 'sequência unicode ( \\u ) inválida'],
  [/^Invalid characters in string/i, 'caractere de controle (ex.: TAB ou quebra de linha) dentro do texto; use \\t ou \\n'],
  [/^Invalid symbol/i, 'símbolo inválido'],
  [/^Incorrect type/i, 'tipo incorreto'],
];
const translateProblem = (msg: string) => JSON_MSGS.find(([re]) => re.test(msg))?.[1] ?? msg;

/** Executa "Formatar Documento" esperando o formatador carregar (o de JSON carrega sob demanda) */
async function runFormat(ed: Ed): Promise<boolean> {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const a = ed.getAction('editor.action.formatDocument');
    if (a?.isSupported()) { await a.run(); return true; }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

const editorFocused = () => !!(document.activeElement as HTMLElement | null)?.closest?.('.monaco-editor');

const inputFocused = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT') && !el.closest('.monaco-editor');
};

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [actives, setActives] = useState<[string, string]>(['', '']);
  const [focus, setFocusState] = useState<Pane>(0);
  const [split, setSplitState] = useState(false);
  const [ratio, setRatioState] = useState(0.5);
  const [eds, setEds] = useState<[Ed | null, Ed | null]>([null, null]);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const [status, setStatus] = useState<StatusInfo>({ line: 1, col: 1, selChars: 0, selLines: 0, cursors: 1, totalChars: 0, totalLines: 1 });
  const [find, setFind] = useState({ open: false, replace: false, token: 0 });

  const host0 = useRef<HTMLDivElement>(null);
  const host1 = useRef<HTMLDivElement>(null);
  const paneBox = useRef<HTMLDivElement>(null);
  const models = useRef(new Map<string, monaco.editor.ITextModel>());
  const viewStates = useRef(new Map<string, monaco.editor.ICodeEditorViewState | null>());
  const savedVersions = useRef(new Map<string, number>());
  const tabsRef = useRef(tabs);
  const edRef = useRef<[Ed | null, Ed | null]>([null, null]);
  const activesRef = useRef<[string, string]>(['', '']);
  const focusRef = useRef<Pane>(0);
  const splitRef = useRef(false);
  const ratioRef = useRef(0.5);
  const settingsRef = useRef(settings);
  const findCtl = useRef<FindController | null>(null);
  const diskStat = useRef(new Map<string, FileStat>()); // como o arquivo estava no disco quando abrimos/salvamos
  const [columnSel, setColumnSel] = useState(false);
  const columnSelRef = useRef(false);
  columnSelRef.current = columnSel;
  tabsRef.current = tabs;
  settingsRef.current = settings;

  const dark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark);
  const editor = eds[focus]; // editor da vista em foco
  const activeId = actives[focus];
  const active = tabs.find((t) => t.id === activeId);

  const setFocus = useCallback((p: Pane) => { focusRef.current = p; setFocusState(p); }, []);
  const setSplit = useCallback((v: boolean) => { splitRef.current = v; setSplitState(v); }, []);
  const setRatio = useCallback((r: number) => { ratioRef.current = clampRatio(r); setRatioState(ratioRef.current); }, []);
  const setActive = useCallback((p: Pane, id: string) => {
    const a: [string, string] = [...activesRef.current];
    a[p] = id;
    activesRef.current = a;
    setActives(a);
  }, []);
  const commitTabs = (list: Tab[]) => { tabsRef.current = list; setTabs(list); };

  // ---------- Editores (o segundo só existe com a tela dividida, para poupar memória) ----------
  const applyOptions = (ed: Ed) => {
    const st = settingsRef.current;
    ed.updateOptions({
      wordWrap: st.wordWrap ? 'on' : 'off',
      minimap: { enabled: st.minimap, renderCharacters: false, scale: 1 },
      lineNumbers: st.lineNumbers ? 'on' : 'off',
      renderWhitespace: st.whitespace ? 'all' : 'selection',
      fontSize: Math.round((BASE_FONT * st.zoom) / 100 * 2) / 2,
      columnSelection: columnSelRef.current,
    });
  };

  const ensureEditor = useCallback((p: Pane): Ed => {
    const existing = edRef.current[p];
    if (existing) return existing;
    const ed = monaco.editor.create((p === 0 ? host0 : host1).current!, EDITOR_OPTIONS);
    applyOptions(ed);
    ed.onDidFocusEditorWidget(() => setFocus(p));
    const next: [Ed | null, Ed | null] = [...edRef.current];
    next[p] = ed;
    edRef.current = next;
    setEds(next);
    return ed;
  }, [setFocus]);

  useEffect(() => {
    ensureEditor(0);
    return () => { edRef.current.forEach((e) => e?.dispose()); edRef.current = [null, null]; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { eds.forEach((e) => e && applyOptions(e)); }, [eds, settings, columnSel]);

  useEffect(() => {
    storeSet('settings', JSON.stringify(settings));
  }, [settings]);

  // ---------- Tema ----------
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const h = () => setSystemDark(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    monaco.editor.setTheme(dark ? 'penapad-dark' : 'penapad-light');
  }, [dark]);
  useEffect(() => { api.setTheme(settings.theme); }, [settings.theme]);

  // ---------- Status ----------
  const updateStatus = useCallback(() => {
    if (!editor) return;
    const model = editor.getModel();
    const pos = editor.getPosition();
    const sels = editor.getSelections() ?? [];
    if (!model || !pos) return;
    const primary = sels[0];
    const selChars = sels.reduce((n, s) => n + model.getValueLengthInRange(s), 0);
    setStatus({
      line: pos.lineNumber,
      col: pos.column,
      selChars,
      selLines: primary && !primary.isEmpty() ? primary.endLineNumber - primary.startLineNumber + 1 : 0,
      cursors: sels.length,
      totalChars: model.getValueLength(),
      totalLines: model.getLineCount(),
    });
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const ds = [
      editor.onDidChangeCursorSelection(updateStatus),
      editor.onDidChangeModelContent(updateStatus),
      editor.onDidChangeModel(updateStatus),
    ];
    updateStatus();
    return () => ds.forEach((d) => d.dispose());
  }, [editor, updateStatus]);

  // ---------- Abas ----------
  const patchTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const recomputeDirty = useCallback((id: string) => {
    const m = models.current.get(id);
    if (!m) return;
    const dirty = m.getAlternativeVersionId() !== savedVersions.current.get(id);
    setTabs((ts) => ts.map((t) => (t.id === id && t.dirty !== dirty ? { ...t, dirty } : t)));
  }, []);

  /** Mostra a aba na vista dela (e, se takeFocus, passa o foco para essa vista) */
  const activate = useCallback((id: string, takeFocus = true) => {
    const tab = tabsRef.current.find((t) => t.id === id);
    const m = models.current.get(id);
    if (!tab || !m) return;
    const p = tab.pane;
    const ed = ensureEditor(p);
    const cur = activesRef.current[p];
    const curModel = cur ? models.current.get(cur) : undefined;
    if (cur && cur !== id && curModel && ed.getModel() === curModel) viewStates.current.set(cur, ed.saveViewState());
    if (ed.getModel() !== m) {
      ed.setModel(m);
      const vs = viewStates.current.get(id);
      if (vs) ed.restoreViewState(vs);
    }
    setActive(p, id);
    if (takeFocus) {
      setFocus(p);
      requestAnimationFrame(() => ed.focus());
      if (tab.path) checkExternalRef.current([id]);
    }
  }, [ensureEditor, setActive, setFocus]);
  const checkExternalRef = useRef<(only?: string[]) => void>(() => {});
  const snapshotRef = useRef<(id: string, reason: string, text?: string) => Promise<void>>(async () => {});

  const addTab = useCallback((doc?: OpenedDoc, restore?: RestoreInfo, pane?: Pane) => {
    const p: Pane = restore?.pane ?? pane ?? focusRef.current;
    if (p === 1 && !splitRef.current) setSplit(true);
    const id = restore?.id ?? crypto.randomUUID();
    const name = doc?.name ?? `Sem título ${++untitledCounter}`;
    const language = restore?.language ?? (doc ? detectLanguage(doc.name) : 'plaintext');
    const model = monaco.editor.createModel(doc?.content ?? '', language, monaco.Uri.parse(`file:///penapad/${id}/${encodeURIComponent(name)}`));
    model.setEOL(doc?.eol === 'CRLF' ? monaco.editor.EndOfLineSequence.CRLF : monaco.editor.EndOfLineSequence.LF);
    model.updateOptions({ insertSpaces: true, tabSize: 4 });
    models.current.set(id, model);
    // Aba restaurada com alterações não salvas: continua marcada como alterada
    savedVersions.current.set(id, restore?.dirty ? -1 : model.getAlternativeVersionId());
    if (restore?.view) viewStates.current.set(id, restore.view);
    if (doc?.path && doc.mtime !== undefined) diskStat.current.set(id, { mtime: doc.mtime, size: doc.size ?? 0 });
    // cópia do arquivo como estava ao abrir (depois que a aba entrar na lista)
    if (doc?.path && !restore?.dirty && doc.content) window.setTimeout(() => snapshotRef.current(id, 'aberto'), 0);
    model.onDidChangeContent(() => { recomputeDirty(id); scheduleSaveRef.current(id); });
    const tab: Tab = {
      pane: p, id, name, path: doc?.path || null, language, encoding: doc?.encoding ?? 'utf8', eol: doc?.eol ?? 'LF',
      dirty: !!restore?.dirty, metaDirty: !!restore?.metaDirty,
    };
    commitTabs([...tabsRef.current, tab]);
    activate(id);
    return id;
  }, [activate, recomputeDirty, setSplit]);

  // ---------- Tela dividida ----------
  /** Junta tudo na vista principal e remove o segundo editor */
  const unsplit = useCallback(() => {
    const ed1 = edRef.current[1];
    const a1 = activesRef.current[1];
    if (ed1 && a1 && ed1.getModel() === models.current.get(a1)) viewStates.current.set(a1, ed1.saveViewState());
    if (ed1) { ed1.setModel(null); ed1.dispose(); }
    edRef.current = [edRef.current[0], null];
    setEds(edRef.current);
    commitTabs(tabsRef.current.map((t) => (t.pane === 1 ? { ...t, pane: 0 } : t)));
    setActive(1, '');
    setSplit(false);
    setFocus(0);
    const a0 = activesRef.current[0];
    const target = (a0 && models.current.has(a0) ? a0 : '') || (a1 && models.current.has(a1) ? a1 : '') || tabsRef.current[0]?.id;
    if (target) activate(target);
  }, [activate, setActive, setFocus, setSplit]);

  /** Move uma aba para a outra vista (abre a divisão se preciso) */
  const moveOther = useCallback((id: string) => {
    const t = tabsRef.current.find((x) => x.id === id);
    if (!t) return;
    const from = t.pane;
    const to: Pane = from === 0 ? 1 : 0;
    const fromTabs = tabsRef.current.filter((x) => x.pane === from);
    const idx = fromTabs.findIndex((x) => x.id === id);
    const edFrom = edRef.current[from];
    const m = models.current.get(id);
    if (edFrom && m && edFrom.getModel() === m) {
      viewStates.current.set(id, edFrom.saveViewState());
      edFrom.setModel(null);
    }
    if (activesRef.current[from] === id) setActive(from, '');
    if (to === 1 && !splitRef.current) setSplit(true);
    commitTabs(tabsRef.current.map((x) => (x.id === id ? { ...x, pane: to } : x)));
    activate(id);
    const rest = fromTabs.filter((x) => x.id !== id);
    if (rest.length) {
      if (!activesRef.current[from]) activate(rest[Math.min(idx, rest.length - 1)].id, false);
    } else if (from === 1) {
      unsplit();
    } else {
      // A vista principal ficou vazia: abre uma aba em branco nela e devolve o foco
      addTab(undefined, undefined, 0);
      activate(id);
    }
  }, [activate, addTab, setActive, setSplit, unsplit]);

  const toggleSplit = useCallback(() => {
    if (splitRef.current) { unsplit(); return; }
    const a0 = activesRef.current[0];
    if (tabsRef.current.filter((t) => t.pane === 0).length >= 2 && a0) moveOther(a0);
    else addTab(undefined, undefined, 1);
  }, [addTab, moveOther, unsplit]);

  // ---------- Sessão: tudo o que está aberto é mantido ao fechar o app ----------
  const restored = useRef(false);
  /** A sessão anterior foi restaurada por inteiro: só então backups de abas fechadas podem ser apagados */
  const restoreOk = useRef(false);
  const saveErrorAt = useRef(0);
  const restoreNote = useRef<string | null>(null);
  const pendingBackup = useRef(new Set<string>());
  const saveTimer = useRef<number | undefined>(undefined);
  const flushChain = useRef<Promise<void>>(Promise.resolve());

  /** Abas sem arquivo (com texto) ou com alterações não salvas precisam de backup do conteúdo */
  const needsBackup = (t: Tab) => {
    const m = models.current.get(t.id);
    if (!m) return false;
    if (!t.path) return m.getValueLength() > 0;
    return t.metaDirty || m.getAlternativeVersionId() !== savedVersions.current.get(t.id);
  };

  const doFlush = useCallback(async () => {
    if (!restored.current) return;
    window.clearTimeout(saveTimer.current);
    const tabsNow = tabsRef.current;
    const ids = [...pendingBackup.current];
    pendingBackup.current.clear();
    for (const id of ids) {
      const t = tabsNow.find((x) => x.id === id);
      const m = models.current.get(id);
      if (!(t && m && needsBackup(t))) continue;
      try {
        await api.sessionBackup(id, m.getValue());
      } catch (e) {
        // Tenta de novo na próxima gravação, sem perder a marcação
        ids.slice(ids.indexOf(id)).forEach((x) => pendingBackup.current.add(x));
        throw e;
      }
    }
    for (const p of [0, 1] as Pane[]) {
      const ed = edRef.current[p];
      const a = activesRef.current[p];
      if (ed && a && ed.getModel() === models.current.get(a)) viewStates.current.set(a, ed.saveViewState());
    }
    const meta: SessionMeta = {
      v: 1,
      active: activesRef.current[focusRef.current],
      actives: activesRef.current,
      split: splitRef.current,
      ratio: ratioRef.current,
      focus: focusRef.current,
      tabs: tabsNow
        .filter((t) => t.path || needsBackup(t))
        .map((t) => ({
          id: t.id, name: t.name, path: t.path, language: t.language, encoding: t.encoding, eol: t.eol,
          dirty: t.path ? needsBackup(t) : false, metaDirty: t.metaDirty, view: viewStates.current.get(t.id) ?? null, pane: t.pane,
          disk: diskStat.current.get(t.id) ?? null,
        })),
    };
    await api.sessionSave(JSON.stringify(meta), tabsNow.filter(needsBackup).map((t) => t.id), restoreOk.current);
  }, []);

  /** Grava a sessão; erros (disco cheio, sem permissão) aparecem na barra de status */
  const flush = useCallback(() => {
    const run = flushChain.current.then(doFlush);
    flushChain.current = run.catch((e) => {
      console.error('sessão', e);
      const now = Date.now();
      if (now - saveErrorAt.current > 30_000) {
        saveErrorAt.current = now;
        flashRef.current(`⚠ Não foi possível guardar os textos não salvos: ${e}. Verifique o espaço livre e as permissões do disco.`);
      }
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => flushRef.current(), 10_000); // tenta de novo
    });
    return run;
  }, [doFlush]);
  const flushRef = useRef(flush);
  flushRef.current = flush;

  const scheduleSaveRef = useRef<(id?: string) => void>(() => {});
  scheduleSaveRef.current = (id?: string) => {
    if (id) pendingBackup.current.add(id);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flush, 800);
  };

  const restoreSession = useCallback(async () => {
    const data = await api.sessionLoad();
    const meta = parseSession(data.meta);
    const plan = planRestore(meta, data.backups);
    // Arquivos sem alterações são relidos do disco (pegam a versão mais nova)
    const toRead = plan.toRead;
    const fromDisk = new Map<string, OpenedDoc>();
    if (toRead.length) (await api.readPathsQuiet(toRead)).forEach((d, i) => { if (d) fromDisk.set(toRead[i], d); });

    const wantSplit = !!meta?.split && plan.tabs.some(({ tab }) => tab.pane === 1);
    if (wantSplit) { setSplit(true); ensureEditor(1); }
    if (typeof meta?.ratio === 'number') setRatio(meta.ratio);

    for (const { tab: t, backup } of plan.tabs) {
      let doc: OpenedDoc;
      if (backup !== undefined) doc = { path: t.path ?? '', name: t.name, content: backup, encoding: t.encoding, eol: t.eol, mtime: t.disk?.mtime, size: t.disk?.size };
      else if (t.path && fromDisk.has(t.path)) doc = fromDisk.get(t.path)!;
      else continue; // arquivo apagado/movido e sem alterações: nada a recuperar
      // Arquivo: mantém o estado salvo/não salvo. Texto sem arquivo com conteúdo: continua "não salvo".
      const dirty = backup !== undefined && (t.path ? t.dirty : true);
      const pane: Pane = wantSplit && t.pane === 1 ? 1 : 0;
      addTab(doc, { id: t.id, dirty, metaDirty: !!t.metaDirty && backup !== undefined, language: t.language, view: t.view, pane });
    }
    // Textos guardados que a lista de abas não menciona (lista estragada, ou o app foi fechado à força
    // no meio de uma gravação): voltam como abas não salvas, nunca são descartados
    plan.orphans.forEach(({ id, text }, i) => {
      const name = `Recuperado ${i + 1}`;
      addTab({ path: '', name, content: text, encoding: 'utf8', eol: text.includes('\r\n') ? 'CRLF' : 'LF' }, { id, dirty: true, metaDirty: false, language: 'plaintext', view: null, pane: 0 });
    });
    const notes = [data.problem, plan.orphans.length ? (plan.orphans.length === 1 ? '1 texto voltou como "Recuperado 1"' : `${plan.orphans.length} textos voltaram como "Recuperado 1…${plan.orphans.length}"`) : null].filter(Boolean);
    if (notes.length) restoreNote.current = `⚠ ${notes.join('; ').replace(/^./, (c) => c.toUpperCase())}. Nenhum texto foi apagado.`;
    // Se um dos lados ficou vazio (arquivos apagados), volta para uma vista só
    if (splitRef.current && !(tabsRef.current.some((t) => t.pane === 0) && tabsRef.current.some((t) => t.pane === 1))) unsplit();
    for (const t of tabsRef.current) {
      const n = /^Sem título (\d+)$/.exec(t.name);
      if (n) untitledCounter = Math.max(untitledCounter, Number(n[1]));
    }
    const acts = meta?.actives ?? [meta?.active ?? '', ''];
    for (const p of [0, 1] as Pane[]) {
      const a = acts[p];
      if (a && models.current.has(a) && tabsRef.current.find((t) => t.id === a)?.pane === p) activate(a, false);
    }
    const f: Pane = splitRef.current && meta?.focus === 1 ? 1 : 0;
    const fa = activesRef.current[f];
    if (fa) activate(fa);
  }, [addTab, activate, ensureEditor, setRatio, setSplit, unsplit]);

  // Restaura a sessão anterior + sinal de pronto
  const started = useRef(false);
  useEffect(() => {
    if (!eds[0] || started.current) return;
    started.current = true;
    (async () => {
      try {
        await restoreSession();
        restoreOk.current = true;
      } catch (e) {
        // Algo deu errado no meio: segue funcionando, mas sem apagar nenhum backup antigo nesta execução
        console.error('Falha ao restaurar a sessão', e);
        restoreNote.current = `⚠ Não foi possível restaurar toda a sessão anterior (${e}). Os textos guardados foram mantidos no disco.`;
      }
      if (tabsRef.current.length === 0) addTab();
      restored.current = true;
      const docs = await api.ready();
      docs.forEach((d) => openDocRef.current(d));
      checkExternalRef.current(); // arquivos alterados enquanto o app estava fechado
      if (restoreNote.current) flashRef.current(restoreNote.current);
    })();
  }, [eds[0]]); // eslint-disable-line react-hooks/exhaustive-deps

  // Qualquer mudança nas abas/vistas (abrir, fechar, salvar, dividir...) atualiza a sessão
  useEffect(() => { if (restored.current) scheduleSaveRef.current(); }, [tabs, actives, split, ratio, focus]);

  // Ao fechar a janela/encerrar: grava tudo e sai, sem perguntar
  // Se não der para gravar, não fecha: pergunta (os textos ainda estão na memória)
  useEffect(() => api.onSessionFlush(async () => {
    try {
      await flush();
    } catch (e) {
      api.quitBlocked(String(e));
      return;
    }
    api.quit();
  }), [flush]);

  const openDocRef = useRef<(d: OpenedDoc) => void>(() => {});
  const openDoc = useCallback((doc: OpenedDoc) => {
    const existing = tabsRef.current.find((t) => t.path === doc.path);
    if (existing) { activate(existing.id); return; }
    // Substitui uma aba em branco intacta
    const cur = tabsRef.current.find((t) => t.id === activesRef.current[focusRef.current]);
    const curModel = cur && models.current.get(cur.id);
    const replaceBlank = cur && !cur.path && !cur.dirty && curModel && curModel.getValueLength() === 0;
    addTab(doc);
    if (replaceBlank && cur) {
      models.current.get(cur.id)?.dispose();
      models.current.delete(cur.id);
      viewStates.current.delete(cur.id);
      savedVersions.current.delete(cur.id);
      commitTabs(tabsRef.current.filter((t) => t.id !== cur.id));
    }
  }, [activate, addTab]);

  openDocRef.current = openDoc;

  // ---------- Mensagens rápidas na barra de status ----------
  const [message, setMessage] = useState('');
  const msgTimer = useRef<number | undefined>(undefined);
  const flash = useCallback((text: string) => {
    setMessage(text);
    window.clearTimeout(msgTimer.current);
    msgTimer.current = window.setTimeout(() => setMessage(''), text.startsWith('⚠') ? 15000 : 6000);
  }, []);
  const flashRef = useRef(flash);
  flashRef.current = flash;

  // ---------- Reabrir aba fechada (⇧⌘T) ----------
  const closedStack = useRef<ClosedTab[]>([]);
  const pushClosed = useCallback((t: Tab) => {
    const m = models.current.get(t.id);
    if (!m || (!t.path && m.getValueLength() === 0)) return; // aba em branco: nada a guardar
    const unsaved = needsBackup(t);
    const ed = edRef.current[t.pane];
    const view = ed && ed.getModel() === m ? ed.saveViewState() : viewStates.current.get(t.id) ?? null;
    const st = closedStack.current;
    st.push({
      name: t.name, path: t.path, language: t.language, encoding: t.encoding, eol: t.eol,
      // Sem alterações, só o caminho basta, a não ser que o arquivo tenha sumido do disco
      content: t.path && !unsaved && externalRef.current[t.id] !== 'deleted' ? null : m.getValue(),
      wasDirty: !!t.path && unsaved, view, pane: t.pane, disk: diskStat.current.get(t.id) ?? null,
    });
    // Limites: quantidade e tamanho total (a mais recente sempre fica)
    const total = () => st.reduce((n, e) => n + (e.content?.length ?? 0), 0);
    while (st.length > MAX_CLOSED || (st.length > 1 && total() > MAX_CLOSED_CHARS)) st.shift();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reopenClosed = useCallback(async () => {
    const e = closedStack.current.pop();
    if (!e) { flash('Nenhuma aba fechada para reabrir'); return; }
    const open = e.path ? tabsRef.current.find((t) => t.path === e.path) : undefined;
    if (open) { activate(open.id); return; }
    let doc: OpenedDoc;
    if (e.content !== null) doc = { path: e.path ?? '', name: e.name, content: e.content, encoding: e.encoding, eol: e.eol, mtime: e.disk?.mtime, size: e.disk?.size };
    else {
      const [d] = await api.readPathsQuiet([e.path!]);
      if (!d) { flash(`"${e.name}" não existe mais no disco`); return; }
      doc = d;
    }
    const pane: Pane = splitRef.current && e.pane === 1 ? 1 : 0;
    // Uma aba em branco intacta (ex.: a criada ao fechar a última) dá lugar à reaberta
    const blank = tabsRef.current.find((t) => t.id === activesRef.current[pane] && !t.path && !t.dirty && (models.current.get(t.id)?.getValueLength() ?? 1) === 0);
    addTab(doc, { id: crypto.randomUUID(), dirty: e.wasDirty, metaDirty: false, language: e.language, view: e.view, pane });
    if (blank) {
      models.current.get(blank.id)?.dispose();
      models.current.delete(blank.id);
      viewStates.current.delete(blank.id);
      savedVersions.current.delete(blank.id);
      commitTabs(tabsRef.current.filter((t) => t.id !== blank.id));
    }
    flash(`"${e.name}" reaberta`);
  }, [activate, addTab, flash]);

  // ---------- Alterações feitas por outros programas ----------
  const [external, setExternal] = useState<Record<string, 'modified' | 'deleted'>>({});
  const externalRef = useRef(external);
  externalRef.current = external;
  const ackDeleted = useRef(new Set<string>()); // "manter no editor" depois de o arquivo ser apagado
  const setExt = useCallback((id: string, v: 'modified' | 'deleted' | null) => {
    setExternal((x) => {
      if ((x[id] ?? null) === v) return x;
      const n = { ...x };
      if (v) n[id] = v; else delete n[id];
      return n;
    });
  }, []);

  /** Substitui o texto da aba pela versão do disco (pode ser desfeito com ⌘Z) */
  const reloadFromDisk = useCallback(async (id: string, quiet = false) => {
    const t = tabsRef.current.find((x) => x.id === id);
    const m = models.current.get(id);
    if (!t?.path || !m) return;
    const [d] = await api.readPathsQuiet([t.path]);
    if (!d) { setExt(id, 'deleted'); return; }
    const norm = (x: string) => x.replace(/\r\n/g, '\n');
    if (norm(m.getValue()) !== norm(d.content)) {
      if (needsBackup(t)) await snapshotRef.current(id, 'recarregar'); // guarda o meu texto antes de trocar
      const ed = edRef.current[t.pane];
      const shown = !!ed && ed.getModel() === m;
      const vs = shown ? ed!.saveViewState() : null;
      m.pushStackElement();
      m.pushEditOperations([], [{ range: m.getFullModelRange(), text: d.content }], () => null);
      m.pushStackElement();
      if (shown && vs) ed!.restoreViewState(vs);
    }
    const eol = d.eol === 'CRLF' ? monaco.editor.EndOfLineSequence.CRLF : monaco.editor.EndOfLineSequence.LF;
    if ((m.getEOL() === '\r\n') !== (d.eol === 'CRLF')) m.pushEOL(eol);
    savedVersions.current.set(id, m.getAlternativeVersionId());
    diskStat.current.set(id, { mtime: d.mtime ?? 0, size: d.size ?? 0 });
    ackDeleted.current.delete(id);
    commitTabs(tabsRef.current.map((x) => (x.id === id ? { ...x, dirty: false, metaDirty: false, encoding: d.encoding, eol: d.eol } : x)));
    setExt(id, null);
    if (!quiet) flash(kt(`"${t.name}" recarregado do disco (⌘Z desfaz)`));
  }, [flash, setExt]);

  const checking = useRef(false);
  const checkExternal = useCallback(async (only?: string[]) => {
    if (checking.current || !restored.current) return;
    checking.current = true;
    try {
      const list = tabsRef.current.filter((t) => t.path && (!only || only.includes(t.id)));
      if (!list.length) return;
      const stats = await api.stat(list.map((t) => t.path!));
      for (let i = 0; i < list.length; i++) {
        const t = tabsRef.current.find((x) => x.id === list[i].id);
        const st = stats[i];
        if (!t || !models.current.has(t.id)) continue;
        if (!st) {
          if (!ackDeleted.current.has(t.id)) setExt(t.id, 'deleted');
          continue;
        }
        ackDeleted.current.delete(t.id);
        const known = diskStat.current.get(t.id);
        if (!known) { diskStat.current.set(t.id, st); setExt(t.id, null); continue; }
        if (st.mtime === known.mtime && st.size === known.size) { if (externalRef.current[t.id] === 'deleted') setExt(t.id, null); continue; }
        if (needsBackup(t)) setExt(t.id, 'modified'); // tem alterações minhas: pergunta
        else await reloadFromDisk(t.id, true).then(() => flash(`"${t.name}" foi alterado por outro programa e foi atualizado`));
      }
    } catch (e) {
      console.error('verificação de alterações externas', e);
    } finally {
      checking.current = false;
    }
  }, [flash, reloadFromDisk, setExt]); // eslint-disable-line react-hooks/exhaustive-deps
  checkExternalRef.current = checkExternal;

  useEffect(() => {
    const off = api.onWindowFocus(() => checkExternalRef.current());
    const vis = () => { if (document.visibilityState === 'visible') checkExternalRef.current(); };
    document.addEventListener('visibilitychange', vis);
    return () => { off(); document.removeEventListener('visibilitychange', vis); };
  }, []);

  /** Mantém a minha versão: não pergunta de novo até o arquivo mudar outra vez */
  const keepMine = useCallback(async (id: string) => {
    const t = tabsRef.current.find((x) => x.id === id);
    if (!t?.path) return;
    if (externalRef.current[id] === 'deleted') {
      ackDeleted.current.add(id);
      savedVersions.current.set(id, -1); // fica como "não salvo" (o backup da sessão guarda o texto)
      recomputeDirty(id);
      scheduleSaveRef.current(id);
    } else {
      const [st] = await api.stat([t.path]);
      if (st) diskStat.current.set(id, st);
    }
    setExt(id, null);
  }, [recomputeDirty, setExt]);

  // ---------- Comparação ----------
  const [diff, setDiffState] = useState<DiffState | null>(null);
  const [diffUsed, setDiffUsed] = useState(false); // o editor de comparação só é criado no primeiro uso
  const setDiff = useCallback((d: DiffState | null) => { if (d) setDiffUsed(true); setDiffState(d); }, []);
  const diffRef = useRef(diff);
  diffRef.current = diff;
  const [picker, setPicker] = useState<{ title: string; items: PickItem[]; onPick: (id: string) => void } | null>(null);
  const pickerRef = useRef(picker);
  pickerRef.current = picker;
  const closeDiff = useCallback(() => {
    setDiff(null);
    requestAnimationFrame(() => edRef.current[focusRef.current]?.focus());
  }, []);

  const compareTabs = useCallback((originalId: string, modifiedId: string) => {
    const a = tabsRef.current.find((t) => t.id === originalId);
    const b = tabsRef.current.find((t) => t.id === modifiedId);
    const ma = models.current.get(originalId);
    const mb = models.current.get(modifiedId);
    if (!a || !b || !ma || !mb) return;
    setDiff({ original: { model: ma, label: a.name }, modified: { model: mb, label: b.name }, temp: [], kind: 'tabs' });
  }, []);

  const compareWithText = useCallback((tabId: string, text: string, label: string, kind: DiffState['kind']) => {
    const t = tabsRef.current.find((x) => x.id === tabId);
    const m = models.current.get(tabId);
    if (!t || !m) return;
    const other = monaco.editor.createModel(text, m.getLanguageId());
    setDiff({ original: { model: other, label }, modified: { model: m, label: kind === 'external' ? `Sua versão — ${t.name}` : t.name }, temp: [other], kind, tabId });
  }, []);

  const openExternalDiff = useCallback(async (id: string) => {
    const t = tabsRef.current.find((x) => x.id === id);
    if (!t?.path) return;
    const [d] = await api.readPathsQuiet([t.path]);
    if (!d) { flash(`"${t.name}" não existe mais no disco`); return; }
    if (activesRef.current[t.pane] !== id) activate(id);
    compareWithText(id, d.content, 'No disco (alterado por outro programa)', 'external');
  }, [activate, compareWithText, flash]);
  const openExternalDiffRef = useRef(openExternalDiff);
  openExternalDiffRef.current = openExternalDiff;

  const startCompare = useCallback(() => {
    const a0 = activesRef.current[0];
    const a1 = activesRef.current[1];
    if (splitRef.current && a0 && a1) { compareTabs(a0, a1); return; }
    const cur = activesRef.current[focusRef.current];
    const others = tabsRef.current.filter((t) => t.id !== cur);
    setPicker({
      title: 'Comparar o texto atual com…',
      items: [
        ...others.map((t) => ({ id: t.id, label: t.name, hint: t.path ?? 'Não salvo' })),
        { id: '__clipboard__', label: 'Texto da área de transferência', hint: kt('O que você copiou por último (⌘C)') },
      ],
      onPick: (id) => pickCompareRef.current(id),
    });
  }, [compareTabs]);
  const pickCompareRef = useRef<(id: string) => void>(() => {});

  const pickCompare = useCallback(async (otherId: string) => {
    setPicker(null);
    const cur = activesRef.current[focusRef.current];
    if (!cur) return;
    if (otherId === '__clipboard__') {
      const text = await api.clipboardRead();
      if (!text) { flash('A área de transferência está vazia'); return; }
      compareWithText(cur, text, 'Área de transferência', 'tabs');
    } else compareTabs(otherId, cur);
  }, [compareTabs, compareWithText, flash]);
  pickCompareRef.current = pickCompare;

  // ---------- Histórico local de versões (snapshots em disco) ----------
  const snapInfo = useRef(new Map<string, { ver: number; at: number }>()); // última versão gravada por aba
  const snapshot = useCallback(async (id: string, reason: string, text?: string) => {
    const t = tabsRef.current.find((x) => x.id === id);
    const m = models.current.get(id);
    if (!t || !m) return;
    const content = text ?? m.getValue();
    if (!content) return;
    try {
      await api.historySave(historyKey(t), t.name, reason, content);
      if (text === undefined) snapInfo.current.set(id, { ver: m.getAlternativeVersionId(), at: Date.now() });
    } catch (e) {
      console.error('histórico', e);
    }
  }, []);
  snapshotRef.current = snapshot;

  // Cópia automática de quem mudou desde a última versão (a cada 5 min; nos testes, 10 s)
  useEffect(() => {
    let timer: number | undefined;
    api.debugEnabled().then((dbg) => {
      const every = dbg ? 10_000 : 5 * 60_000;
      timer = window.setInterval(() => {
        for (const t of tabsRef.current) {
          const m = models.current.get(t.id);
          if (!m || m.getValueLength() === 0) continue;
          const info = snapInfo.current.get(t.id);
          if (info && info.ver === m.getAlternativeVersionId()) continue;
          if (info && Date.now() - info.at < every) continue;
          snapshotRef.current(t.id, 'auto');
        }
      }, dbg ? 2_000 : 60_000);
    });
    return () => window.clearInterval(timer);
  }, []);

  const restoreVersion = useCallback(async (id: string, text: string, when: string) => {
    const t = tabsRef.current.find((x) => x.id === id);
    const m = models.current.get(id);
    if (!t || !m) return;
    await snapshot(id, 'restaurar'); // o texto atual também fica guardado
    const ed = edRef.current[t.pane];
    m.pushStackElement();
    m.pushEditOperations([], [{ range: m.getFullModelRange(), text }], () => null);
    m.pushStackElement();
    if (ed && ed.getModel() === m) ed.setPosition({ lineNumber: 1, column: 1 });
    flash(kt(`Versão de ${when} restaurada (⌘Z desfaz)`));
  }, [flash, snapshot]);

  const showHistory = useCallback(async (tabId?: string) => {
    const id = tabId || activesRef.current[focusRef.current];
    const t = tabsRef.current.find((x) => x.id === id);
    if (!t) return;
    const list: HistoryEntry[] = await api.historyList(historyKey(t)).catch(() => []);
    if (!list.length) { flash(`Ainda não há versões guardadas de "${t.name}"`); return; }
    setPicker({
      title: `Histórico de versões — ${t.name}`,
      items: list.map((e) => ({
        id: e.id,
        label: `${formatWhen(e.ts)} — ${REASONS[e.reason] ?? e.reason}`,
        hint: `${e.lines.toLocaleString('pt-BR')} ${e.lines === 1 ? 'linha' : 'linhas'} · ${formatSize(e.size)}`,
      })),
      onPick: async (snapId) => {
        setPicker(null);
        const e = list.find((x) => x.id === snapId);
        const m = models.current.get(id);
        if (!e || !m) return;
        const text = await api.historyRead(historyKey(t), snapId).catch(() => null);
        if (text === null) { flash('Não foi possível ler essa versão'); return; }
        if (activesRef.current[t.pane] !== id) activate(id);
        const when = formatWhen(e.ts);
        const other = monaco.editor.createModel(text, m.getLanguageId());
        setDiff({ original: { model: other, label: `Versão de ${when}` }, modified: { model: m, label: `Atual — ${t.name}` }, temp: [other], kind: 'history', tabId: id, when });
      },
    });
  }, [activate, flash, setDiff]);

  // ---------- Tratamento de linhas (seleção, ou o documento todo) ----------
  const [prompt, setPrompt] = useState<'prefix' | 'suffix' | null>(null);
  const [palette, setPalette] = useState(false);
  const runLineOp = useCallback((op: LineOp, arg = '') => {
    const ed = edRef.current[focusRef.current];
    const model = ed?.getModel();
    if (!ed || !model) return;
    const sel = ed.getSelection();
    let start = 1;
    let end = model.getLineCount();
    const scoped = !!sel && !sel.isEmpty();
    if (sel && scoped) {
      start = sel.startLineNumber;
      end = sel.endLineNumber;
      if (sel.endColumn === 1 && end > start) end--; // seleção terminando no início da linha seguinte
    }
    // No documento todo, a linha vazia final (arquivo terminando com quebra de linha) fica de fora
    if (!scoped && end > 1 && model.getLineLength(end) === 0) end--;
    const range = new monaco.Range(start, 1, end, model.getLineMaxColumn(end));
    const before = model.getValueInRange(range);
    const res = applyLineOp(op, before.split(/\r\n|\n/), arg);
    const text = res.lines.join(model.getEOL());
    if (text !== before) {
      ed.pushUndoStop();
      ed.executeEdits('penapad-linhas', [{ range, text, forceMoveMarkers: true }]); // uma única ação de desfazer
      ed.pushUndoStop();
      if (scoped && res.lines.length) {
        const last = start + res.lines.length - 1;
        ed.setSelection(new monaco.Selection(start, 1, last, model.getLineMaxColumn(last)));
      }
    }
    ed.focus();
    flash(`${res.message} ${scoped ? '(na seleção)' : '(no documento)'}`);
  }, [flash]);

  // ---------- Erros (JSON) na barra de status ----------
  const [problem, setProblem] = useState<Problem | null>(null);
  const problemRef = useRef(problem);
  problemRef.current = problem;
  const refreshProblem = useCallback(() => {
    const m = editor?.getModel();
    if (!m) { setProblem(null); return; }
    const errs = monaco.editor.getModelMarkers({ resource: m.uri })
      .filter((x) => x.severity === monaco.MarkerSeverity.Error)
      .sort((a, b) => a.startLineNumber - b.startLineNumber || a.startColumn - b.startColumn);
    if (!errs.length) { setProblem(null); return; }
    const e = errs[0];
    setProblem({ line: e.startLineNumber, col: e.startColumn, message: translateProblem(e.message), total: errs.length });
  }, [editor]);
  useEffect(() => {
    refreshProblem();
    const d1 = monaco.editor.onDidChangeMarkers(refreshProblem);
    const d2 = editor?.onDidChangeModel(refreshProblem);
    return () => { d1.dispose(); d2?.dispose(); };
  }, [editor, refreshProblem, activeId]);

  const saveTab = useCallback(async (id: string, as = false): Promise<boolean> => {
    const tab = tabsRef.current.find((t) => t.id === id);
    const model = models.current.get(id);
    if (!tab || !model) return false;
    try {
      // Outro programa alterou o arquivo desde que abrimos? Pergunta antes de sobrescrever.
      if (tab.path && !as) {
        const [st] = await api.stat([tab.path]);
        const known = diskStat.current.get(id);
        if (st && known && (st.mtime !== known.mtime || st.size !== known.size)) {
          const r = await api.confirmOverwrite(tab.name);
          if (r === 'cancel') return false;
          if (r === 'compare') { openExternalDiffRef.current(id); return false; }
          const [onDisk] = await api.readPathsQuiet([tab.path]);
          if (onDisk) await snapshotRef.current(id, 'sobrescrever', onDisk.content); // a versão do outro programa fica guardada
        }
      }
      const content = model.getValue();
      let res: { path: string; name: string; mtime: number; size: number } | null;
      if (tab.path && !as) res = await api.save({ path: tab.path, content, encoding: tab.encoding });
      else {
        let suggested = tab.name;
        if (!/\.[^.]+$/.test(suggested)) {
          const ext = monaco.languages.getLanguages().find((l) => l.id === tab.language)?.extensions?.[0] ?? '.txt';
          suggested += ext;
        }
        res = await api.saveAs({ content, encoding: tab.encoding, suggestedName: suggested });
      }
      if (!res) return false;
      savedVersions.current.set(id, model.getAlternativeVersionId());
      diskStat.current.set(id, { mtime: res.mtime, size: res.size });
      ackDeleted.current.delete(id);
      setExt(id, null);
      const patch: Partial<Tab> = { path: res.path, name: res.name, dirty: false, metaDirty: false };
      if (!tab.path && tab.language === 'plaintext') {
        const lang = detectLanguage(res.name);
        if (lang !== 'plaintext') { monaco.editor.setModelLanguage(model, lang); patch.language = lang; }
      }
      tabsRef.current = tabsRef.current.map((t) => (t.id === id ? { ...t, ...patch } : t));
      setTabs(tabsRef.current);
      if (!tab.path) await api.historyRename(historyKey(tab), `f:${res.path}`).catch(() => {}); // sem título → arquivo
      else if (tab.path !== res.path) await api.historyRename(historyKey(tab), `f:${res.path}`).catch(() => {});
      snapshotRef.current(id, 'salvo');
      return true;
    } catch (e) {
      alert(`Não foi possível salvar o arquivo.\n\n${(e as Error).message}`);
      return false;
    }
  }, [setExt]);

  const closeTab = useCallback(async (id: string, discard = false): Promise<boolean> => {
    const tab = tabsRef.current.find((t) => t.id === id);
    if (!tab) return true;
    if ((tab.dirty || tab.metaDirty) && !discard) {
      if (id !== activesRef.current[tab.pane]) activate(id);
      const r = await api.confirmClose(tab.name);
      if (r === 'cancel') return false;
      if (r === 'save' && !(await saveTab(id))) return false;
    }
    const closing = tabsRef.current.find((t) => t.id === id) ?? tab;
    if (needsBackup(closing)) await snapshotRef.current(id, 'fechado'); // texto não salvo também vai para o histórico
    pushClosed(closing);
    diskStat.current.delete(id);
    ackDeleted.current.delete(id);
    setExt(id, null);
    const p = tab.pane;
    const paneTabs = tabsRef.current.filter((t) => t.pane === p);
    const idx = paneTabs.findIndex((t) => t.id === id);
    const ed = edRef.current[p];
    if (ed && ed.getModel() === models.current.get(id)) ed.setModel(null);
    const wasActive = activesRef.current[p] === id;
    if (wasActive) setActive(p, '');
    commitTabs(tabsRef.current.filter((t) => t.id !== id));
    const rest = paneTabs.filter((t) => t.id !== id);
    if (rest.length) { if (wasActive) activate(rest[Math.min(idx, rest.length - 1)].id); }
    else if (splitRef.current) unsplit(); // um lado ficou vazio: volta para uma vista só
    else addTab(undefined, undefined, 0);
    models.current.get(id)?.dispose();
    models.current.delete(id);
    viewStates.current.delete(id);
    savedVersions.current.delete(id);
    return true;
  }, [activate, addTab, saveTab, setActive, unsplit, pushClosed, setExt]);

  // ---------- Comandos ----------
  const exec = useCallback(async (cmd: string, arg?: string) => {
    const ed = edRef.current[focusRef.current];
    const id = activesRef.current[focusRef.current];
    const model = models.current.get(id);
    const run = (action: string) => { if (!ed) return; ed.focus(); ed.trigger('penapad', action, null); };

    switch (cmd) {
      case 'new': addTab(); break;
      case 'open': {
        const docs = await api.openFiles();
        docs.forEach(openDoc);
        break;
      }
      case 'save': await saveTab(id); break;
      case 'saveAs': await saveTab(id, true); break;
      case 'close':
        if (diffRef.current) { closeDiff(); break; } // com a comparação aberta, ⌘W fecha a comparação
        await closeTab(id);
        break;
      case 'closeTab': if (arg) await closeTab(arg); break;
      case 'closeDiscard': await closeTab(id, true); break; // = fechar e responder "Não Salvar" (testes)
      case 'split': toggleSplit(); break;
      case 'moveOther': moveOther(arg || id); break;
      case 'rotateSplit': setSettings((s) => ({ ...s, splitDir: s.splitDir === 'row' ? 'col' : 'row' })); break;
      case 'undo': case 'redo':
        if (inputFocused()) document.execCommand(cmd);
        else run(cmd);
        break;
      case 'cut': case 'copy': {
        if (!ed || !model) break;
        ed.focus();
        const sels = (ed.getSelections() ?? []).filter((x) => !x.isEmpty());
        if (!sels.length) break;
        await api.clipboardWrite(sels.map((x) => model.getValueInRange(x)).join(model.getEOL()));
        if (cmd === 'cut') { ed.pushUndoStop(); ed.executeEdits('cut', sels.map((range) => ({ range, text: '' }))); ed.pushUndoStop(); }
        break;
      }
      case 'paste': {
        if (!ed) break;
        const text = await api.clipboardRead();
        ed.focus();
        if (text) ed.trigger('penapad', 'paste', { text });
        break;
      }
      case 'selectAll': if (inputFocused()) (document.activeElement as HTMLInputElement).select(); else if (ed && model) { ed.focus(); ed.setSelection(model.getFullModelRange()); } break;
      case 'comment': run('editor.action.commentLine'); break;
      case 'format': {
        if (!ed) break;
        ed.focus();
        const a = ed.getAction('editor.action.formatDocument');
        if (a?.isSupported()) await a.run();
        else if (model?.getLanguageId() === 'plaintext') await execRef.current('formatJson');
        else flash('Formatar Documento está disponível para JSON');
        break;
      }
      case 'formatJson': {
        if (!ed || !model) break;
        if (model.getLanguageId() !== 'json') {
          const first = model.getValue().trimStart()[0];
          if (first !== '{' && first !== '[') { flash('O texto não parece JSON (deve começar com { ou [)'); break; }
          monaco.editor.setModelLanguage(model, 'json');
          patchTab(id, { language: 'json' });
        }
        ed.focus();
        const ok = await runFormat(ed);
        if (!ok) flash('Não foi possível formatar o JSON');
        else window.setTimeout(() => flash(problemRef.current ? 'JSON formatado (tem erro)' : 'JSON formatado e válido'), 600);
        break;
      }
      case 'gotoError': {
        const pr = problemRef.current;
        if (!ed || !pr) break;
        ed.setPosition({ lineNumber: pr.line, column: pr.col });
        ed.revealPositionInCenter({ lineNumber: pr.line, column: pr.col });
        ed.focus();
        break;
      }
      case 'reopenClosed': await reopenClosed(); break;
      case 'history': await showHistory(arg); break;
      // Usados pelos testes automáticos (e equivalentes aos botões do aviso de alteração externa)
      case 'openPath': if (arg) (await api.openPaths([arg])).forEach(openDoc); break;
      case 'checkExternal': await checkExternal(); break;
      case 'extKeep': await keepMine(id); break;
      case 'extReload': await reloadFromDisk(id); break;
      case 'extCompare': await openExternalDiff(id); break;
      case 'closeDiff': closeDiff(); break;
      case 'historyRestore': case 'historyNewTab': {
        const d = diffRef.current;
        if (!d || d.kind !== 'history' || !d.tabId) break;
        const t = tabsRef.current.find((x) => x.id === d.tabId);
        const text = d.original.model.getValue();
        closeDiff();
        if (!t) break;
        if (cmd === 'historyRestore') await restoreVersion(t.id, text, d.when ?? '');
        else addTab({ path: '', name: `${t.name} (versão de ${d.when})`, content: text, encoding: t.encoding, eol: t.eol }, undefined, t.pane);
        break;
      }
      case 'debugType': if (ed && arg) { ed.focus(); ed.trigger('keyboard', 'type', { text: arg.replace(/\\n/g, '\n') }); } break;
      case 'debugPick': { const p = pickerRef.current; if (p) p.onPick(p.items[Number(arg ?? 0)]?.id ?? ''); break; }
      case 'compare': startCompare(); break;
      case 'columnSelection': {
        const on = !columnSelRef.current;
        setColumnSel(on);
        flash(on ? 'Seleção em coluna ligada: arraste para selecionar um bloco (desligue no mesmo botão)' : kt('Seleção em coluna desligada (⌥ + arrastar continua funcionando)'));
        ed?.focus();
        break;
      }
      case 'dedupe': case 'removeEmpty': case 'trimBoth': case 'trim':
        runLineOp(cmd);
        break;
      case 'prefix': case 'suffix': setPrompt(cmd); break;
      case 'duplicate': run('editor.action.copyLinesDownAction'); break;
      case 'moveUp': run('editor.action.moveLinesUpAction'); break;
      case 'moveDown': run('editor.action.moveLinesDownAction'); break;
      case 'deleteLine': run('editor.action.deleteLines'); break;
      case 'sortAsc': case 'sortDesc': runLineOp(cmd); break;
      case 'upper': run('editor.action.transformToUppercase'); break;
      case 'lower': run('editor.action.transformToLowercase'); break;
      case 'gotoLine': run('editor.action.gotoLine'); break;
      case 'foldAll': run('editor.foldAll'); break;
      case 'unfoldAll': run('editor.unfoldAll'); break;
      case 'selectOccurrences': run('editor.action.selectHighlights'); break;
      case 'addNextOccurrence': run('editor.action.addSelectionToNextFindMatch'); break;
      case 'wordWrap': setSettings((s) => ({ ...s, wordWrap: !s.wordWrap })); break;
      case 'minimap': setSettings((s) => ({ ...s, minimap: !s.minimap })); break;
      case 'lineNumbers': setSettings((s) => ({ ...s, lineNumbers: !s.lineNumbers })); break;
      case 'whitespace': setSettings((s) => ({ ...s, whitespace: !s.whitespace })); break;
      case 'zoomIn': setSettings((s) => ({ ...s, zoom: clampZoom(s.zoom + 10) })); break;
      case 'zoomOut': setSettings((s) => ({ ...s, zoom: clampZoom(s.zoom - 10) })); break;
      case 'zoomReset': setSettings((s) => ({ ...s, zoom: 100 })); break;
      case 'theme': if (arg === 'light' || arg === 'dark' || arg === 'system') setSettings((s) => ({ ...s, theme: arg })); break;
      case 'language':
        if (model && arg) { monaco.editor.setModelLanguage(model, arg); patchTab(id, { language: arg }); ed?.focus(); }
        break;
      case 'detectLanguage': {
        const t = tabsRef.current.find((x) => x.id === id);
        if (model && t) { const l = detectLanguage(t.name); monaco.editor.setModelLanguage(model, l); patchTab(id, { language: l }); }
        break;
      }
      case 'find': setFind((f) => ({ open: true, replace: f.open ? f.replace : false, token: f.token + 1 })); break;
      case 'replace': setFind((f) => ({ open: true, replace: true, token: f.token + 1 })); break;
      case 'findNext': if (findCtl.current) findCtl.current.next(); else setFind((f) => ({ ...f, open: true, token: f.token + 1 })); break;
      case 'findPrev': if (findCtl.current) findCtl.current.prev(); else setFind((f) => ({ ...f, open: true, token: f.token + 1 })); break;
      case 'closeFind': setFind((f) => ({ ...f, open: false })); ed?.focus(); break;
      case 'palette': setPalette(true); break;
      case 'fullscreen': api.toggleFullscreen(); break;
      case 'about': api.about(); break;
      case 'quit': api.requestQuit(); break;
    }
  }, [addTab, openDoc, saveTab, closeTab, patchTab, toggleSplit, moveOther, flash, reopenClosed, startCompare, runLineOp, closeDiff, showHistory, checkExternal, keepMine, reloadFromDisk, openExternalDiff, restoreVersion]);

  const lastKeyCmd = useRef<{ cmd: string; t: number } | null>(null);
  const lastKeyRef = useRef(''); // última tecla (só para os testes)
  const execRef = useRef(exec);
  execRef.current = exec;

  // Menu nativo + arquivos abertos pelo Finder
  useEffect(() => {
    const off1 = api.onMenu((cmd, arg) => {
      // O atalho pode chegar tanto pelo teclado (capturado abaixo) quanto pelo menu: evita executar duas vezes
      const last = lastKeyCmd.current;
      if (last && last.cmd === cmd && performance.now() - last.t < 400) return;
      execRef.current(cmd, arg);
    });
    const off2 = api.onFileOpened((doc) => openDoc(doc));
    return () => { off1(); off2(); };
  }, [openDoc]);

  // Atalhos de teclado (fase de captura, antes do Monaco)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      lastKeyRef.current = `${e.ctrlKey ? 'C' : ''}${e.shiftKey ? 'S' : ''}${e.altKey ? 'A' : ''}${e.metaKey ? 'M' : ''} key=${e.key} code=${e.code}`;
      const letter = e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
      let cmd: string | null = null;
      // Tecla de comando: ⌘ no Mac, Ctrl no Windows/Linux (sem Alt, para não pegar o AltGr dos teclados brasileiros)
      const mod = IS_MAC ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey && !e.altKey;
      if (!IS_MAC && mod && letter === 'h' && !e.shiftKey) cmd = 'replace';
      else if (!IS_MAC && mod && letter === 'g' && !e.shiftKey) cmd = 'gotoLine';
      else if (!IS_MAC && e.key === 'F3' && !e.ctrlKey && !e.altKey && !e.metaKey) cmd = e.shiftKey ? 'findPrev' : 'findNext';
      else if (!IS_MAC && mod && letter === 'q' && !e.shiftKey) cmd = 'quit';
      else if (!IS_MAC && e.key === 'F11' && !e.ctrlKey && !e.altKey && !e.shiftKey) cmd = 'fullscreen';
      else if (mod) {
        if (letter === 'n' && !e.shiftKey && !e.altKey) cmd = 'new';
        else if (letter === 'o' && !e.shiftKey && !e.altKey) cmd = 'open';
        else if (letter === 's' && !e.altKey) cmd = e.shiftKey ? 'saveAs' : 'save';
        else if (letter === 'w' && !e.shiftKey && !e.altKey) cmd = 'close';
        else if (letter === 'f') cmd = e.altKey ? 'replace' : 'find';
        else if (letter === 'g' && !e.altKey && IS_MAC) cmd = e.shiftKey ? 'findPrev' : 'findNext';
        else if (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') cmd = 'zoomIn';
        else if (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract') cmd = 'zoomOut';
        else if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') cmd = 'zoomReset';
        else if (e.key === '/' || e.code === 'Slash' || e.code === 'NumpadDivide' || e.code === 'IntlRo') cmd = 'comment';
        else if (e.code === 'Backslash' && !e.shiftKey && !e.altKey) cmd = 'split';
        else if (letter === 't' && e.shiftKey && !e.altKey) cmd = 'reopenClosed';
        else if (letter === 'h' && e.shiftKey && !e.altKey) cmd = 'history';
        else if (letter === 'p' && e.shiftKey && !e.altKey) cmd = 'palette';
        else if (letter === 'd' && !e.shiftKey && !e.altKey && editorFocused()) cmd = 'addNextOccurrence';
        else if (letter === 'l' && e.shiftKey && !e.altKey && editorFocused()) cmd = 'selectOccurrences';
        else if (letter === 'k' && e.shiftKey && !e.altKey && editorFocused()) cmd = 'deleteLine';
      } else if (IS_MAC && e.ctrlKey && !e.metaKey && letter === 'g') cmd = 'gotoLine';
      else if (e.altKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyZ') cmd = 'wordWrap';
      else if (e.altKey && e.shiftKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyF') cmd = 'format';
      else if (e.altKey && !e.metaKey && !e.ctrlKey && editorFocused() && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        cmd = e.shiftKey ? (e.key === 'ArrowDown' ? 'duplicate' : null) : e.key === 'ArrowUp' ? 'moveUp' : 'moveDown';
      }
      else if (e.key === 'Escape' && findOpenRef.current && !document.querySelector('[data-modal]') && !(e.target as HTMLElement)?.closest?.('.monaco-editor .suggest-widget')) cmd = 'closeFind';

      if (!cmd && !IS_MAC && (e.key === 'F5' || (mod && (letter === 'r' || (!e.shiftKey && (letter === 'p' || letter === 'j' || letter === 'u')))))) {
        // Atalhos do navegador embutido (recarregar, imprimir, downloads…): não fazem sentido num editor
        e.preventDefault();
        return;
      }
      if (cmd) {
        e.preventDefault();
        e.stopPropagation();
        lastKeyCmd.current = { cmd, t: performance.now() };
        execRef.current(cmd);
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, []);
  const findOpenRef = useRef(find.open);
  findOpenRef.current = find.open;

  // Arrastar e soltar arquivos
  useEffect(() => api.onDropFiles(async (paths) => (await api.openPaths(paths)).forEach(openDoc)), [openDoc]);

  // Título da janela e contagem de alterações
  useEffect(() => {
    if (!active) return;
    const mark = !IS_MAC && (active.dirty || active.metaDirty) ? '*' : '';
    api.setTitle(`${mark}${active.name} — PenaPad`);
  }, [active?.name, active?.path, active?.dirty, active?.metaDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clique direito: menu nativo do macOS (no editor) e nada do WebKit no resto da janela
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea:not(.inputarea)') && !target.closest('.monaco-editor')) return; // campos de texto: menu padrão
      e.preventDefault();
      // Clique direito numa aba: mover para o outro lado / fechar
      const tabEl = target?.closest<HTMLElement>('[data-tab-id]');
      if (tabEl?.dataset.tabId) {
        const t = tabsRef.current.find((x) => x.id === tabEl.dataset.tabId);
        if (!t) return;
        const row = settingsRef.current.splitDir === 'row';
        const label = t.pane === 0 ? (row ? 'Mover para a Direita →' : 'Mover para Baixo ↓') : (row ? '← Mover para a Esquerda' : '↑ Mover para Cima');
        api.tabMenu(t.id, splitRef.current || t.pane === 1 ? label : row ? 'Abrir ao Lado (Dividir Tela) →' : 'Abrir Embaixo (Dividir Tela) ↓');
        return;
      }
      const p: Pane | -1 = host0.current?.contains(target) ? 0 : host1.current?.contains(target) ? 1 : -1;
      const ed = p >= 0 ? edRef.current[p as Pane] : null;
      const model = ed?.getModel();
      if (!ed || !model) return;
      setFocus(p as Pane);
      ed.focus();
      api.contextMenu({
        hasSelection: (ed.getSelections() ?? []).some((x) => !x.isEmpty()),
        canUndo: model.canUndo(),
        canRedo: model.canRedo(),
      });
    };
    window.addEventListener('contextmenu', h);
    return () => window.removeEventListener('contextmenu', h);
  }, [setFocus]);

  // Diagnóstico para testes automáticos (PENAPAD_DEBUG): grava o estado num arquivo a cada 0,5 s
  const debugState = useRef<() => unknown>(() => null);
  debugState.current = () => ({
    tabs: tabsRef.current.map((t) => {
      const m = models.current.get(t.id);
      // Só o começo do texto: copiar o documento inteiro a cada 0,3 s distorceria a medição de memória
      const head = m ? m.getValueInRange(new monaco.Range(1, 1, Math.min(m.getLineCount(), 8), 1 + Math.min(300, m.getLineMaxColumn(Math.min(m.getLineCount(), 8))))) : null;
      return { id: t.id, name: t.name, path: t.path, pane: t.pane, dirty: t.dirty, language: t.language, eol: t.eol, text: head?.slice(0, 300) ?? null, lines: m?.getLineCount() };
    }),
    actives: activesRef.current,
    focus: focusRef.current,
    split: splitRef.current,
    ratio: ratioRef.current,
    editors: monaco.editor.getEditors().length,
    diffEditors: monaco.editor.getDiffEditors().length,
    models: monaco.editor.getModels().length,
    domNodes: document.getElementsByTagName('*').length,
    message,
    problem,
    external,
    closed: closedStack.current.map((c) => c.name),
    diff: diff ? { kind: diff.kind, original: diff.original.label, modified: diff.modified.label } : null,
    picker: picker ? { title: picker.title, items: picker.items.map((i) => i.label) } : null,
    prompt,
    columnSel,
    palette,
    lastKey: lastKeyRef.current,
    focusEl: (document.activeElement as HTMLElement | null)?.getAttribute('placeholder') ?? document.activeElement?.tagName ?? null,
    modal: (document.querySelector('[data-modal]') as HTMLElement | null)?.innerText.slice(0, 1500) ?? null,
    selection: editor?.getSelections()?.map((x) => x.toString()) ?? [],
  });
  useEffect(() => {
    let timer: number | undefined;
    api.debugEnabled().then((on) => {
      if (on) timer = window.setInterval(async () => {
        // Comandos de teste vindos de um arquivo (sem precisar clicar na tela)
        const cmd = await api.debugTakeCmd();
        if (cmd) {
          const [c, ...rest] = cmd.trim().split(' ');
          await execRef.current(c, rest.join(' ') || undefined);
        }
        api.debugWrite(JSON.stringify(debugState.current()));
      }, 300);
    });
    return () => window.clearInterval(timer);
  }, []);

  // Arrastar a divisória entre as vistas
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const box = paneBox.current?.getBoundingClientRect();
    if (!box) return;
    const row = settingsRef.current.splitDir === 'row';
    const move = (ev: MouseEvent) => setRatio(row ? (ev.clientX - box.left) / box.width : (ev.clientY - box.top) / box.height);
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); document.body.style.cursor = ''; };
    document.body.style.cursor = row ? 'col-resize' : 'row-resize';
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const ribbonState: RibbonState = useMemo(() => ({ ...settings, split, columnSelection: columnSel, language: active?.language ?? 'plaintext' }), [settings, split, columnSel, active?.language]);

  const tabViews0 = useMemo(() => tabs.filter((t) => t.pane === 0).map((t) => ({ id: t.id, name: t.name, path: t.path, dirty: t.dirty || t.metaDirty })), [tabs]);
  const tabViews1 = useMemo(() => tabs.filter((t) => t.pane === 1).map((t) => ({ id: t.id, name: t.name, path: t.path, dirty: t.dirty || t.metaDirty })), [tabs]);
  const newTab0 = useCallback(() => { addTab(undefined, undefined, 0); }, [addTab]);
  const newTab1 = useCallback(() => { addTab(undefined, undefined, 1); }, [addTab]);

  // Itens da paleta de comandos: funções do menu, linguagens e abas abertas
  const paletteItems = useMemo((): PaletteItem[] => {
    if (!palette) return [];
    const on: Record<string, boolean> = {
      wordWrap: settings.wordWrap, minimap: settings.minimap, lineNumbers: settings.lineNumbers,
      whitespace: settings.whitespace, split, columnSelection: columnSel,
    };
    const items: PaletteItem[] = COMMANDS.map((c) => ({
      key: c.arg ? `${c.cmd}:${c.arg}` : c.cmd,
      label: c.label,
      group: c.group,
      keys: c.keys,
      alt: c.alt,
      on: c.cmd === 'theme' ? settings.theme === c.arg : on[c.cmd],
    }));
    items.push({ key: 'palette', label: 'Paleta de Comandos', group: 'Visualizar', keys: '⇧⌘P' });
    if (!IS_MAC) {
      // No Mac ficam no menu do app
      items.push({ key: 'fullscreen', label: 'Tela Cheia', group: 'Visualizar', keys: 'F11' });
      items.push({ key: 'about', label: 'Sobre o PenaPad', group: 'Ajuda', alt: 'versão licença' });
      items.push({ key: 'quit', label: 'Sair do PenaPad', group: 'Arquivo', keys: '⌘Q', alt: 'fechar encerrar' });
    }
    for (const t of tabs) items.push({ key: `tab:${t.id}`, label: t.name + (t.dirty ? ' •' : ''), group: 'Ir para Aba', alt: t.path ?? '' });
    for (const l of allLanguages()) items.push({ key: `language:${l.id}`, label: l.name, group: 'Linguagem', alt: l.id, on: active?.language === l.id });
    return items;
  }, [palette, settings, split, columnSel, tabs, active?.language]);

  const runPalette = useCallback((it: PaletteItem) => {
    setPalette(false);
    const [cmd, ...rest] = it.key.split(':');
    const arg = rest.join(':') || undefined;
    // Primeiro devolve o foco ao editor; depois executa (a função pode abrir outra janela)
    requestAnimationFrame(() => {
      edRef.current[focusRef.current]?.focus();
      if (cmd === 'tab' && arg) activate(arg);
      else if (cmd !== 'palette') execRef.current(cmd, arg);
    });
  }, [activate]);

  const setEol = (eol: Eol) => {
    const m = models.current.get(activeId);
    if (!m || !active || active.eol === eol) return;
    m.pushEOL(eol === 'CRLF' ? monaco.editor.EndOfLineSequence.CRLF : monaco.editor.EndOfLineSequence.LF);
    patchTab(activeId, { eol });
    updateStatus();
  };
  const setEncoding = (encoding: Encoding) => {
    if (!active || active.encoding === encoding) return;
    patchTab(activeId, { encoding, metaDirty: true });
  };

  return (
    <div className="flex h-full flex-col">
      {IS_MAC && <TitleBar title={active?.name ?? 'PenaPad'} dirty={!!(active?.dirty || active?.metaDirty)} />}
      <RibbonM exec={exec} state={ribbonState} />
      <div className="relative flex min-h-0 flex-1 flex-col">
      {diffUsed && (
        <DiffView
          content={diff}
          fontSize={Math.round((BASE_FONT * settings.zoom) / 100 * 2) / 2}
          onClose={closeDiff}
          actions={diff && diff.kind === 'history' && diff.tabId ? (
            <>
              <button className="flex h-[26px] items-center rounded-md px-2 text-[12px] hover:bg-[var(--hover)]" title="Abre esta versão numa aba nova, sem mexer no texto atual" onClick={() => exec('historyNewTab')}>Abrir em Nova Aba</button>
              <button className="flex h-[26px] items-center rounded-md bg-[var(--accent)] px-2 text-[12px] text-white hover:brightness-110" title={kt("Troca o texto atual por esta versão (o atual também fica no histórico; ⌘Z desfaz)")} onClick={() => exec('historyRestore')}>Restaurar Esta Versão</button>
            </>
          ) : diff && diff.kind === 'external' && diff.tabId ? (
            <>
              <button className="flex h-[26px] items-center rounded-md px-2 text-[12px] hover:bg-[var(--hover)]" title={kt("Troca o seu texto pela versão do disco (⌘Z desfaz)")} onClick={() => { const id = diff.tabId!; closeDiff(); reloadFromDisk(id); }}>Usar Versão do Disco</button>
              <button className="flex h-[26px] items-center rounded-md bg-[var(--accent)] px-2 text-[12px] text-white hover:brightness-110" title="Mantém o seu texto; ao salvar, ele substitui o do disco" onClick={() => { const id = diff.tabId!; closeDiff(); keepMine(id); }}>Manter Minha Versão</button>
            </>
          ) : undefined}
        />
      )}
      <div ref={paneBox} className={`flex min-h-0 flex-1 ${settings.splitDir === 'row' ? 'flex-row' : 'flex-col'}`}>
        {([0, 1] as Pane[]).map((p) => (
          <Fragment key={p}>
            {p === 1 && split && (
              <div
                onMouseDown={startResize}
                onDoubleClick={() => setRatio(0.5)}
                title="Arraste para redimensionar (duplo clique: metade)"
                className={`shrink-0 bg-[var(--border)] hover:bg-[var(--accent)] ${settings.splitDir === 'row' ? 'w-[3px] cursor-col-resize' : 'h-[3px] cursor-row-resize'}`}
              />
            )}
            <div
              className="flex min-h-0 min-w-0 flex-col"
              style={p === 0 ? (split ? { flex: `0 0 calc(${ratio * 100}% - 1.5px)` } : { flex: '1 1 0' }) : split ? { flex: '1 1 0' } : { display: 'none' }}
              onMouseDown={() => { if (focusRef.current !== p && split) setFocus(p); }}
            >
              <TabBarM
                tabs={p === 0 ? tabViews0 : tabViews1}
                activeId={actives[p]}
                focused={!split || focus === p}
                onSelect={activate}
                onClose={closeTab}
                onNew={p === 0 ? newTab0 : newTab1}
              />
              {actives[p] && external[actives[p]] && (
                <ExternalBanner
                  kind={external[actives[p]]}
                  name={tabs.find((t) => t.id === actives[p])?.name ?? ''}
                  onCompare={() => openExternalDiff(actives[p])}
                  onReload={() => reloadFromDisk(actives[p])}
                  onKeep={() => keepMine(actives[p])}
                  onClose={() => closeTab(actives[p])}
                />
              )}
              <div className="relative min-h-0 flex-1 bg-[var(--surface)]">
                <div ref={p === 0 ? host0 : host1} className="absolute inset-0" />
                {find.open && focus === p && editor && (
                  <FindPanel
                    key={p}
                    editor={editor}
                    showReplace={find.replace}
                    focusToken={find.token}
                    onToggleReplace={() => setFind((f) => ({ ...f, replace: !f.replace }))}
                    onClose={() => exec('closeFind')}
                    controller={findCtl}
                  />
                )}
              </div>
            </div>
          </Fragment>
        ))}
      </div>
      </div>
      {prompt && (
        <PromptDialog
          title={prompt === 'prefix' ? 'Adicionar prefixo no início de cada linha' : 'Adicionar sufixo no fim de cada linha'}
          hint={`Será aplicado ${(editor?.getSelection()?.isEmpty() ?? true) ? 'em todas as linhas do documento' : 'nas linhas selecionadas'}. ${kt('⌘Z')} desfaz.`}
          onCancel={() => { setPrompt(null); editor?.focus(); }}
          onOk={(v) => { const op = prompt; setPrompt(null); runLineOp(op, v); }}
        />
      )}
      {palette && (
        <CommandPalette items={paletteItems} onRun={runPalette} onCancel={() => { setPalette(false); editor?.focus(); }} />
      )}
      {picker && (
        <PickDialog title={picker.title} items={picker.items} onPick={picker.onPick} onCancel={() => { setPicker(null); editor?.focus(); }} />
      )}
      <StatusBar
        message={message}
        problem={problem}
        onProblem={() => exec('gotoError')}
        info={status}
        eol={active?.eol ?? 'LF'}
        encoding={active?.encoding ?? 'utf8'}
        language={active?.language ?? 'plaintext'}
        zoom={settings.zoom}
        onEol={setEol}
        onEncoding={setEncoding}
        onZoom={(z) => setSettings((s) => ({ ...s, zoom: clampZoom(z) }))}
      />
    </div>
  );
}

/** Aviso no topo da vista quando outro programa altera ou apaga o arquivo */
function ExternalBanner({ kind, name, onCompare, onReload, onKeep, onClose }: {
  kind: 'modified' | 'deleted';
  name: string;
  onCompare: () => void;
  onReload: () => void;
  onKeep: () => void;
  onClose: () => void;
}) {
  const btn = 'h-[24px] rounded-md px-2 text-[12px] hover:bg-[var(--hover)] whitespace-nowrap';
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-1.5 text-[12px] text-[var(--warn-text)]">
      <span className="min-w-0 flex-1">
        {kind === 'modified'
          ? <>⚠ <b>{name}</b> foi alterado por outro programa, e você tem alterações não salvas aqui.</>
          : <>⚠ <b>{name}</b> foi apagado ou movido no disco. O texto continua aqui.</>}
      </span>
      {kind === 'modified' ? (
        <>
          <button className={`${btn} font-semibold`} onClick={onCompare}>Comparar</button>
          <button className={btn} title={kt("Troca o seu texto pela versão do disco (⌘Z desfaz)")} onClick={onReload}>Recarregar do Disco</button>
          <button className={btn} title="Mantém o seu texto; ao salvar, ele substitui o do disco" onClick={onKeep}>Manter Minha Versão</button>
        </>
      ) : (
        <>
          <button className={`${btn} font-semibold`} title={kt("Mantém a aba aberta como não salva; ⌘S grava de novo")} onClick={onKeep}>Manter no Editor</button>
          <button className={btn} onClick={onClose}>Fechar Aba</button>
        </>
      )}
    </div>
  );
}
