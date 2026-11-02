import { describe, expect, it } from 'vitest';
import { applyLineOp } from '../src/lineOps';

describe('operações de linha', () => {
  it('ordena números na ordem natural', () => expect(applyLineOp('sortAsc', ['item 10', 'item 2', 'item 1']).lines).toEqual(['item 1', 'item 2', 'item 10']));
  it('remove duplicadas mantendo a primeira', () => expect(applyLineOp('dedupe', ['a', 'b', 'a', 'c', 'b']).lines).toEqual(['a', 'b', 'c']));
  it('remove vazias (inclusive só com espaços)', () => expect(applyLineOp('removeEmpty', ['a', '', '  ', 'b']).lines).toEqual(['a', 'b']));
  it('limpa espaços do fim', () => expect(applyLineOp('trim', ['a  ', '  b ']).lines).toEqual(['a', '  b']));
  it('prefixo e sufixo', () => {
    expect(applyLineOp('prefix', ['a', 'b'], '- ').lines).toEqual(['- a', '- b']);
    expect(applyLineOp('suffix', ['a', 'b'], ';').lines).toEqual(['a;', 'b;']);
  });
});
