// Preferências guardadas no navegador interno (localStorage).
// A cópia de testes (PENAPAD_DEBUG) usa chaves próprias: o armazenamento é o mesmo do app instalado,
// e sem isso os testes mudavam as preferências de quem usa o app.
let prefix = 'penapad.';

export function setTestStorage(on: boolean) {
  prefix = on ? 'penapad-test.' : 'penapad.';
}

export function storeGet(name: string): string | null {
  try { return localStorage.getItem(prefix + name); } catch { return null; }
}

export function storeSet(name: string, value: string) {
  try { localStorage.setItem(prefix + name, value); } catch { /* sem armazenamento: só não lembra */ }
}
