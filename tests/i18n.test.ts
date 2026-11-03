import { describe, expect, it } from 'vitest';
// @ts-expect-error script em JS puro
import { i18nKeys } from '../scripts/i18n-keys.mjs';
import { EN } from '../src/locales/en';

describe('tradução para o inglês', () => {
  const keys: string[] = i18nKeys();
  it('encontra os textos da interface', () => expect(keys.length).toBeGreaterThan(250));
  it('todo texto da interface tem tradução', () => {
    expect(keys.filter((k) => !(k in EN))).toEqual([]);
  });
  it('as traduções mantêm as mesmas variáveis {…} e atalhos ⌘', () => {
    const vars = (s: string) => [...s.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort().join();
    const glyphs = (s: string) => [...s].filter((c) => '⌘⇧⌥⌃'.includes(c)).sort().join('');
    const bad = Object.entries(EN).filter(([pt, en]) => vars(pt) !== vars(en) || glyphs(pt) !== glyphs(en));
    expect(bad).toEqual([]);
  });
  it('nenhuma tradução sobrando que o código não usa mais', () => {
    expect(Object.keys(EN).filter((k) => !keys.includes(k))).toEqual([]);
  });
});
