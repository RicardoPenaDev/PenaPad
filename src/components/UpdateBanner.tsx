// Aviso de nova versão: aparece no topo, sem interromper o que você está fazendo
import { Download } from 'lucide-react';
import { t } from '../i18n';

export interface UpdateInfo { version: string; current: string; notes: string | null; can_install: boolean }

export default function UpdateBanner({ info, busy, onInstall, onDetails, onLater }: {
  info: UpdateInfo;
  busy: boolean;
  onInstall: () => void;
  onDetails: () => void;
  onLater: () => void;
}) {
  const btn = 'h-[24px] rounded-md px-2 text-[12px] whitespace-nowrap hover:bg-[var(--hover)] disabled:opacity-50';
  return (
    <div data-update-banner className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--border)] bg-[var(--accent-soft)] px-3 py-1.5 text-[12px] text-[var(--accent-text)]">
      <Download size={14} />
      <span className="min-w-0 flex-1">
        {busy
          ? t('Baixando e instalando o PenaPad {v}… o app vai reiniciar sozinho, com as abas como estão.', { v: info.version })
          : t('O PenaPad {v} está disponível (você tem o {cur}).', { v: info.version, cur: info.current })}
      </span>
      {!busy && (
        <>
          {info.can_install ? (
            <button className={`${btn} bg-[var(--accent)] font-semibold text-white hover:brightness-110`} onClick={onInstall}>{t('Atualizar e Reiniciar')}</button>
          ) : (
            <button className={`${btn} bg-[var(--accent)] font-semibold text-white hover:brightness-110`} onClick={onDetails}>{t('Baixar')}</button>
          )}
          <button className={btn} onClick={onDetails}>{t('Novidades')}</button>
          <button className={btn} onClick={onLater}>{t('Agora Não')}</button>
        </>
      )}
    </div>
  );
}
