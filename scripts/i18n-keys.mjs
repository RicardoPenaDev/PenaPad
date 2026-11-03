// Lista os textos da interface que precisam de tradução (argumentos literais de t/tr/kt/plural,
// rótulos dos comandos e os textos fixos marcados nas listas). Usado pelo teste tests/i18n.test.ts.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const files = [];
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) { if (e.name !== 'locales') walk(join(d, e.name)); }
    else if (/\.(ts|tsx)$/.test(e.name) && e.name !== 'i18n.ts') files.push(join(d, e.name));
  }
};
walk(join(root, 'src'));

const str = String.raw`'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"`;
/** Texto da i-ésima string capturada (cada string tem dois grupos: aspas simples ou duplas) */
const q = (m, i = 0) => (m[1 + 2 * i] ?? m[2 + 2 * i]).replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n');

export function i18nKeys() {
  const keys = new Set();
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    // t('…'), tr('…'), kt('…')
    for (const m of src.matchAll(new RegExp(String.raw`\b(?:t|tr|kt)\(\s*(?:${str})`, 'g'))) keys.add(q(m));
    // tr(cond ? '…' : '…'), t(cond ? '…' : '…')
    for (const m of src.matchAll(new RegExp(String.raw`\b(?:t|tr|kt)\([^;\n]*?\?\s*(?:${str})\s*:\s*(?:${str})\s*[,)]`, 'g'))) {
      keys.add(q(m)); keys.add(q(m, 1));
    }
    // tr(a ? (b ? '…' : '…') : (b ? '…' : '…'))
    if (/i18n-nested/.test(src) || f.endsWith('App.tsx')) {
      for (const m of src.matchAll(/tr\((?:[^;]*?)\);/g)) for (const x of m[0].matchAll(new RegExp(str, 'g'))) if (/[A-Za-zÀ-ú]{3,}/.test(q(x)) && /[→↓←↑]/.test(q(x))) keys.add(q(x));
    }
    // plural(n, '…', '…')
    for (const m of src.matchAll(new RegExp(String.raw`\bplural\([^,]+,\s*(?:${str})\s*,\s*(?:${str})`, 'g'))) {
      keys.add(q(m)); keys.add(q(m, 1));
    }
    // Listas marcadas: label: '…', group: '…' (commands.ts, Ribbon TABS/QUICK_LANGS) e REASONS
    if (/commands\.ts$|Ribbon\.tsx$|historyFormat\.ts$/.test(f)) {
      for (const m of src.matchAll(new RegExp(String.raw`\b(?:label|group):\s*(?:${str})`, 'g'))) keys.add(q(m));
      if (f.endsWith('historyFormat.ts')) for (const m of src.matchAll(new RegExp(String.raw`^\s+\w+:\s*(?:${str}),$`, 'gm'))) keys.add(q(m));
    }
  }
  // Nomes próprios / técnicos que não se traduzem
  for (const k of [...keys]) if (/^(JavaScript|TypeScript|Python|HTML|CSS|JSON|SQL|Markdown|Shell|PenaPad|MAIÚSCULAS|minúsculas)$/.test(k) || !/[A-Za-zÀ-ú]/.test(k)) keys.delete(k);
  keys.add('MAIÚSCULAS'); keys.add('minúsculas');
  return [...keys].sort();
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) console.log(i18nKeys().join('\n'));
