// Opções do editor Monaco e utilidades de foco
import type { monaco } from './monaco';
import type { Ed } from './appTypes';
import { BASE_FONT } from './settings';

export const EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  model: null,
  automaticLayout: true,
  fontFamily: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Monaco, 'Cascadia Mono', Consolas, 'DejaVu Sans Mono', 'Liberation Mono', 'Ubuntu Mono', monospace",
  fontSize: BASE_FONT,
  lineHeight: 1.55,
  fontLigatures: false,
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  padding: { top: 10, bottom: 10 },
  scrollBeyondLastLine: false,
  roundedSelection: true,
  renderLineHighlight: 'all',
  bracketPairColorization: { enabled: true },
  guides: { bracketPairs: 'active', indentation: true },
  stickyScroll: { enabled: false },
  dropIntoEditor: { enabled: false },
  multiCursorModifier: 'ctrlCmd', // Option+arrastar = seleção em coluna; Cmd+clique = cursor extra
  folding: true,
  showFoldingControls: 'mouseover',
  scrollbar: { verticalScrollbarSize: 11, horizontalScrollbarSize: 11, useShadows: false },
  fixedOverflowWidgets: true,
  contextmenu: false, // usamos o menu nativo do macOS
  wordBasedSuggestions: 'currentDocument',
  links: false,
  hover: { enabled: 'off' },
};

/** Executa "Formatar Documento" esperando o formatador carregar (o de JSON carrega sob demanda) */
export async function runFormat(ed: Ed): Promise<boolean> {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const a = ed.getAction('editor.action.formatDocument');
    if (a?.isSupported()) { await a.run(); return true; }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

export const editorFocused = () => !!(document.activeElement as HTMLElement | null)?.closest?.('.monaco-editor');

export const inputFocused = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT') && !el.closest('.monaco-editor');
};

