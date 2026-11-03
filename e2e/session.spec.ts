import { activeText, backend, debug, emit, expect, openApp, test, typeInEditor } from './fixtures';

const meta = (tabs: object[], extra: object = {}) =>
  JSON.stringify({ v: 1, active: (tabs[0] as { id: string }).id, actives: [(tabs[0] as { id: string }).id, ''], tabs, ...extra });
const tab = (id: string, extra: object = {}) => ({ id, name: 'Sem título 1', path: null, language: 'plaintext', encoding: 'utf8', eol: 'LF', dirty: false, metaDirty: false, view: null, pane: 0, ...extra });

test('o que é digitado vai para o backup da sessão', async ({ page }) => {
  await openApp(page);
  await typeInEditor(page, 'rascunho importante');
  await expect.poll(async () => Object.values((await backend<{ session: { backups: Record<string, string> } }>(page)).session.backups)).toEqual(['rascunho importante']);
});

test('restaura abas, arquivos e texto não salvo da sessão anterior', async ({ page }) => {
  await openApp(page, {
    files: { '/docs/a.txt': 'conteúdo do disco' },
    session: { meta: meta([tab('u1'), tab('f1', { name: 'a.txt', path: '/docs/a.txt' })]), backups: { u1: 'não salvo' } },
  });
  const d = await debug(page);
  expect(d.tabs.map((t) => [t.name, t.text, t.dirty])).toEqual([
    ['Sem título 1', 'não salvo', true],
    ['a.txt', 'conteúdo do disco', false],
  ]);
});

test('lista de abas perdida: os textos voltam como "Recuperado" e nada é apagado', async ({ page }) => {
  await openApp(page, { session: { meta: null, backups: { b: 'segundo', a: 'primeiro' }, problem: 'a lista de abas estava danificada' } });
  await expect.poll(async () => (await debug(page)).tabs.map((t) => [t.name, t.text])).toEqual([
    ['Recuperado 1', 'primeiro'],
    ['Recuperado 2', 'segundo'],
  ]);
  await expect(page.getByText(/2 textos voltaram como "Recuperado/)).toBeVisible();
  // As próximas gravações mantêm os dois backups
  await typeInEditor(page, '!');
  await expect.poll(async () => Object.keys((await backend<{ session: { backups: object } }>(page)).session.backups).sort()).toEqual(['a', 'b']);
});

test('fechar o app grava a sessão e sai', async ({ page }) => {
  await openApp(page);
  await typeInEditor(page, 'até amanhã');
  await emit(page, 'session-flush');
  await expect.poll(async () => (await backend<{ quit: boolean }>(page)).quit).toBe(true);
  const s = await backend<{ session: { meta: string; backups: Record<string, string> } }>(page);
  expect(Object.values(s.session.backups)).toEqual(['até amanhã']);
  expect(JSON.parse(s.session.meta).tabs).toHaveLength(1);
});

test('disco cheio: avisa e não fecha sem perguntar', async ({ page }) => {
  await openApp(page, { failSession: true });
  await typeInEditor(page, 'texto');
  await expect(page.getByText(/Não foi possível guardar os textos não salvos/)).toBeVisible();
  await emit(page, 'session-flush');
  await expect.poll(async () => (await backend<{ quitBlocked: string | null }>(page)).quitBlocked).toContain('disco está cheio');
  expect((await backend<{ quit: boolean }>(page)).quit).toBe(false);
  expect(await activeText(page)).toBe('texto');
});
