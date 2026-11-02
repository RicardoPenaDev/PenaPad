import { describe, expect, it } from 'vitest';
import { COMMANDS, score } from '../src/commands';

const best = (q: string) =>
  COMMANDS.map((c) => ({ c, s: score(q, c.label, c.alt, c.group) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)[0]?.c.label;

describe('busca da paleta', () => {
  it('ignora acentos e maiúsculas', () => expect(best('HISTORICO')).toBe('Histórico de Versões…'));
  it('acha por sinônimo', () => expect(best('diff')).toBe('Comparar Textos…'));
  it('acha pelas iniciais', () => expect(best('rld')).toBe('Remover Linhas Duplicadas'));
  it('todas as palavras precisam combinar', () => expect(score('tema xyz', 'Tema Escuro')).toBe(-1));
  it('comandos não se repetem', () => {
    const k = COMMANDS.map((c) => `${c.cmd}:${c.arg ?? ''}`);
    expect(new Set(k).size).toBe(k.length);
  });
});
