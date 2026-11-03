import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { score } from '../commands';
import { storeGet, storeSet } from '../storage';
import { keys } from '../platform';
import { t } from '../i18n';

export interface PaletteItem {
  key: string;
  label: string;
  group: string;
  keys?: string;
  alt?: string;
  /** opção ligada (ex.: Minimapa) — mostra um ✓ */
  on?: boolean;
}

const RECENT_KEY = 'palette.recent';
const MAX_SHOWN = 200;

function loadRecent(): string[] {
  try { return JSON.parse(storeGet(RECENT_KEY) ?? '[]'); } catch { return []; }
}
function saveRecent(key: string) {
  storeSet(RECENT_KEY, JSON.stringify([key, ...loadRecent().filter((k) => k !== key)].slice(0, 8)));
}

/** Paleta de comandos (⇧⌘P): digite parte do nome de qualquer função, ↑/↓ para escolher, Enter executa */
export default function CommandPalette({ items, onRun, onCancel }: {
  items: PaletteItem[];
  onRun: (item: PaletteItem) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const recent = useMemo(loadRecent, []);

  useEffect(() => { input.current?.focus(); }, []);

  const results = useMemo(() => {
    if (!query.trim()) {
      // Sem texto: os usados por último primeiro, depois todos na ordem do menu
      const byKey = new Map(items.map((i) => [i.key, i]));
      const rec = recent.map((k) => byKey.get(k)).filter((x): x is PaletteItem => !!x);
      const rest = items.filter((i) => !recent.includes(i.key) && !i.key.startsWith('language:'));
      return { list: [...rec, ...rest].slice(0, MAX_SHOWN), recentCount: rec.length, total: rec.length + rest.length };
    }
    const scored = items
      // O grupo também entra na busca ("linguagem python", "aba notas"), valendo menos que o nome
      .map((i) => ({ i, s: score(query, i.label, i.alt, i.group) }))
      .filter((x) => x.s >= 0)
      .map((x) => ({ ...x, s: x.s + (recent.includes(x.i.key) ? 3 : 0) }))
      .sort((a, b) => b.s - a.s);
    return { list: scored.slice(0, MAX_SHOWN).map((x) => x.i), recentCount: 0, total: scored.length };
  }, [query, items, recent]);

  useEffect(() => { setSel(0); }, [query]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const run = (it: PaletteItem | undefined) => {
    if (!it) return;
    saveRecent(it.key);
    onRun(it);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const n = results.list.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => (n ? (s + 1) % n : 0)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => (n ? (s - 1 + n) % n : 0)); }
    else if (e.key === 'PageDown') { e.preventDefault(); setSel((s) => Math.min(n - 1, s + 10)); }
    else if (e.key === 'PageUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 10)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(results.list[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
  };

  return (
    <div data-modal className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[12vh]" onMouseDown={onCancel}>
      <div
        className="flex max-h-[70vh] w-[560px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--chrome-2)] shadow-[var(--shadow)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3">
          <Search size={15} className="shrink-0 text-[var(--text-3)]" />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder={t("Digite o nome de uma função (ex.: duplicadas, json, tema escuro, aba)")}
            spellCheck={false}
            className="h-[42px] min-w-0 flex-1 bg-transparent text-[13.5px] !outline-none"
          />
        </div>
        <div ref={list} className="lang-list min-h-0 flex-1 overflow-y-auto p-1.5">
          {results.list.length === 0 && (
            <div className="px-3 py-6 text-center text-[12.5px] text-[var(--text-3)]">{t('Nenhuma função com esse nome')}</div>
          )}
          {results.list.map((it, i) => (
            <div key={it.key}>
              {i === 0 && results.recentCount > 0 && <Heading>{t('Usados recentemente')}</Heading>}
              {i === results.recentCount && results.recentCount > 0 && <Heading>{t('Todos')}</Heading>}
              <button
                data-i={i}
                onMouseMove={() => { if (sel !== i) setSel(i); }}
                onClick={() => run(it)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-[5px] text-left ${i === sel ? 'bg-[var(--accent-soft)]' : ''}`}
              >
                <span className="w-[86px] shrink-0 truncate text-[11px] text-[var(--text-3)]">{it.group}</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{it.label}</span>
                {it.on && <Check size={13} className="shrink-0 text-[var(--accent-text)]" />}
                {it.keys && <kbd className="shrink-0 rounded border border-[var(--border)] px-1.5 font-sans text-[11px] text-[var(--text-2)]">{keys(it.keys)}</kbd>}
              </button>
            </div>
          ))}
          {results.total > results.list.length && (
            <div className="px-3 py-1.5 text-[11px] text-[var(--text-3)]">e mais {results.total - results.list.length}… continue digitando para filtrar</div>
          )}
        </div>
        <div className="flex gap-3 border-t border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--text-3)]">
          <span>↑↓ {t('escolher')}</span><span>↩ {t('executar')}</span><span>esc {t('fechar')}</span>
        </div>
      </div>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <div className="px-3 pt-1.5 pb-0.5 text-[10.5px] font-semibold tracking-wide text-[var(--text-3)] uppercase">{children}</div>;
}
