import { Plus, X } from 'lucide-react';

export interface TabView { id: string; name: string; dirty: boolean; path: string | null }

export default function TabBar({ tabs, activeId, focused = true, onSelect, onClose, onNew }: {
  tabs: TabView[];
  focused?: boolean;
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex h-[36px] shrink-0 items-end gap-1 bg-[var(--chrome)] px-2">
      <div className="tab-scroll flex min-w-0 items-end gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const active = t.id === activeId;
          return (
            <div
              key={t.id}
              data-tab-id={t.id}
              title={t.path ?? t.name}
              onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); onClose(t.id); } else onSelect(t.id); }}
              className={`group relative flex h-[30px] max-w-[220px] min-w-[120px] shrink-0 items-center gap-2 rounded-t-lg pr-1.5 pl-3 text-[12.5px] transition-colors ${
                active
                  ? 'bg-[var(--surface)] font-medium shadow-[0_-1px_0_var(--border),1px_0_0_var(--border),-1px_0_0_var(--border)]'
                  : 'text-[var(--text-2)] hover:bg-[var(--hover)]'
              }`}
            >
              {active && <span className={`absolute top-0 right-2 left-2 h-[2px] rounded-b ${focused ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'}`} />}
              <span className="flex-1 truncate">{t.name}</span>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onClose(t.id); }}
                title="Fechar aba (⌘W)"
                className="relative flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded hover:bg-[var(--pressed)]"
              >
                {t.dirty && <span className="absolute h-[7px] w-[7px] rounded-full bg-[var(--text-2)] group-hover:hidden" />}
                <X size={12} className={t.dirty ? 'hidden group-hover:block' : active ? '' : 'opacity-0 group-hover:opacity-100'} />
              </button>
            </div>
          );
        })}
      </div>
      <button
        onClick={onNew}
        title="Nova aba (⌘N)"
        className="mb-[3px] flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-md text-[var(--text-2)] hover:bg-[var(--hover)]"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
