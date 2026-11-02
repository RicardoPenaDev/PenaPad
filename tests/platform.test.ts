import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(platform: string) {
  vi.resetModules();
  vi.stubGlobal('navigator', { platform, userAgent: '' });
  return import('../src/platform');
}
afterEach(() => vi.unstubAllGlobals());

describe('atalhos no Windows/Linux', () => {
  it('troca ⌘ por Ctrl e segue o padrão do Windows', async () => {
    const { keys, kt, IS_MAC } = await load('Win32');
    expect(IS_MAC).toBe(false);
    expect(keys('⇧⌘P')).toBe('Ctrl+Shift+P');
    expect(keys('⌥⌘F')).toBe('Ctrl+H');
    expect(keys('⌘G')).toBe('F3');
    expect(keys('⇧⌘Z')).toBe('Ctrl+Y');
    expect(keys('⇧⌥↓')).toBe('Shift+Alt+↓');
    expect(keys('⌃G')).toBe('Ctrl+G');
    expect(kt('Salvar Como (⇧⌘S)')).toBe('Salvar Como (Ctrl+Shift+S)');
    expect(kt('Dica: ⌘ + clique')).toBe('Dica: Ctrl + clique');
    expect(kt('(⌘Z desfaz)')).toBe('(Ctrl+Z desfaz)');
    expect(kt('Substituir Tudo (⌘↩)')).toBe('Substituir Tudo (Ctrl+Enter)');
  });
  it('no Mac nada muda', async () => {
    const { keys, kt } = await load('MacIntel');
    expect(keys('⇧⌘P')).toBe('⇧⌘P');
    expect(kt('Salvar (⌘S)')).toBe('Salvar (⌘S)');
  });
});
