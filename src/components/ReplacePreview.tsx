import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { kt } from '../platform';

/** Um trecho do documento (uma ou mais linhas seguidas) com as ocorrências que serão trocadas */
export interface PreviewSpan {
  line: number;
  endLine: number;
  before: Seg[];
  after: Seg[];
  count: number;
}
export interface Seg { text: string; hit: boolean }

const MAX_SHOWN = 1000;

/** Encurta os trechos sem ocorrência muito longos (ex.: JSON numa linha só), mantendo o contexto perto de cada uma */
function compact(segs: Seg[]): Seg[] {
  return segs.map((s, i) => {
    if (s.hit) return { ...s, text: s.text.length > 200 ? `${s.text.slice(0, 120)}…${s.text.slice(-60)}` : s.text };
    const t = s.text;
    const first = i === 0;
    const last = i === segs.length - 1;
    if (first && t.length > 60) return { ...s, text: `…${t.slice(-60)}` };
    if (last && t.length > 80) return { ...s, text: `${t.slice(0, 80)}…` };
    if (!first && !last && t.length > 100) return { ...s, text: `${t.slice(0, 45)} … ${t.slice(-45)}` };
    return s;
  });
}

function show(text: string) {
  return text.replace(/\r?\n/g, '↵').replace(/\t/g, '→   ');
}

function Line({ segs, kind }: { segs: Seg[]; kind: 'del' | 'add' }) {
  return (
    <div className="font-mono text-[12px] leading-[1.55] whitespace-pre">
      <span className={`mr-1.5 inline-block w-[10px] select-none ${kind === 'del' ? 'text-[var(--diff-del)]' : 'text-[var(--diff-add)]'}`}>{kind === 'del' ? '−' : '+'}</span>
      {compact(segs).map((s, i) => s.hit ? (
        <span key={i} className={kind === 'del' ? 'rp-del' : 'rp-add'}>{show(s.text) || (kind === 'add' ? '∅' : '')}</span>
      ) : (
        <span key={i}>{show(s.text)}</span>
      ))}
    </div>
  );
}

/**
 * Prévia do "Substituir Tudo": lista cada linha que vai mudar (antes/depois).
 * Dá para desmarcar linhas. Nada muda no documento até clicar em Substituir.
 */
export default function ReplacePreview({ spans, total, capped, find, replacement, onApply, onCancel }: {
  spans: PreviewSpan[];
  total: number;
  capped: boolean;
  find: string;
  replacement: string;
  onApply: (skip: Set<number>) => void;
  onCancel: () => void;
}) {
  const [skip, setSkip] = useState<Set<number>>(() => new Set());
  const box = useRef<HTMLDivElement>(null);
  // Tira o foco do campo de busca (que fica atrás) para o que for digitado não mexer nele
  useEffect(() => { box.current?.focus(); }, []);

  const chosen = useMemo(() => spans.reduce((n, s, i) => n + (skip.has(i) ? 0 : s.count), 0), [spans, skip]);
  const chosenLines = spans.length - skip.size;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
      else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); e.stopPropagation(); if (chosen) onApply(skip); }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onApply, onCancel, skip, chosen]);

  const toggle = (i: number) => setSkip((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const setAll = (on: boolean) => setSkip(on ? new Set() : new Set(spans.map((_, i) => i)));
  const shown = spans.slice(0, MAX_SHOWN);
  // Com ocorrências que atravessam linhas, cada item da lista é um "trecho" (várias linhas seguidas)
  const multi = spans.some((x) => x.endLine > x.line);
  const unit = (n: number) => multi ? (n === 1 ? 'trecho' : 'trechos') : (n === 1 ? 'linha' : 'linhas');

  return createPortal(
    <div data-modal className="fixed inset-0 z-50 flex items-start justify-center bg-black/25 pt-[7vh]" onMouseDown={onCancel}>
      <div
        ref={box}
        tabIndex={-1}
        className="flex max-h-[82vh] w-[760px] outline-none max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--chrome-2)] shadow-[var(--shadow)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--border)] px-4 py-3">
          <div className="text-[13px] font-semibold">Prévia do Substituir Tudo</div>
          <div className="mt-0.5 truncate text-[12px] text-[var(--text-2)]">
            <span className="rp-del font-mono">{show(find)}</span>
            <span className="mx-1.5">→</span>
            <span className="rp-add font-mono">{show(replacement) || '(apagar)'}</span>
            <span className="ml-2">
              {total.toLocaleString('pt-BR')} {total === 1 ? 'ocorrência' : 'ocorrências'} em {spans.length.toLocaleString('pt-BR')} {unit(spans.length)}
            </span>
          </div>
          {capped && (
            <div className="mt-1 text-[11.5px] text-[var(--warn-text)]">⚠ Limite de 20.000 ocorrências por vez. Depois de substituir, repita para trocar o restante.</div>
          )}
        </div>
        <div className="lang-list min-h-0 flex-1 overflow-auto">
          {shown.map((s, i) => (
            <label key={i} className={`flex cursor-default items-start gap-2 border-b border-[var(--border)] px-3 py-1.5 last:border-b-0 hover:bg-[var(--hover)] ${skip.has(i) ? 'opacity-45' : ''}`}>
              <input type="checkbox" className="mt-[3px]" checked={!skip.has(i)} onChange={() => toggle(i)} />
              <span className="w-[54px] shrink-0 pt-[1px] text-right font-mono text-[11px] text-[var(--text-3)]">
                {s.endLine > s.line ? `${s.line}–${s.endLine}` : s.line}
              </span>
              <div className="min-w-0 flex-1 overflow-hidden">
                <Line segs={s.before} kind="del" />
                <Line segs={s.after} kind="add" />
              </div>
            </label>
          ))}
          {spans.length > MAX_SHOWN && (
            <div className="px-4 py-2 text-[11.5px] text-[var(--text-3)]">
              Mostrando os primeiros {MAX_SHOWN.toLocaleString('pt-BR')} itens. Os outros {(spans.length - MAX_SHOWN).toLocaleString('pt-BR')} também serão substituídos.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-[var(--border)] px-4 py-2.5">
          <button className="h-[26px] rounded-md px-2 text-[12px] hover:bg-[var(--hover)]" onClick={() => setAll(true)}>Marcar Todas</button>
          <button className="h-[26px] rounded-md px-2 text-[12px] hover:bg-[var(--hover)]" onClick={() => setAll(false)}>Desmarcar Todas</button>
          <span className="ml-auto text-[11.5px] text-[var(--text-3)]">{kt('⌘Z desfaz depois')}</span>
          <button className="h-[28px] rounded-md px-3 text-[12px] hover:bg-[var(--hover)]" onClick={onCancel}>Cancelar</button>
          <button
            disabled={!chosen}
            className="h-[28px] rounded-md bg-[var(--accent)] px-3 text-[12px] text-white hover:brightness-110 disabled:opacity-40"
            onClick={() => onApply(skip)}
          >
            Substituir {chosen.toLocaleString('pt-BR')} {chosen === 1 ? 'ocorrência' : 'ocorrências'}{chosenLines !== spans.length ? ` (${chosenLines} ${unit(chosenLines)})` : ''}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
