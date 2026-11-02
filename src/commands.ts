// Lista de comandos da paleta (⇧⌘P). Os nomes e atalhos seguem os do menu do app.

export interface Command {
  cmd: string;
  arg?: string;
  label: string;
  group: string;
  keys?: string;
  /** palavras extras para a busca (sinônimos) */
  alt?: string;
}

export const COMMANDS: Command[] = [
  // Arquivo
  { cmd: 'new', label: 'Novo', group: 'Arquivo', keys: '⌘N', alt: 'nova aba documento' },
  { cmd: 'open', label: 'Abrir…', group: 'Arquivo', keys: '⌘O', alt: 'arquivo' },
  { cmd: 'save', label: 'Salvar', group: 'Arquivo', keys: '⌘S', alt: 'gravar' },
  { cmd: 'saveAs', label: 'Salvar Como…', group: 'Arquivo', keys: '⇧⌘S', alt: 'gravar' },
  { cmd: 'close', label: 'Fechar Aba', group: 'Arquivo', keys: '⌘W' },
  { cmd: 'reopenClosed', label: 'Reabrir Aba Fechada', group: 'Arquivo', keys: '⇧⌘T', alt: 'desfazer fechar' },
  { cmd: 'history', label: 'Histórico de Versões…', group: 'Arquivo', keys: '⇧⌘H', alt: 'snapshot backup restaurar versão anterior' },
  { cmd: 'compare', label: 'Comparar Textos…', group: 'Arquivo', alt: 'diff diferenças' },
  // Editar
  { cmd: 'undo', label: 'Desfazer', group: 'Editar', keys: '⌘Z' },
  { cmd: 'redo', label: 'Refazer', group: 'Editar', keys: '⇧⌘Z' },
  { cmd: 'selectAll', label: 'Selecionar Tudo', group: 'Editar', keys: '⌘A' },
  { cmd: 'comment', label: 'Comentar/Descomentar Linha', group: 'Editar', keys: '⌘/' },
  { cmd: 'format', label: 'Formatar Documento', group: 'Editar', keys: '⇧⌥F', alt: 'indentar' },
  { cmd: 'formatJson', label: 'Formatar JSON', group: 'Editar', alt: 'validar json indentar' },
  { cmd: 'find', label: 'Localizar…', group: 'Editar', keys: '⌘F', alt: 'buscar procurar' },
  { cmd: 'replace', label: 'Substituir…', group: 'Editar', keys: '⌥⌘F', alt: 'trocar' },
  { cmd: 'findNext', label: 'Localizar Próxima', group: 'Editar', keys: '⌘G' },
  { cmd: 'findPrev', label: 'Localizar Anterior', group: 'Editar', keys: '⇧⌘G' },
  { cmd: 'gotoLine', label: 'Ir para Linha…', group: 'Editar', keys: '⌃G' },
  // Seleção
  { cmd: 'addNextOccurrence', label: 'Selecionar Próxima Ocorrência', group: 'Seleção', keys: '⌘D', alt: 'cursores' },
  { cmd: 'selectOccurrences', label: 'Selecionar Todas as Ocorrências', group: 'Seleção', keys: '⇧⌘L', alt: 'cursores' },
  { cmd: 'columnSelection', label: 'Modo Seleção em Coluna', group: 'Seleção', alt: 'bloco retangular' },
  // Linhas
  { cmd: 'duplicate', label: 'Duplicar Linha', group: 'Linhas', keys: '⇧⌥↓', alt: 'copiar' },
  { cmd: 'moveUp', label: 'Mover Linha para Cima', group: 'Linhas', keys: '⌥↑' },
  { cmd: 'moveDown', label: 'Mover Linha para Baixo', group: 'Linhas', keys: '⌥↓' },
  { cmd: 'deleteLine', label: 'Excluir Linha', group: 'Linhas', keys: '⇧⌘K', alt: 'apagar remover' },
  { cmd: 'sortAsc', label: 'Ordenar (A→Z)', group: 'Linhas', alt: 'crescente' },
  { cmd: 'sortDesc', label: 'Ordenar (Z→A)', group: 'Linhas', alt: 'decrescente' },
  { cmd: 'dedupe', label: 'Remover Linhas Duplicadas', group: 'Linhas', alt: 'repetidas únicas' },
  { cmd: 'removeEmpty', label: 'Remover Linhas Vazias', group: 'Linhas', alt: 'em branco' },
  { cmd: 'trimBoth', label: 'Remover Espaços no Início e no Fim', group: 'Linhas', alt: 'trim' },
  { cmd: 'trim', label: 'Remover Espaços no Fim', group: 'Linhas', alt: 'trim' },
  { cmd: 'prefix', label: 'Adicionar Prefixo…', group: 'Linhas', alt: 'início' },
  { cmd: 'suffix', label: 'Adicionar Sufixo…', group: 'Linhas', alt: 'fim' },
  { cmd: 'upper', label: 'MAIÚSCULAS', group: 'Linhas', alt: 'maiusculas caixa alta' },
  { cmd: 'lower', label: 'minúsculas', group: 'Linhas', alt: 'minusculas caixa baixa' },
  // Visualizar
  { cmd: 'wordWrap', label: 'Quebra Automática de Linha', group: 'Visualizar', keys: '⌥Z' },
  { cmd: 'minimap', label: 'Minimapa', group: 'Visualizar' },
  { cmd: 'lineNumbers', label: 'Números de Linha', group: 'Visualizar' },
  { cmd: 'whitespace', label: 'Mostrar Espaços em Branco', group: 'Visualizar' },
  { cmd: 'foldAll', label: 'Recolher Tudo', group: 'Visualizar', alt: 'dobrar' },
  { cmd: 'unfoldAll', label: 'Expandir Tudo', group: 'Visualizar', alt: 'desdobrar' },
  { cmd: 'split', label: 'Dividir Tela', group: 'Visualizar', keys: '⌘\\', alt: 'lado a lado dois arquivos' },
  { cmd: 'moveOther', label: 'Mover Aba para o Outro Lado', group: 'Visualizar' },
  { cmd: 'rotateSplit', label: 'Alternar Lado a Lado / Empilhado', group: 'Visualizar' },
  { cmd: 'zoomIn', label: 'Aumentar Zoom', group: 'Visualizar', keys: '⌘=', alt: 'fonte maior' },
  { cmd: 'zoomOut', label: 'Diminuir Zoom', group: 'Visualizar', keys: '⌘−', alt: 'fonte menor' },
  { cmd: 'zoomReset', label: 'Zoom 100%', group: 'Visualizar', keys: '⌘0' },
  { cmd: 'theme', arg: 'light', label: 'Tema Claro', group: 'Visualizar' },
  { cmd: 'theme', arg: 'dark', label: 'Tema Escuro', group: 'Visualizar' },
  { cmd: 'theme', arg: 'system', label: 'Tema do Sistema', group: 'Visualizar' },
  { cmd: 'detectLanguage', label: 'Detectar Linguagem pelo Nome do Arquivo', group: 'Linguagem' },
];

/** Minúsculas e sem acentos, para a busca não depender disso */
export function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Pontuação de um texto para a busca: todas as palavras digitadas precisam aparecer.
 * Começo de palavra vale mais que meio de palavra; o rótulo vale mais que o grupo, que vale mais que os sinônimos.
 * Retorna -1 quando não combina.
 */
export function score(query: string, label: string, extra = '', group = ''): number {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const l = norm(label);
  const x = norm(extra);
  const g = norm(group);
  let total = 0;
  for (const w of words) {
    const i = l.indexOf(w);
    if (i >= 0) {
      total += i === 0 ? 30 : /[\s(/\-–→]/.test(l[i - 1]) ? 20 : 8;
      continue;
    }
    const gi = g.indexOf(w);
    if (gi === 0 || (gi > 0 && g[gi - 1] === ' ')) { total += 12; continue; } // nome do grupo ("linguagem", "aba")
    if (x.includes(w)) { total += 4; continue; }
    // iniciais: "rld" → "Remover Linhas Duplicadas"
    const initials = l.split(/[\s/]+/).map((p) => p[0] ?? '').join('');
    if (w.length >= 2 && initials.includes(w)) { total += 6; continue; }
    return -1;
  }
  return total - l.length / 100; // empate: o mais curto primeiro
}
