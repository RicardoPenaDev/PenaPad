// Atalhos de teclado do app (os que o Monaco não trata sozinho). Função pura: fácil de testar nos dois padrões.

export interface KeyLike {
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export interface KeyContext {
  isMac: boolean;
  /** O foco está no editor de texto */
  editorFocused: boolean;
  /** O painel Localizar está aberto e nenhuma janela (prévia, paleta…) está por cima */
  findClosable: boolean;
}

/** Comando para a tecla; 'block' = atalho do navegador embutido que deve ser ignorado; null = deixa passar */
export function shortcutFor(e: KeyLike, ctx: KeyContext): string | 'block' | null {
  const { isMac } = ctx;
  const letter = e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
  // Tecla de comando: ⌘ no Mac, Ctrl no Windows/Linux (sem Alt, para não pegar o AltGr dos teclados brasileiros)
  const mod = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey && !e.altKey;
  const plainAlt = e.altKey && !e.metaKey && !e.ctrlKey;
  let cmd: string | null = null;

  if (!isMac && mod && letter === 'h' && !e.shiftKey) cmd = 'replace';
  else if (!isMac && mod && letter === 'g' && !e.shiftKey) cmd = 'gotoLine';
  else if (!isMac && e.key === 'F3' && !e.ctrlKey && !e.altKey && !e.metaKey) cmd = e.shiftKey ? 'findPrev' : 'findNext';
  else if (!isMac && mod && letter === 'q' && !e.shiftKey) cmd = 'quit';
  else if (!isMac && e.key === 'F11' && !e.ctrlKey && !e.altKey && !e.shiftKey) cmd = 'fullscreen';
  else if (mod) {
    if (letter === 'n' && !e.shiftKey && !e.altKey) cmd = 'new';
    else if (letter === 'o' && !e.shiftKey && !e.altKey) cmd = 'open';
    else if (letter === 's' && !e.altKey) cmd = e.shiftKey ? 'saveAs' : 'save';
    else if (letter === 'w' && !e.shiftKey && !e.altKey) cmd = 'close';
    else if (letter === 'f') cmd = e.altKey ? 'replace' : 'find';
    else if (letter === 'g' && !e.altKey && isMac) cmd = e.shiftKey ? 'findPrev' : 'findNext';
    else if (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') cmd = 'zoomIn';
    else if (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract') cmd = 'zoomOut';
    else if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') cmd = 'zoomReset';
    else if (e.key === '/' || e.code === 'Slash' || e.code === 'NumpadDivide' || e.code === 'IntlRo') cmd = 'comment';
    else if (e.code === 'Backslash' && !e.shiftKey && !e.altKey) cmd = 'split';
    else if (letter === 't' && e.shiftKey && !e.altKey) cmd = 'reopenClosed';
    else if (letter === 'h' && e.shiftKey && !e.altKey) cmd = 'history';
    else if (letter === 'p' && e.shiftKey && !e.altKey) cmd = 'palette';
    else if (letter === 'd' && !e.shiftKey && !e.altKey && ctx.editorFocused) cmd = 'addNextOccurrence';
    else if (letter === 'l' && e.shiftKey && !e.altKey && ctx.editorFocused) cmd = 'selectOccurrences';
    else if (letter === 'k' && e.shiftKey && !e.altKey && ctx.editorFocused) cmd = 'deleteLine';
  } else if (isMac && e.ctrlKey && !e.metaKey && letter === 'g') cmd = 'gotoLine';
  else if (plainAlt && e.code === 'KeyZ') cmd = 'wordWrap';
  else if (plainAlt && e.shiftKey && e.code === 'KeyF') cmd = 'format';
  else if (plainAlt && ctx.editorFocused && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    cmd = e.shiftKey ? (e.key === 'ArrowDown' ? 'duplicate' : null) : e.key === 'ArrowUp' ? 'moveUp' : 'moveDown';
  } else if (e.key === 'Escape' && ctx.findClosable) cmd = 'closeFind';

  if (cmd) return cmd;
  // Atalhos do navegador embutido (recarregar, imprimir, downloads, código-fonte) não fazem sentido num editor
  if (!isMac && (e.key === 'F5' || (mod && (letter === 'r' || (!e.shiftKey && (letter === 'p' || letter === 'j' || letter === 'u')))))) return 'block';
  return null;
}
