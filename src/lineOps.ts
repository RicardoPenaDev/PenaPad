// Operações sobre linhas. Funções puras: recebem as linhas e devolvem o resultado + uma mensagem.
import { t } from './i18n';

export type LineOp = 'sortAsc' | 'sortDesc' | 'dedupe' | 'removeEmpty' | 'trimBoth' | 'trim' | 'prefix' | 'suffix';

export interface LineOpResult {
  lines: string[];
  message: string;
}

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
const plural = (n: number, um: string, varios: string) => `${n} ${t(n === 1 ? um : varios)}`;

export function applyLineOp(op: LineOp, lines: string[], arg = ''): LineOpResult {
  switch (op) {
    case 'sortAsc':
    case 'sortDesc': {
      const sorted = [...lines].sort((a, b) => collator.compare(a, b));
      if (op === 'sortDesc') sorted.reverse();
      return { lines: sorted, message: `${plural(lines.length, 'linha ordenada', 'linhas ordenadas')}` };
    }
    case 'dedupe': {
      const seen = new Set<string>();
      const out = lines.filter((l) => (seen.has(l) ? false : (seen.add(l), true)));
      const n = lines.length - out.length;
      return { lines: out, message: n ? `${plural(n, 'linha duplicada removida', 'linhas duplicadas removidas')}` : t('Nenhuma linha duplicada') };
    }
    case 'removeEmpty': {
      const out = lines.filter((l) => l.trim() !== '');
      const n = lines.length - out.length;
      return { lines: out, message: n ? `${plural(n, 'linha vazia removida', 'linhas vazias removidas')}` : t('Nenhuma linha vazia') };
    }
    case 'trimBoth':
    case 'trim': {
      let n = 0;
      const out = lines.map((l) => {
        const t = op === 'trim' ? l.replace(/\s+$/, '') : l.trim();
        if (t !== l) n++;
        return t;
      });
      return { lines: out, message: n ? t('Espaços removidos em {lines}', { lines: plural(n, 'linha', 'linhas') }) : t('Nenhum espaço sobrando') };
    }
    case 'prefix':
      return { lines: lines.map((l) => arg + l), message: t('Prefixo adicionado em {lines}', { lines: plural(lines.length, 'linha', 'linhas') }) };
    case 'suffix':
      return { lines: lines.map((l) => l + arg), message: t('Sufixo adicionado em {lines}', { lines: plural(lines.length, 'linha', 'linhas') }) };
  }
}
