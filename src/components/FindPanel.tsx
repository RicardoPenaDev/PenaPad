import { useCallback, useEffect, useRef, useState } from 'react';
import { CaseSensitive, ChevronDown, ChevronRight, ChevronUp, Regex, Replace, ReplaceAll, WholeWord, X } from 'lucide-react';
import { monaco } from '../monaco';
import ReplacePreview, { type PreviewSpan, type Seg } from './ReplacePreview';

type Editor = monaco.editor.IStandaloneCodeEditor;

export interface FindController {
  next: () => void;
  prev: () => void;
}

const MAX_MATCHES = 20000;
const MAX_HITS_SHOWN_PER_SPAN = 50;
const WORD_SEPARATORS = '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?';

function expandReplacement(rep: string, caps: string[] | null, isRegex: boolean) {
  if (!isRegex) return rep;
  return rep.replace(/\$(\d{1,2}|&)|\\(n|t|\\)/g, (_m, g: string | undefined, esc: string | undefined) => {
    if (esc) return esc === 'n' ? '\n' : esc === 't' ? '\t' : '\\';
    if (g === '&') return caps?.[0] ?? '';
    return caps?.[Number(g)] ?? '';
  });
}

interface Preview { spans: PreviewSpan[]; groups: monaco.editor.FindMatch[][]; total: number; capped: boolean; version: number }

/** Agrupa as ocorrências por trecho de linhas e monta o "antes" e o "depois" de cada trecho */
function buildPreview(model: monaco.editor.ITextModel, list: monaco.editor.FindMatch[], rep: string, isRegex: boolean): Preview {
  const groups: monaco.editor.FindMatch[][] = [];
  let end = -1;
  for (const m of list) {
    if (groups.length && m.range.startLineNumber <= end) { groups[groups.length - 1].push(m); end = Math.max(end, m.range.endLineNumber); }
    else { groups.push([m]); end = m.range.endLineNumber; }
  }
  const spans = groups.map((g): PreviewSpan => {
    const line = g[0].range.startLineNumber;
    const endLine = Math.max(...g.map((m) => m.range.endLineNumber));
    const text = model.getValueInRange(new monaco.Range(line, 1, endLine, model.getLineMaxColumn(endLine)));
    const base = model.getOffsetAt({ lineNumber: line, column: 1 });
    const before: Seg[] = [];
    const after: Seg[] = [];
    let pos = 0;
    for (let k = 0; k < g.length; k++) {
      const m = g[k];
      if (k === MAX_HITS_SHOWN_PER_SPAN) {
        const more = { text: ` … +${g.length - k} nesta linha`, hit: false };
        before.push(more); after.push(more);
        pos = text.length;
        break;
      }
      const s = model.getOffsetAt(m.range.getStartPosition()) - base;
      const e = model.getOffsetAt(m.range.getEndPosition()) - base;
      if (s > pos) { const t = { text: text.slice(pos, s), hit: false }; before.push(t); after.push(t); }
      before.push({ text: text.slice(s, e), hit: true });
      after.push({ text: expandReplacement(rep, m.matches, isRegex), hit: true });
      pos = e;
    }
    if (pos < text.length) { const t = { text: text.slice(pos), hit: false }; before.push(t); after.push(t); }
    return { line, endLine, before, after, count: g.length };
  });
  return { spans, groups, total: list.length, capped: list.length >= MAX_MATCHES, version: model.getAlternativeVersionId() };
}

function Toggle({ on, title, onClick, children }: { on: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-[22px] w-[24px] items-center justify-center rounded-[5px] border transition-colors ${
        on ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'border-transparent text-[var(--text-2)] hover:bg-[var(--hover)]'
      }`}
    >
      {children}
    </button>
  );
}

export default function FindPanel({ editor, showReplace, focusToken, onToggleReplace, onClose, controller }: {
  editor: Editor;
  showReplace: boolean;
  focusToken: number;
  onToggleReplace: () => void;
  onClose: () => void;
  controller: React.MutableRefObject<FindController | null>;
}) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const [matches, setMatches] = useState<monaco.editor.FindMatch[]>([]);
  const [current, setCurrent] = useState(-1);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const findInput = useRef<HTMLInputElement>(null);
  const deco = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);

  const search = useCallback((): monaco.editor.FindMatch[] => {
    const model = editor.getModel();
    if (!model || !query) return [];
    try {
      if (regex) new RegExp(query);
      return model.findMatches(query, false, regex, matchCase, wholeWord ? WORD_SEPARATORS : null, true, MAX_MATCHES);
    } catch {
      return [];
    }
  }, [editor, query, regex, matchCase, wholeWord]);

  // Seleção atual -> preencher campo de busca e focar
  useEffect(() => {
    const model = editor.getModel();
    const sel = editor.getSelection();
    if (model && sel && !sel.isEmpty() && sel.startLineNumber === sel.endLineNumber) {
      setQuery(model.getValueInRange(sel));
    }
    requestAnimationFrame(() => { findInput.current?.focus(); findInput.current?.select(); });
  }, [focusToken, editor]);

  // Recalcula ao mudar conteúdo/modelo
  useEffect(() => {
    const d1 = editor.onDidChangeModelContent(() => setVersion((v) => v + 1));
    const d2 = editor.onDidChangeModel(() => setVersion((v) => v + 1));
    return () => { d1.dispose(); d2.dispose(); };
  }, [editor]);

  useEffect(() => {
    if (regex && query) {
      try { new RegExp(query); setError(false); } catch { setError(true); }
    } else setError(false);
    setMatches(search());
  }, [search, version, regex, query]);

  // Índice atual = ocorrência igual à seleção
  const syncCurrent = useCallback((list: monaco.editor.FindMatch[]) => {
    const sel = editor.getSelection();
    setCurrent(sel ? list.findIndex((m) => m.range.equalsRange(sel)) : -1);
  }, [editor]);

  useEffect(() => {
    syncCurrent(matches);
    const d = editor.onDidChangeCursorSelection(() => syncCurrent(matches));
    return () => d.dispose();
  }, [editor, matches, syncCurrent]);

  // Decorações
  useEffect(() => {
    if (!deco.current) deco.current = editor.createDecorationsCollection();
    deco.current.set(
      matches.map((m, i) => ({
        range: m.range,
        options: {
          className: i === current ? 'find-current' : 'find-match',
          overviewRuler: { color: '#e8a000', position: monaco.editor.OverviewRulerLane.Center },
          minimap: { color: '#e8a000', position: monaco.editor.MinimapPosition.Inline },
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      })),
    );
  }, [editor, matches, current]);

  useEffect(() => () => { deco.current?.clear(); }, []);

  const goTo = useCallback((m: monaco.editor.FindMatch) => {
    editor.setSelection(m.range);
    editor.revealRangeInCenterIfOutsideViewport(m.range, monaco.editor.ScrollType.Smooth);
  }, [editor]);

  const next = useCallback(() => {
    const list = search();
    if (!list.length) return;
    const sel = editor.getSelection();
    const pos = sel ? sel.getEndPosition() : { lineNumber: 1, column: 1 };
    const m = list.find((x) => monaco.Position.isBefore(pos as monaco.Position, x.range.getStartPosition()) || monaco.Position.equals(pos as monaco.Position, x.range.getStartPosition()) && !(sel && x.range.equalsRange(sel))) ?? list[0];
    goTo(m);
  }, [editor, search, goTo]);

  const prev = useCallback(() => {
    const list = search();
    if (!list.length) return;
    const sel = editor.getSelection();
    const pos = sel ? sel.getStartPosition() : { lineNumber: 1, column: 1 };
    const before = list.filter((x) => monaco.Position.isBefore(x.range.getStartPosition(), pos as monaco.Position));
    goTo(before.length ? before[before.length - 1] : list[list.length - 1]);
  }, [editor, search, goTo]);

  useEffect(() => { controller.current = { next, prev }; return () => { controller.current = null; }; }, [controller, next, prev]);

  const onQueryChange = (q: string) => {
    setQuery(q);
    // Busca incremental a partir do início da seleção
    const model = editor.getModel();
    if (!model || !q) return;
    try {
      if (regex) new RegExp(q);
      const sel = editor.getSelection();
      const start = sel ? sel.getStartPosition() : new monaco.Position(1, 1);
      const m = model.findNextMatch(q, start, regex, matchCase, wholeWord ? WORD_SEPARATORS : null, false);
      if (m) goTo(m);
    } catch { /* regex inválida */ }
  };

  const replaceOne = () => {
    const model = editor.getModel();
    const sel = editor.getSelection();
    if (!model || !sel) return;
    const list = search();
    const m = list.find((x) => x.range.equalsRange(sel));
    if (m) {
      const text = expandReplacement(replacement, m.matches, regex);
      editor.pushUndoStop();
      editor.executeEdits('find-replace', [{ range: m.range, text, forceMoveMarkers: true }]);
      editor.pushUndoStop();
    }
    next();
  };

  // Substituir Tudo: primeiro mostra a prévia; só altera o documento ao confirmar
  const replaceAll = () => {
    const model = editor.getModel();
    const list = search();
    if (!model || !list.length) return;
    setPreview(buildPreview(model, list, replacement, regex));
  };

  const applyPreview = (skip: Set<number>) => {
    const model = editor.getModel();
    const p = preview;
    setPreview(null);
    if (!model || !p) return;
    if (model.getAlternativeVersionId() !== p.version) { replaceAll(); return; } // o texto mudou enquanto a prévia estava aberta: refaz
    const chosen = p.groups.filter((_, i) => !skip.has(i)).flat();
    if (!chosen.length) return;
    editor.pushUndoStop();
    editor.executeEdits('find-replace-all', chosen.map((m) => ({ range: m.range, text: expandReplacement(replacement, m.matches, regex) })));
    editor.pushUndoStop();
    requestAnimationFrame(() => findInput.current?.focus());
  };

  const keys = (e: React.KeyboardEvent, isReplace: boolean) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isReplace) { if (e.metaKey) replaceAll(); else replaceOne(); }
      else if (e.shiftKey) prev(); else next();
    }
    if (e.altKey && e.metaKey) {
      if (e.code === 'KeyC') { e.preventDefault(); setMatchCase((v) => !v); }
      if (e.code === 'KeyW') { e.preventDefault(); setWholeWord((v) => !v); }
      if (e.code === 'KeyR') { e.preventDefault(); setRegex((v) => !v); }
    }
  };

  const countLabel = !query ? '' : error ? 'Regex inválida' : matches.length === 0 ? 'Sem resultados' : `${current >= 0 ? current + 1 : '?'} de ${matches.length.toLocaleString('pt-BR')}`;

  const inputCls = 'h-[26px] w-full rounded-md border bg-[var(--surface)] px-2 text-[12.5px] outline-none transition-colors focus:border-[var(--accent)] select-text';

  return (
    <>
    {preview && (
      <ReplacePreview
        spans={preview.spans}
        total={preview.total}
        capped={preview.capped}
        find={query}
        replacement={replacement}
        onApply={applyPreview}
        onCancel={() => { setPreview(null); requestAnimationFrame(() => findInput.current?.focus()); }}
      />
    )}
    <div className="absolute top-2 right-5 z-30 w-[440px] rounded-xl border border-[var(--border)] bg-[var(--chrome-2)]/95 p-2 shadow-[var(--shadow)] backdrop-blur-xl">
      <div className="flex items-start gap-1.5">
        <button title="Alternar Substituir" onClick={onToggleReplace} className="mt-[3px] rounded p-0.5 text-[var(--text-2)] hover:bg-[var(--hover)]">
          {showReplace ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <div className="relative flex-1">
              <input
                ref={findInput}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={(e) => keys(e, false)}
                placeholder="Localizar"
                spellCheck={false}
                className={`${inputCls} pr-[78px] ${error ? 'border-red-500' : 'border-[var(--border-strong)]'}`}
              />
              <div className="absolute top-[2px] right-[2px] flex gap-[1px]">
                <Toggle on={matchCase} title="Diferenciar Maiúsculas/Minúsculas (⌥⌘C)" onClick={() => setMatchCase(!matchCase)}><CaseSensitive size={15} /></Toggle>
                <Toggle on={wholeWord} title="Palavra Inteira (⌥⌘W)" onClick={() => setWholeWord(!wholeWord)}><WholeWord size={15} /></Toggle>
                <Toggle on={regex} title="Expressão Regular (⌥⌘R)" onClick={() => setRegex(!regex)}><Regex size={14} /></Toggle>
              </div>
            </div>
            <span className={`w-[78px] shrink-0 text-center text-[11px] ${error || (query && !matches.length) ? 'text-red-500' : 'text-[var(--text-3)]'}`}>{countLabel}</span>
            <button title="Anterior (⇧↩)" onClick={prev} className="rounded p-1 text-[var(--text-2)] hover:bg-[var(--hover)]"><ChevronUp size={14} /></button>
            <button title="Próximo (↩)" onClick={next} className="rounded p-1 text-[var(--text-2)] hover:bg-[var(--hover)]"><ChevronDown size={14} /></button>
            <button title="Fechar (Esc)" onClick={onClose} className="rounded p-1 text-[var(--text-2)] hover:bg-[var(--hover)]"><X size={14} /></button>
          </div>
          {showReplace && (
            <div className="flex items-center gap-1">
              <input
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                onKeyDown={(e) => keys(e, true)}
                placeholder={regex ? 'Substituir ($1, $2… para grupos)' : 'Substituir'}
                spellCheck={false}
                className={`${inputCls} border-[var(--border-strong)]`}
              />
              <button title="Substituir (↩)" onClick={replaceOne} className="flex h-[26px] items-center gap-1 rounded-md px-2 text-[12px] hover:bg-[var(--hover)]">
                <Replace size={13} /> Substituir
              </button>
              <button title="Substituir Tudo… mostra antes o que vai mudar (⌘↩)" onClick={replaceAll} className="flex h-[26px] items-center gap-1 rounded-md bg-[var(--accent)] px-2 text-[12px] text-white hover:brightness-110">
                <ReplaceAll size={13} /> Tudo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
