import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Columns2, Rows2, X } from 'lucide-react';
import { monaco } from '../monaco';

export interface DiffSide { model: monaco.editor.ITextModel; label: string }

/**
 * Comparação entre dois textos. O editor de comparação só existe enquanto esta tela está aberta:
 * é criado ao montar e descartado ao fechar (os modelos pertencem a quem abriu).
 */
export interface DiffContent { original: DiffSide; modified: DiffSide; temp: monaco.editor.ITextModel[] }

/**
 * Comparação entre dois textos. O editor de comparação é criado na primeira vez e reaproveitado;
 * ao fechar, os textos são desligados e os modelos temporários (ex.: versão do disco) descartados.
 * Fechado, fica com visibility:hidden (classe diff-hidden; não display:none): com display:none o Monaco perde as medidas
 * e, ao reabrir com textos grandes, tentava desenhar tudo — medido: 2,2 GB com 2×100 mil linhas.
 */
export default function DiffView({ content, fontSize, actions, onClose }: {
  content: DiffContent | null;
  fontSize: number;
  actions?: ReactNode;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const diff = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const shownTemp = useRef<monaco.editor.ITextModel[]>([]);
  const [sideBySide, setSideBySide] = useState(true);
  const [ignoreWs, setIgnoreWs] = useState(false);
  const [summary, setSummary] = useState<{ added: number; removed: number; blocks: number } | null>(null);

  useEffect(() => {
    const d = monaco.editor.createDiffEditor(host.current!, {
      automaticLayout: true,
      fontFamily: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Monaco, monospace",
      fontSize,
      lineHeight: 1.55,
      originalEditable: false,
      renderSideBySide: true,
      ignoreTrimWhitespace: false,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      contextmenu: false,
      renderOverviewRuler: true,
      hideUnchangedRegions: { enabled: false },
      scrollbar: { verticalScrollbarSize: 11, horizontalScrollbarSize: 11, useShadows: false },
    });
    const sub = d.onDidUpdateDiff(() => {
      if (!d.getModel()) return;
      const changes = d.getLineChanges() ?? [];
      let added = 0;
      let removed = 0;
      for (const c of changes) {
        if (c.modifiedEndLineNumber >= c.modifiedStartLineNumber && c.modifiedEndLineNumber > 0) added += c.modifiedEndLineNumber - c.modifiedStartLineNumber + 1;
        if (c.originalEndLineNumber >= c.originalStartLineNumber && c.originalEndLineNumber > 0) removed += c.originalEndLineNumber - c.originalStartLineNumber + 1;
      }
      setSummary({ added, removed, blocks: changes.length });
    });
    diff.current = d;
    return () => {
      sub.dispose();
      d.setModel(null);
      d.dispose();
      diff.current = null;
      shownTemp.current.forEach((m) => m.dispose());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Troca o que está sendo comparado; ao fechar (content = null) solta os textos
  useEffect(() => {
    const d = diff.current;
    if (!d) return;
    const oldTemp = shownTemp.current;
    setSummary(null);
    d.setModel(content ? { original: content.original.model, modified: content.modified.model } : null);
    shownTemp.current = content?.temp ?? [];
    oldTemp.filter((m) => !shownTemp.current.includes(m)).forEach((m) => m.dispose());
    if (content) requestAnimationFrame(() => d.getModifiedEditor().focus());
  }, [content]);

  useEffect(() => { diff.current?.updateOptions({ renderSideBySide: sideBySide, ignoreTrimWhitespace: ignoreWs, fontSize }); }, [sideBySide, ignoreWs, fontSize]);

  useEffect(() => {
    if (!content) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
      else if (e.key === 'F7') { e.preventDefault(); diff.current?.goToDiff(e.shiftKey ? 'previous' : 'next'); }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [content, onClose]);

  const original = content?.original;
  const modified = content?.modified;
  const btn = 'flex h-[26px] items-center gap-1 rounded-md px-2 text-[12px] hover:bg-[var(--hover)]';
  return (
    <div className={`absolute inset-0 z-30 flex flex-col bg-[var(--surface)] ${content ? '' : 'diff-hidden'}`}>
      <div className="flex min-h-[38px] shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--border)] bg-[var(--chrome)] px-3 py-1 text-[12px]">
        <span className="min-w-0 truncate font-semibold">
          <span className="text-[var(--diff-del)]">{original?.label}</span>
          <span className="mx-1.5 text-[var(--text-3)]">↔</span>
          <span className="text-[var(--diff-add)]">{modified?.label}</span>
        </span>
        {summary && (
          <span className="text-[var(--text-2)]">
            {summary.blocks === 0 ? 'Os textos são iguais' : (
              <>
                <span className="text-[var(--diff-add)]">+{summary.added}</span>{' '}
                <span className="text-[var(--diff-del)]">−{summary.removed}</span>{' '}
                · {summary.blocks} {summary.blocks === 1 ? 'diferença' : 'diferenças'}
              </>
            )}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button className={btn} title="Diferença anterior (⇧F7)" onClick={() => diff.current?.goToDiff('previous')}><ChevronUp size={14} /> Anterior</button>
          <button className={btn} title="Próxima diferença (F7)" onClick={() => diff.current?.goToDiff('next')}><ChevronDown size={14} /> Próxima</button>
          <button className={btn} title="Lado a lado ou em uma coluna" onClick={() => setSideBySide((v) => !v)}>
            {sideBySide ? <Rows2 size={14} /> : <Columns2 size={14} />} {sideBySide ? 'Em Linha' : 'Lado a Lado'}
          </button>
          <label className={`${btn} cursor-default`} title="Ignorar diferenças só de espaços no início/fim das linhas">
            <input type="checkbox" checked={ignoreWs} onChange={(e) => setIgnoreWs(e.target.checked)} /> Ignorar espaços
          </label>
          {actions}
          <button className={btn} title="Fechar comparação (Esc)" onClick={onClose}><X size={14} /> Fechar</button>
        </div>
      </div>
      <div ref={host} className="min-h-0 flex-1" />
    </div>
  );
}
