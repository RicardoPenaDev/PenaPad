import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { api } from '../api';
import { t } from '../i18n';
import { storeGet, storeSet } from '../storage';

type Phase = 'idle' | 'starting' | 'listening' | 'stopping';

function errorText(code: string): string {
  switch (code) {
    case 'speech-disabled': return t('Ative o Ditado em Ajustes do Sistema → Teclado → Ditado e tente novamente.');
    case 'speech-permission': return t('Permita o reconhecimento de fala em Ajustes do Sistema → Privacidade e Segurança.');
    case 'mic-permission': return t('Permita o microfone em Ajustes do Sistema → Privacidade e Segurança.');
    case 'microphone': return t('Não foi possível abrir o microfone. Confira a entrada de áudio do sistema.');
    case 'unavailable': return t('O reconhecimento deste idioma está indisponível. Confira a conexão e tente novamente.');
    default: return t('O ditado foi interrompido. Você pode inserir o texto recebido ou tentar novamente.');
  }
}

export default function DictationDialog({ onInsert, onClose }: {
  onInsert: (text: string) => boolean;
  onClose: () => void;
}) {
  const [language, setLanguage] = useState(() => storeGet('dictationLanguage') === 'en-US' ? 'en-US' : 'pt-BR');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [detail, setDetail] = useState('');
  const token = useRef(0);
  const busy = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const recording = phase !== 'idle';

  useEffect(() => {
    let disposed = false;
    let off: (() => void) | undefined;
    root.current?.querySelector<HTMLElement>('select')?.focus();
    api.onDictation((e) => {
      if (disposed || e.token !== token.current) return;
      if (e.kind === 'transcript') setText(e.text);
      else if (e.kind === 'error') {
        const [code, diagnostic = ''] = e.text.split('|');
        setError(errorText(code)); setDetail(diagnostic);
      }
      else {
        setPhase(e.kind === 'stopped' ? 'idle' : e.kind);
        if (e.kind === 'stopped') busy.current = false;
      }
    }).then((unlisten) => {
      if (disposed) unlisten();
      else { off = unlisten; setReady(true); }
    }).catch(() => { if (!disposed) setError(errorText('recognition')); });
    api.dictationAvailable().then((v) => { if (!disposed) setAvailable(v); })
      .catch(() => { if (!disposed) setAvailable(false); });
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeRef.current(); }
      if (e.key === 'Tab') {
        const list = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), textarea:not(:disabled)') ?? [])];
        const next = e.shiftKey ? list.at(-1) : list[0];
        if (document.activeElement === (e.shiftKey ? list[0] : list.at(-1))) { e.preventDefault(); next?.focus(); }
      }
    };
    document.addEventListener('keydown', keys, true);
    return () => {
      disposed = true;
      off?.();
      document.removeEventListener('keydown', keys, true);
      if (token.current) void api.dictationStop(token.current, true).catch(() => {});
    };
  }, []);

  const start = async () => {
    if (busy.current || !ready || !available) return;
    busy.current = true;
    token.current = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    setText(''); setError(''); setDetail(''); setPhase('starting');
    storeSet('dictationLanguage', language);
    try { await api.dictationStart(token.current, language); }
    catch (e) { busy.current = false; setPhase('idle'); setError(errorText('recognition')); setDetail(String(e).slice(0, 2000)); }
  };
  const stop = async () => {
    setPhase('stopping');
    try { await api.dictationStop(token.current); }
    catch (e) { setError(errorText('recognition')); setDetail(String(e).slice(0, 2000)); setPhase('idle'); busy.current = false; }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[12vh]">
      <div ref={root} role="dialog" aria-modal="true" aria-labelledby="dictation-title" data-modal
        className="w-[520px] max-w-[calc(100vw-32px)] rounded-xl border border-[var(--border)] bg-[var(--chrome-2)] p-5 shadow-[var(--shadow)]">
        <h2 id="dictation-title" className="mb-2 flex items-center gap-2 text-[15px] font-semibold"><Mic size={18} />{t('Ditado')}</h2>
        <p className="mb-4 text-[12px] text-[var(--text-2)]">{t('O ditado usa o reconhecimento do macOS. Se o processamento local não estiver disponível, o áudio poderá ser enviado à Apple. Nenhum áudio é salvo pelo PenaPad.')}</p>
        <label className="flex items-center gap-3 text-[12px]">{t('Idioma do ditado')}
          <select value={language} disabled={recording} onChange={(e) => setLanguage(e.target.value)}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1">
            <option value="pt-BR">Português (Brasil)</option><option value="en-US">English (US)</option>
          </select>
        </label>
        <div role="status" className="my-3 text-[12px] text-[var(--accent-text)]">
          {available === false ? t('O ditado integrado está disponível nesta versão somente no macOS.')
            : phase === 'starting' ? t('Aguardando permissão para ditar…')
            : phase === 'listening' ? t('Ouvindo… Fale no idioma escolhido.')
            : phase === 'stopping' ? t('Finalizando o ditado…') : t('Inicie o ditado e revise o texto antes de inserir.')}
        </div>
        <textarea aria-label={t('Texto ditado')} value={text} readOnly={recording} onChange={(e) => setText(e.target.value)}
          className="h-[160px] w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-[13px] outline-none focus:border-[var(--accent)]" />
        {error && <p role="alert" className="mt-2 text-[12px] text-red-500">{error}</p>}
        {error && detail && <details className="mt-1 text-[11px] text-[var(--text-2)]"><summary>{t('Detalhes do erro')}</summary><pre className="whitespace-pre-wrap break-all">{detail}</pre></details>}
        <p className="mt-2 text-[11px] text-[var(--text-2)]">{t('Cada gravação dura até 55 segundos. Inserir substitui a seleção; Desfazer recupera o texto anterior.')}</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2 text-[12px]">
          <button className="rounded-md px-3 py-2 hover:bg-[var(--hover)]" onClick={onClose}>{t('Cancelar')}</button>
          {recording ? <button disabled={phase === 'stopping'} onClick={stop} className="flex items-center gap-1 rounded-md px-3 py-2 hover:bg-[var(--hover)] disabled:opacity-40"><Square size={12} />{t('Parar ditado')}</button>
            : <button disabled={!ready || !available} onClick={start} className="flex items-center gap-1 rounded-md px-3 py-2 hover:bg-[var(--hover)] disabled:opacity-40"><Mic size={14} />{t('Iniciar ditado')}</button>}
          <button disabled={recording || !text.trim()} onClick={() => {
            if (!onInsert(text)) setError(t('O documento mudou durante o ditado. Copie o texto acima e reabra o ditado na posição desejada.'));
          }} className="rounded-md bg-[var(--accent)] px-3 py-2 text-white disabled:opacity-40">{t('Inserir texto')}</button>
        </div>
      </div>
    </div>
  );
}
