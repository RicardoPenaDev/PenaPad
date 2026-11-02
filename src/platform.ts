// Diferenças entre macOS, Windows e Linux: tecla de comando e como os atalhos aparecem na tela.

export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Atalhos que mudam de tecla fora do Mac (padrão do Windows/Notepad++), escritos no formato do Mac */
const REMAP: Record<string, string> = {
  '⌥⌘F': 'Ctrl+H',
  '⌘G': 'F3',
  '⇧⌘G': 'Shift+F3',
  '⇧⌘Z': 'Ctrl+Y',
  '⌥⌘C': 'Alt+C',
  '⌥⌘W': 'Alt+W',
  '⌥⌘R': 'Alt+R',
};

const NAMES: Record<string, string> = { '⌃': 'Ctrl', '⌘': 'Ctrl', '⌥': 'Alt', '⇧': 'Shift' };
const KEYS: Record<string, string> = { '↩': 'Enter', '−': '-' };

/** "⇧⌘S" → "Ctrl+Shift+S" no Windows/Linux; no Mac fica igual */
export function keys(mac: string): string {
  if (IS_MAC) return mac;
  if (REMAP[mac]) return REMAP[mac];
  const m = /^([⌃⌥⇧⌘]+)(.*)$/.exec(mac);
  if (!m) return mac;
  const mods = new Set([...m[1]].map((c) => NAMES[c]));
  const order = ['Ctrl', 'Shift', 'Alt'].filter((x) => mods.has(x));
  const key = KEYS[m[2]] ?? m[2];
  return [...order, key].join('+');
}

/** Troca os atalhos dentro de um texto ("Salvar (⌘S)", "⌘ + clique") pelo formato do sistema */
export function kt(text: string): string {
  if (IS_MAC) return text;
  return text
    .replace(/([⌃⌥⇧⌘]+) \+ /g, (_, mods: string) => `${keys(mods + 'X').replace(/\+X$/, '')} + `)
    .replace(/[⌃⌥⇧⌘]+[^\s)⌃⌥⇧⌘]?/g, (s) => keys(s));
}
