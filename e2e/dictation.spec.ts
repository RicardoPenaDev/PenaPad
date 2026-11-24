import { activeText, backend, cmd, debug, emit, expect, openApp, test, typeInEditor } from './fixtures';
import type { Page } from '@playwright/test';

async function recording(page: Page) {
  await page.getByRole('button', { name: 'Iniciar ditado', exact: true }).click();
  await expect.poll(async () => (await backend<{ calls: { cmd: string; args: { token: number; language: string } }[] }>(page)).calls.filter((c) => c.cmd === 'dictation_start').length).toBeGreaterThan(0);
  const calls = (await backend<{ calls: { cmd: string; args: { token: number; language: string } }[] }>(page)).calls;
  return calls.filter((c) => c.cmd === 'dictation_start').at(-1)!.args;
}

test('ditado PT-BR: prévia substitui parciais, insere na seleção e desfaz', async ({ page }) => {
  await openApp(page);
  await typeInEditor(page, 'Texto anterior');
  await cmd(page, 'selectAll');
  await cmd(page, 'dictation');
  const dlg = page.getByRole('dialog', { name: 'Ditado', exact: true });
  await expect(dlg).toBeVisible();
  const { token, language } = await recording(page);
  expect(language).toBe('pt-BR');
  await emit(page, 'dictation', { token, kind: 'listening', text: '' });
  await emit(page, 'dictation', { token, kind: 'transcript', text: 'Olá' });
  await emit(page, 'dictation', { token, kind: 'transcript', text: 'Olá, mundo.' });
  await expect(dlg.getByRole('textbox')).toHaveValue('Olá, mundo.');
  await expect(dlg.getByRole('button', { name: 'Inserir texto' })).toBeDisabled();
  expect(await activeText(page)).toBe('Texto anterior');
  await dlg.getByRole('button', { name: 'Parar ditado' }).click();
  await emit(page, 'dictation', { token, kind: 'transcript', text: 'Olá, mundo!' });
  await emit(page, 'dictation', { token, kind: 'stopped', text: '' });
  await dlg.getByRole('button', { name: 'Inserir texto' }).click();
  await expect(dlg).toHaveCount(0);
  await expect.poll(() => activeText(page)).toBe('Olá, mundo!');
  await cmd(page, 'undo');
  await expect.poll(() => activeText(page)).toBe('Texto anterior');
  await cmd(page, 'redo');
  await expect.poll(() => activeText(page)).toBe('Olá, mundo!');
});

test('inglês, permissão negada, reinício e cancelamento ignoram eventos antigos', async ({ page }) => {
  await openApp(page);
  await cmd(page, 'dictation');
  const dlg = page.getByRole('dialog', { name: 'Ditado', exact: true });
  await dlg.getByRole('combobox').selectOption('en-US');
  const first = await recording(page);
  expect(first.language).toBe('en-US');
  await emit(page, 'dictation', { token: first.token, kind: 'error', text: 'mic-permission' });
  await emit(page, 'dictation', { token: first.token, kind: 'stopped', text: '' });
  await expect(dlg.getByRole('alert')).toContainText('Permita o microfone');
  const second = await recording(page);
  await emit(page, 'dictation', { token: first.token, kind: 'transcript', text: 'stale' });
  await expect(dlg.getByRole('textbox')).toHaveValue('');
  await emit(page, 'dictation', { token: second.token, kind: 'transcript', text: 'Hello, world.' });
  await expect(dlg.getByRole('textbox')).toHaveValue('Hello, world.');
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  await expect.poll(async () => (await backend<{ calls: { cmd: string; args: unknown }[] }>(page)).calls.some((c) => c.cmd === 'dictation_stop' && (c.args as { token: number; cancel: boolean }).token === second.token && (c.args as { cancel: boolean }).cancel)).toBe(true);
  expect(await activeText(page)).toBe('');
  await cmd(page, 'dictation');
  await expect(dlg.getByRole('combobox')).toHaveValue('en-US');
  await expect(dlg.getByRole('textbox')).toHaveValue('');
});

test('documento alterado não é sobrescrito pelo ditado', async ({ page }) => {
  await openApp(page);
  await typeInEditor(page, 'Original');
  await cmd(page, 'dictation');
  const dlg = page.getByRole('dialog', { name: 'Ditado', exact: true });
  const { token } = await recording(page);
  await emit(page, 'dictation', { token, kind: 'transcript', text: 'Ditado' });
  await emit(page, 'dictation', { token, kind: 'stopped', text: '' });
  // Native menu commands can still change a document while the dialog is open.
  await cmd(page, 'upper');
  await expect.poll(() => activeText(page)).toBe('ORIGINAL');
  await dlg.getByRole('button', { name: 'Inserir texto' }).click();
  await expect(dlg.getByRole('alert')).toContainText('O documento mudou');
  expect(await activeText(page)).toBe('ORIGINAL');
  await expect(dlg.getByRole('textbox')).toHaveValue('Ditado');
});

test('plataforma sem suporte mostra a limitação e desabilita gravação', async ({ page }) => {
  await openApp(page, { dictationAvailable: false });
  await page.getByRole('button', { name: 'Ditado', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: 'Ditado', exact: true });
  await expect(dlg.getByRole('status')).toContainText('somente no macOS');
  await expect(dlg.getByRole('button', { name: 'Iniciar ditado', exact: true })).toBeDisabled();
});

test('ditado desativado no macOS orienta onde habilitar', async ({ page }) => {
  await openApp(page);
  await cmd(page, 'dictation');
  const dlg = page.getByRole('dialog', { name: 'Ditado', exact: true });
  const { token } = await recording(page);
  await emit(page, 'dictation', { token, kind: 'error', text: 'speech-disabled' });
  await emit(page, 'dictation', { token, kind: 'stopped', text: '' });
  await expect(dlg.getByRole('alert')).toContainText('Ative o Ditado em Ajustes do Sistema → Teclado');
  await expect(dlg.getByRole('button', { name: 'Iniciar ditado', exact: true })).toBeEnabled();
});

test('falha do comando nativo preserva o diagnóstico e permite tentar novamente', async ({ page }) => {
  await openApp(page, { dictationStartError: 'simulated IPC error' });
  await cmd(page, 'dictation');
  const dlg = page.getByRole('dialog', { name: 'Ditado', exact: true });
  await recording(page);
  await expect(dlg.getByRole('alert')).toBeVisible();
  await dlg.getByText('Detalhes do erro', { exact: true }).click();
  await expect(dlg.locator('pre')).toHaveText('simulated IPC error');
  await expect(dlg.getByRole('button', { name: 'Iniciar ditado', exact: true })).toBeEnabled();
});
