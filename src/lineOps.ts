// Operações sobre linhas. Funções puras: recebem as linhas e devolvem o resultado + uma mensagem.

export type LineOp = 'sortAsc' | 'sortDesc' | 'dedupe' | 'removeEmpty' | 'trimBoth' | 'trim' | 'prefix' | 'suffix';

export interface LineOpResult {
  lines: string[];
  message: string;
}

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

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
      return { lines: out, message: n ? `${plural(n, 'linha duplicada removida', 'linhas duplicadas removidas')}` : 'Nenhuma linha duplicada' };
    }
    case 'removeEmpty': {
      const out = lines.filter((l) => l.trim() !== '');
      const n = lines.length - out.length;
      return { lines: out, message: n ? `${plural(n, 'linha vazia removida', 'linhas vazias removidas')}` : 'Nenhuma linha vazia' };
    }
    case 'trimBoth':
    case 'trim': {
      let n = 0;
      const out = lines.map((l) => {
        const t = op === 'trim' ? l.replace(/\s+$/, '') : l.trim();
        if (t !== l) n++;
        return t;
      });
      return { lines: out, message: n ? `Espaços removidos em ${plural(n, 'linha', 'linhas')}` : 'Nenhum espaço sobrando' };
    }
    case 'prefix':
      return { lines: lines.map((l) => arg + l), message: `Prefixo adicionado em ${plural(lines.length, 'linha', 'linhas')}` };
    case 'suffix':
      return { lines: lines.map((l) => l + arg), message: `Sufixo adicionado em ${plural(lines.length, 'linha', 'linhas')}` };
  }
}
