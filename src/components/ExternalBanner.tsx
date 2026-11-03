// Aviso de arquivo alterado ou apagado por outro programa
import { kt } from '../platform';
export default function ExternalBanner({ kind, name, onCompare, onReload, onKeep, onClose }: {
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
