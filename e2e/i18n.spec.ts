import { activeText, cmd, debug, expect, openApp, test, typeInEditor } from './fixtures';

test.describe('sistema em inglês', () => {
  test.use({ locale: 'en-US' });

  test('abre em inglês: faixa de opções, abas, barra de status e paleta', async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole('button', { name: 'Home', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    expect((await debug(page)).tabs[0].name).toBe('Untitled 1');
    await expect(page.getByText(/Line: 1, Column: 1/)).toBeVisible();
    await typeInEditor(page, 'hello');
    await page.keyboard.press('ControlOrMeta+Shift+P');
    await page.getByPlaceholder(/Type the name of a command/).fill('upper');
    await expect(page.getByText('UPPERCASE', { exact: true })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect.poll(() => activeText(page)).toBe('HELLO');
  });

  test('a busca da paleta também acha pelo nome em português', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('ControlOrMeta+Shift+P');
    await page.getByPlaceholder(/Type the name of a command/).fill('duplicadas');
    await expect(page.getByText('Remove Duplicate Lines', { exact: true })).toBeVisible();
  });

  test('trocar para português recarrega a interface sem perder o texto', async ({ page }) => {
    await openApp(page);
    await typeInEditor(page, 'não pode sumir');
    await cmd(page, 'uiLang pt');
    await expect(page.getByRole('button', { name: 'Início', exact: true })).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () => (await debug(page))?.tabs?.map((t) => t.text)).toEqual(['não pode sumir']);
    expect((await debug(page)).tabs[0].name).toBe('Sem título 1'); // aba sem arquivo acompanha o idioma
  });
});

test('sistema em português abre em português', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('button', { name: 'Início', exact: true })).toBeVisible();
  expect((await debug(page)).tabs[0].name).toBe('Sem título 1');
});
