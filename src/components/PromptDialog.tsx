import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';

/** Caixa simples para pedir um texto (ex.: prefixo/sufixo das linhas) */
export default function PromptDialog({ title, hint, onOk, onCancel }: {
  title: string;
  hint?: string;
  onOk: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[18vh]" onMouseDown={onCancel}>
      <div
        className="w-[420px] max-w-[calc(100vw-32px)] rounded-xl border border-[var(--border)] bg-[var(--chrome-2)] p-4 shadow-[var(--shadow)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-[13px] font-semibold">{title}</div>
        {hint && <div className="mb-3 text-[11.5px] text-[var(--text-2)]">{hint}</div>}
        <input
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onOk(value); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
          }}
          spellCheck={false}
          className="h-[30px] w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-2 font-mono text-[12.5px] outline-none focus:border-[var(--accent)]"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="h-[28px] rounded-md px-3 text-[12px] hover:bg-[var(--hover)]">{t('Cancelar')}</button>
          <button onClick={() => onOk(value)} className="h-[28px] rounded-md bg-[var(--accent)] px-3 text-[12px] text-white hover:brightness-110">{t('Aplicar')}</button>
        </div>
      </div>
    </div>
  );
}
