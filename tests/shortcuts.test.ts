import { describe, expect, it } from 'vitest';
import { shortcutFor, type KeyLike } from '../src/shortcuts';

const k = (spec: string, key?: string): KeyLike => {
  const parts = spec.split('+');
  const last = parts.pop()!;
  const code = key ? last : /^[a-z]$/i.test(last) ? `Key${last.toUpperCase()}` : last;
  return {
    key: key ?? (/^[a-z]$/i.test(last) ? last.toLowerCase() : last),
    code,
    ctrlKey: parts.includes('Ctrl'),
    shiftKey: parts.includes('Shift'),
    altKey: parts.includes('Alt'),
    metaKey: parts.includes('Cmd'),
  };
};
const mac = { isMac: true, editorFocused: true, findClosable: false };
const win = { isMac: false, editorFocused: true, findClosable: false };

describe('atalhos no Mac', () => {
  it.each([
    ['Cmd+S', 'save'], ['Cmd+Shift+S', 'saveAs'], ['Cmd+Shift+P', 'palette'], ['Cmd+Alt+F', 'replace'],
    ['Cmd+G', 'findNext'], ['Cmd+Shift+G', 'findPrev'], ['Ctrl+G', 'gotoLine'], ['Cmd+Shift+T', 'reopenClosed'],
    ['Alt+Z', 'wordWrap'], ['Cmd+D', 'addNextOccurrence'],
  ])('%s → %s', (spec, cmd) => expect(shortcutFor(k(spec), mac)).toBe(cmd));
  it('Ctrl+S não salva no Mac (é ⌘S)', () => expect(shortcutFor(k('Ctrl+S'), mac)).toBeNull());
  it('não bloqueia atalhos do navegador no Mac', () => expect(shortcutFor(k('Cmd+R'), mac)).toBeNull());
});

describe('atalhos no Windows e no Linux', () => {
  it.each([
    ['Ctrl+S', 'save'], ['Ctrl+Shift+P', 'palette'], ['Ctrl+H', 'replace'], ['Ctrl+G', 'gotoLine'],
    ['Ctrl+Q', 'quit'], ['Ctrl+Shift+H', 'history'], ['Ctrl+N', 'new'],
  ])('%s → %s', (spec, cmd) => expect(shortcutFor(k(spec), win)).toBe(cmd));
  it('F3 / Shift+F3', () => {
    expect(shortcutFor(k('F3', 'F3'), win)).toBe('findNext');
    expect(shortcutFor(k('Shift+F3', 'F3'), win)).toBe('findPrev');
  });
  it('F11 = tela cheia', () => expect(shortcutFor(k('F11', 'F11'), win)).toBe('fullscreen'));
  it('AltGr (Ctrl+Alt) não dispara comandos: no teclado ABNT, AltGr+Q = "/"', () => {
    expect(shortcutFor({ ...k('Ctrl+Alt+Slash', '/'), code: 'KeyQ' }, win)).toBeNull();
  });
  it('bloqueia recarregar e imprimir do navegador embutido', () => {
    expect(shortcutFor(k('F5', 'F5'), win)).toBe('block');
    expect(shortcutFor(k('Ctrl+R'), win)).toBe('block');
    expect(shortcutFor(k('Ctrl+Shift+R'), win)).toBe('block');
    expect(shortcutFor(k('Ctrl+P'), win)).toBe('block');
  });
  it('Ctrl+Shift+P continua sendo a paleta (não o "imprimir")', () => expect(shortcutFor(k('Ctrl+Shift+P'), win)).toBe('palette'));
  it('Ctrl+D fora do editor fica com o campo de texto', () => expect(shortcutFor(k('Ctrl+D'), { ...win, editorFocused: false })).toBeNull());
});

it('Esc fecha a busca só quando nada está por cima', () => {
  expect(shortcutFor(k('Escape', 'Escape'), { ...mac, findClosable: true })).toBe('closeFind');
  expect(shortcutFor(k('Escape', 'Escape'), mac)).toBeNull();
});
