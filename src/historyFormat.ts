// Textos do histórico de versões: motivo, data e tamanho
/** Chave do histórico: arquivos pelo caminho (continua ao reabrir), textos sem arquivo pela aba */
export const historyKey = (t: { id: string; path: string | null }) => (t.path ? `f:${t.path}` : `u:${t.id}`);

export const REASONS: Record<string, string> = {
  aberto: 'Ao abrir o arquivo',
  salvo: 'Salvo',
  auto: 'Automático (durante a edição)',
  fechado: 'Aba fechada sem salvar',
  recarregar: 'Antes de recarregar do disco',
  sobrescrever: 'Versão do disco antes de sobrescrever',
  restaurar: 'Antes de restaurar uma versão',
};

export function formatWhen(ts: number): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const today = new Date();
  const yest = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return `hoje às ${time}`;
  if (d.toDateString() === yest.toDateString()) return `ontem às ${time}`;
  return `${d.toLocaleDateString('pt-BR')} às ${time}`;
}
export const formatSize = (n: number) => (n < 1024 ? `${n} bytes` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

