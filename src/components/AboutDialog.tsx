// Janela "Sobre o PenaPad": versão, atualizações, links do projeto e (quando configurado) apoio ao projeto
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bug, Coffee, Download, ExternalLink, Feather, FileText, GitBranch, Sparkles, X } from 'lucide-react';
import { t } from '../i18n';

export type LinkKind = 'site' | 'issues' | 'license' | 'notices' | 'releases' | 'donate';

export default function AboutDialog({ version, donate, onClose, onCheckUpdates, onOpen, onReleaseNotes }: {
  version: string;
  donate: boolean;
  onClose: () => void;
  onCheckUpdates: () => void;
  onOpen: (kind: LinkKind) => void;
  onReleaseNotes: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.focus(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose]);

  const link = 'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-[var(--hover)]';

  return createPortal(
    <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/25" onMouseDown={onClose}>
      <div
        ref={box}
        tabIndex={-1}
        role="dialog"
        aria-label={t('Sobre o PenaPad')}
        className="relative w-[380px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--chrome-2)] shadow-[var(--shadow)] outline-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button title={t('Fechar (Esc)')} onClick={onClose} className="absolute top-2.5 right-2.5 z-10 rounded-md p-1 text-white/80 hover:bg-white/15">
          <X size={15} />
        </button>
        {/* Cabeçalho com a cor do app */}
        <div className="flex flex-col items-center bg-gradient-to-b from-[#4a80de] to-[#173c80] px-6 pt-7 pb-5 text-white">
          <div className="flex h-[64px] w-[64px] items-center justify-center rounded-[16px] bg-gradient-to-br from-[#3a73d8] to-[#173c80] shadow-[0_6px_18px_rgba(0,0,0,0.3)] ring-1 ring-white/25">
            <Feather size={34} strokeWidth={2.2} />
          </div>
          <div className="mt-3 text-[20px] font-bold tracking-tight">PenaPad</div>
          <div className="mt-0.5 text-[12px] text-white/80">{t('Editor de texto e código leve')}</div>
          <div data-version className="mt-2 rounded-full bg-white/15 px-2.5 py-0.5 text-[11.5px] font-medium">{t('Versão {v}', { v: version })}</div>
        </div>

        <div className="flex gap-2 px-4 pt-4">
          <button onClick={onCheckUpdates} className="flex h-[30px] flex-1 items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] text-[12.5px] font-medium text-white hover:brightness-110">
            <Download size={14} /> {t('Procurar Atualizações')}
          </button>
          <button onClick={onReleaseNotes} className="flex h-[30px] flex-1 items-center justify-center gap-1.5 rounded-md border border-[var(--border-strong)] text-[12.5px] hover:bg-[var(--hover)]">
            <Sparkles size={14} /> {t('Novidades')}
          </button>
        </div>

        <div className="flex flex-col px-3 pt-2 pb-1">
          <button className={link} onClick={() => onOpen('site')}><GitBranch size={15} className="text-[var(--text-2)]" /> {t('Código-fonte no GitHub')}<ExternalLink size={12} className="ml-auto text-[var(--text-3)]" /></button>
          <button className={link} onClick={() => onOpen('issues')}><Bug size={15} className="text-[var(--text-2)]" /> {t('Relatar um problema ou sugerir algo')}<ExternalLink size={12} className="ml-auto text-[var(--text-3)]" /></button>
          <button className={link} onClick={() => onOpen('license')}><FileText size={15} className="text-[var(--text-2)]" /> {t('Licença MIT — gratuito e de código aberto')}<ExternalLink size={12} className="ml-auto text-[var(--text-3)]" /></button>
        </div>

        {donate && (
          <div className="px-4 pb-1">
            <button onClick={() => onOpen('donate')} className="flex h-[32px] w-full items-center justify-center gap-2 rounded-md bg-[#ffdd00] text-[12.5px] font-semibold text-[#3b2a00] hover:brightness-105">
              <Coffee size={15} /> {t('Gostou? Pague um café ao autor')}
            </button>
          </div>
        )}

        <div className="border-t border-[var(--border)] px-4 py-3 text-center text-[11px] leading-relaxed text-[var(--text-3)]">
          © 2026 Ricardo Pena<br />
          {t('Feito com Tauri, React e Monaco Editor.')}{' '}
          <button className="underline hover:text-[var(--text-2)]" onClick={() => onOpen('notices')}>{t('Componentes de terceiros')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
