import { useEffect, useState } from 'react';

export interface PickItem { id: string; label: string; hint?: string }

/** Lista simples para escolher uma opção (setas + Enter, Esc cancela) */
export default function PickDialog({ title, items, onPick, onCancel }: {
  title: string;
  items: PickItem[];
  onPick: (id: string) => void;
  onCancel: () => void;
}) {
  const [sel, setSel] = useState(0);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (items[sel]) onPick(items[sel].id); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
      else return;
      e.stopPropagation();
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [items, sel, onPick, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[16vh]" onMouseDown={onCancel}>
      <div
        className="w-[440px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--chrome-2)] shadow-[var(--shadow)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--border)] px-4 py-3 text-[13px] font-semibold">{title}</div>
        <div className="lang-list max-h-[50vh] overflow-y-auto p-1.5">
          {items.map((it, i) => (
            <button
              key={it.id}
              onMouseEnter={() => setSel(i)}
              onClick={() => onPick(it.id)}
              className={`flex w-full flex-col items-start rounded-md px-3 py-1.5 text-left ${i === sel ? 'bg-[var(--accent-soft)]' : ''}`}
            >
              <span className="text-[12.5px]">{it.label}</span>
              {it.hint && <span className="max-w-full truncate text-[11px] text-[var(--text-3)]">{it.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
