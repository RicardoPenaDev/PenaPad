import { describe, expect, it } from 'vitest';
import { parseSession, planRestore } from '../src/session';

const tab = (id: string, extra: Record<string, unknown> = {}) => ({
  id, name: `${id}.txt`, path: null, language: 'plaintext', encoding: 'utf8', eol: 'LF', dirty: false, metaDirty: false, view: null, ...extra,
});

describe('parseSession', () => {
  it('aceita a sessão no formato atual', () => {
    const m = parseSession(JSON.stringify({ v: 1, active: 'a', tabs: [tab('a')] }));
    expect(m?.tabs).toHaveLength(1);
  });
  it('recusa texto estragado, vazio ou de outro formato sem lançar erro', () => {
    expect(parseSession(null)).toBeNull();
    expect(parseSession('')).toBeNull();
    expect(parseSession('{"v":1,"tabs":[')).toBeNull();
    expect(parseSession('{"v":2,"tabs":[]}')).toBeNull();
    expect(parseSession('{"v":1}')).toBeNull();
    expect(parseSession('[]')).toBeNull();
  });
  it('descarta só as entradas sem id ou nome', () => {
    const m = parseSession(JSON.stringify({ v: 1, active: 'a', tabs: [tab('a'), { name: 'x' }, null] }));
    expect(m?.tabs.map((t) => t.id)).toEqual(['a']);
  });
});

describe('planRestore', () => {
  it('liga cada aba ao seu backup e relê do disco os arquivos sem alterações', () => {
    const meta = parseSession(JSON.stringify({ v: 1, active: 'a', tabs: [tab('a'), tab('f', { path: '/x/f.txt' }), tab('g', { path: '/x/g.txt', dirty: true })] }));
    const p = planRestore(meta, { a: 'rascunho', g: 'alterado' });
    expect(p.tabs.map((t) => t.backup)).toEqual(['rascunho', undefined, 'alterado']);
    expect(p.toRead).toEqual(['/x/f.txt']);
    expect(p.orphans).toEqual([]);
  });
  it('sem lista de abas, todo backup volta como aba recuperada', () => {
    const p = planRestore(null, { b: 'dois', a: 'um', vazio: '' });
    expect(p.tabs).toEqual([]);
    expect(p.orphans).toEqual([{ id: 'a', text: 'um' }, { id: 'b', text: 'dois' }]);
  });
  it('backup que a lista não menciona (gravação interrompida) também volta', () => {
    const meta = parseSession(JSON.stringify({ v: 1, active: 'a', tabs: [tab('a')] }));
    const p = planRestore(meta, { a: 'x', novo: 'digitado antes de travar' });
    expect(p.orphans).toEqual([{ id: 'novo', text: 'digitado antes de travar' }]);
  });
});
