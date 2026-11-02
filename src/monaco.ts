import * as monaco from './monaco-slim';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker?worker';

// Só dois workers (e só quando necessários): o genérico do editor e o de JSON.
self.MonacoEnvironment = {
  getWorker(_id: string, label: string) {
    if (label === 'json') return new JsonWorker();
    return new EditorWorker();
  },
};

monaco.editor.defineTheme('penapad-light', {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#ffffff',
    'editorLineNumber.foreground': '#a0a0a0',
    'editorLineNumber.activeForeground': '#1f4fa3',
    'editor.lineHighlightBackground': '#f3f6fc',
    'editor.selectionBackground': '#c9d8f3',
    'editor.findMatchHighlightBackground': '#ffe58f88',
    'editorCursor.foreground': '#1f4fa3',
  },
});
monaco.editor.defineTheme('penapad-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#1e1e1e',
    'editorLineNumber.foreground': '#6e6e6e',
    'editorLineNumber.activeForeground': '#7ea6f2',
    'editor.lineHighlightBackground': '#252a33',
    'editor.selectionBackground': '#2c4470',
    'editor.findMatchHighlightBackground': '#a8801f66',
    'editorCursor.foreground': '#7ea6f2',
  },
});

export interface LangInfo { id: string; name: string }

let extMap: Map<string, string> | null = null;
let nameMap: Map<string, string> | null = null;

function buildMaps() {
  extMap = new Map();
  nameMap = new Map();
  for (const l of monaco.languages.getLanguages()) {
    for (const e of l.extensions ?? []) if (!extMap.has(e.toLowerCase())) extMap.set(e.toLowerCase(), l.id);
    for (const f of l.filenames ?? []) nameMap.set(f.toLowerCase(), l.id);
  }
  const extra: Record<string, string> = { '.yml': 'yaml', '.zsh': 'shell', '.bash': 'shell', '.h': 'cpp', '.hpp': 'cpp', '.mjs': 'javascript', '.cjs': 'javascript', '.jsonc': 'json', '.log': 'plaintext', '.conf': 'ini', '.env': 'ini' };
  for (const [k, v] of Object.entries(extra)) extMap.set(k, v);
  nameMap.set('dockerfile', 'dockerfile');
  nameMap.set('makefile', 'shell');
}

export function detectLanguage(fileName: string): string {
  if (!extMap) buildMaps();
  const lower = fileName.toLowerCase();
  if (nameMap!.has(lower)) return nameMap!.get(lower)!;
  const dot = lower.lastIndexOf('.');
  if (dot >= 0) {
    const ext = lower.slice(dot);
    if (extMap!.has(ext)) return extMap!.get(ext)!;
  }
  return 'plaintext';
}

export function allLanguages(): LangInfo[] {
  return monaco.languages
    .getLanguages()
    .map((l) => ({ id: l.id, name: l.aliases?.[0] ?? l.id }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
}

export function languageName(id: string): string {
  const l = monaco.languages.getLanguages().find((x) => x.id === id);
  return l?.aliases?.[0] ?? id;
}

export { monaco };
