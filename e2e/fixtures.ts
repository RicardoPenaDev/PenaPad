import { test as base, expect, type Page } from '@playwright/test';

export type Init = Record<string, unknown>;

export interface DebugTab { id: string; name: string; path: string | null; pane: number; dirty: boolean; language: string; text: string }
export interface Debug { tabs: DebugTab[]; actives: [string, string]; split: boolean; palette: boolean; modal: string | null; message: string; [k: string]: unknown }

/** Abre o app no navegador com um estado inicial (arquivos, sessão gravada…) */
export async function openApp(page: Page, init: Init = {}) {
  await page.addInitScript((i) => { (window as unknown as { __ppInit: unknown }).__ppInit = i; }, init);
  await page.goto('/e2e/index.html');
  await page.locator('.monaco-editor').first().waitFor();
  await expect.poll(() => debug(page).then((d) => d?.tabs?.length ?? 0)).toBeGreaterThan(0);
}

/** Estado da interface (o mesmo debug.json do app real, atualizado a cada 0,3 s) */
export const debug = (page: Page) => page.evaluate(() => (window as unknown as { __pp: { state: { debug: Debug } } }).__pp.state.debug);
export const backend = <T = Record<string, unknown>>(page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __pp: { state: Record<string, unknown> } }).__pp.state;
    return JSON.parse(JSON.stringify({ ...s, files: Object.fromEntries(s.files as Map<string, string>), history: undefined })) as unknown;
  }) as Promise<T>;
export const cmd = (page: Page, c: string) => page.evaluate((x) => (window as unknown as { __pp: { cmd: (c: string) => void } }).__pp.cmd(x), c);
export const emit = (page: Page, event: string, payload?: unknown) =>
  page.evaluate(([e, p]) => (window as unknown as { __pp: { emit: (e: string, p?: unknown) => Promise<void> } }).__pp.emit(e as string, p), [event, payload] as const);

/** Texto da aba ativa na vista principal */
export async function activeText(page: Page) {
  const d = await debug(page);
  return d.tabs.find((t) => t.id === d.actives[0])?.text;
}

export async function typeInEditor(page: Page, text: string) {
  await page.locator('.monaco-editor .view-lines').first().click();
  await page.keyboard.type(text);
}

export const test = base;
export { expect };
