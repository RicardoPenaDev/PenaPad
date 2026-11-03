import { backend, cmd, debug, expect, openApp, test } from './fixtures';

test('Sobre: versão, links e fechar com Esc', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Sobre o PenaPad' }).click();
  const dlg = page.getByRole('dialog', { name: 'Sobre o PenaPad' });
  await expect(dlg).toContainText('Versão 1.2.1');
  await expect(dlg.getByText(/Pague um café/)).toHaveCount(0); // sem link de apoio configurado, sem botão
  await dlg.getByRole('button', { name: /Código-fonte no GitHub/ }).click();
  await dlg.getByRole('button', { name: /Relatar um problema/ }).click();
  await dlg.getByRole('button', { name: /Novidades/ }).click();
  await expect.poll(async () => (await backend<{ opened: string[] }>(page)).opened).toEqual(['site', 'issues', 'releases:1.2.1']);
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  await expect.poll(async () => (await debug(page)).about).toBe(false);
});

test('Sobre: botão de apoio aparece quando o link existe', async ({ page }) => {
  await openApp(page, { donate: true });
  await cmd(page, 'about');
  await page.getByRole('button', { name: /Pague um café/ }).click();
  await expect.poll(async () => (await backend<{ opened: string[] }>(page)).opened).toEqual(['donate']);
});
