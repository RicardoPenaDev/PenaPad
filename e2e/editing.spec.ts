import { activeText, backend, cmd, debug, expect, openApp, test, typeInEditor } from './fixtures';

test('paleta de comandos: busca sem acento e executa', async ({ page }) => {
  await openApp(page);
  await typeInEditor(page, 'texto');
  await page.keyboard.press('ControlOrMeta+Shift+P');
  const input = page.getByPlaceholder(/Digite o nome de uma função/);
  await expect(input).toBeFocused();
  await input.fill('maiusculas');
  await expect(page.getByText('MAIÚSCULAS', { exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect.poll(() => activeText(page)).toBe('TEXTO');
  expect((await debug(page)).palette).toBe(false);
});

test('Substituir Tudo mostra a prévia, permite desmarcar e desfaz de uma vez', async ({ page }) => {
  await openApp(page);
  await typeInEditor(page, 'gato\ncachorro gato\npeixe\ngato');
  await cmd(page, 'replace');
  await page.getByPlaceholder('Localizar').fill('gato');
  await page.getByPlaceholder('Substituir').fill('leão');
  await page.getByPlaceholder('Substituir').press('ControlOrMeta+Enter');
  const modal = page.locator('[data-modal]');
  await expect(modal).toContainText('3 ocorrências');
  await modal.locator('input[type=checkbox]').nth(1).uncheck(); // linha 2 fica como está
  await modal.getByRole('button', { name: /Substituir 2 ocorrências/ }).click();
  await expect.poll(() => activeText(page)).toBe('leão\ncachorro gato\npeixe\nleão');
  await page.locator('.monaco-editor .view-lines').first().click();
  await page.keyboard.press('ControlOrMeta+Z');
  await expect.poll(() => activeText(page)).toBe('gato\ncachorro gato\npeixe\ngato');
});

test('operações de linha valem para o documento todo', async ({ page }) => {
  await openApp(page);
  await typeInEditor(page, 'b\na\nb\n\nc');
  await cmd(page, 'removeEmpty');
  await cmd(page, 'dedupe');
  await cmd(page, 'sortDesc');
  await expect.poll(() => activeText(page)).toBe('c\nb\na');
});

test('tela dividida: cada lado com sua aba', async ({ page }) => {
  await openApp(page);
  await typeInEditor(page, 'esquerda');
  await page.keyboard.press('ControlOrMeta+Backslash');
  await expect.poll(async () => (await debug(page)).split).toBe(true);
  await page.keyboard.type('direita');
  await expect.poll(async () => (await debug(page)).tabs.map((t) => [t.pane, t.text])).toEqual([[0, 'esquerda'], [1, 'direita']]);
});

test('abrir, editar e salvar um arquivo', async ({ page }) => {
  await openApp(page, { files: { '/p/notas.md': '# Notas\n' }, openFiles: [['/p/notas.md']] });
  await cmd(page, 'open');
  await expect.poll(async () => (await debug(page)).tabs.map((t) => t.name)).toEqual(['notas.md']); // a aba vazia é substituída
  expect((await debug(page)).tabs[0].language).toBe('markdown');
  await page.locator('.monaco-editor .view-lines').first().click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('- item');
  await expect.poll(async () => (await debug(page)).tabs[0].dirty).toBe(true);
  await page.keyboard.press('ControlOrMeta+S');
  await expect.poll(async () => (await backend<{ files: Record<string, string> }>(page)).files['/p/notas.md']).toBe('# Notas\n- item');
  await expect.poll(async () => (await debug(page)).tabs[0].dirty).toBe(false);
});

test('reabrir aba fechada traz o texto de volta', async ({ page }) => {
  await openApp(page, { confirmClose: ['discard'] });
  await typeInEditor(page, 'quase perdido');
  await page.keyboard.press('ControlOrMeta+N');
  await page.locator('[data-tab-id]').first().click();
  await cmd(page, 'close');
  await expect.poll(async () => (await debug(page)).tabs.length).toBe(1);
  await page.keyboard.press('ControlOrMeta+Shift+T');
  await expect.poll(async () => (await debug(page)).tabs.map((t) => t.text)).toContain('quase perdido');
});

test('JSON inválido aparece na barra de status', async ({ page }) => {
  await openApp(page);
  await cmd(page, 'language json');
  await typeInEditor(page, '{"a": 1,}');
  await expect(page.getByText(/Erro na linha 1/)).toBeVisible();
});
