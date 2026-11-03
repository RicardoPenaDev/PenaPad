import { getLang } from './i18n';

// Mensagens do validador de JSON (em inglês) → português
export const JSON_MSGS: [RegExp, string][] = [
  [/^Expected comma or closing bracket/i, 'falta uma vírgula ou o colchete de fechamento ( ] )'],
  [/^Expected comma or closing brace/i, 'falta uma vírgula ou a chave de fechamento ( } )'],
  [/^Expected comma/i, 'falta uma vírgula'],
  [/^Colon expected/i, 'falta o dois-pontos ( : ) depois da chave'],
  [/^Value expected/i, 'falta um valor'],
  [/^Property expected/i, 'falta uma propriedade'],
  [/^Property keys must be doublequoted/i, 'as chaves precisam estar entre aspas duplas'],
  [/^Trailing comma/i, 'vírgula sobrando antes do fechamento'],
  [/^End of file expected/i, 'há conteúdo depois do fim do JSON'],
  [/^Comments are not permitted/i, 'comentários não são permitidos em JSON'],
  [/^(Unexpected end of string|Unterminated string)/i, 'texto (string) sem as aspas de fechamento'],
  [/^Closing bracket expected/i, 'falta o colchete de fechamento ( ] )'],
  [/^Closing brace expected/i, 'falta a chave de fechamento ( } )'],
  [/^Duplicate object key/i, 'chave repetida no mesmo objeto'],
  [/^Invalid number format/i, 'número em formato inválido'],
  [/^Invalid escape character/i, 'caractere de escape ( \\ ) inválido no texto'],
  [/^Invalid unicode sequence/i, 'sequência unicode ( \\u ) inválida'],
  [/^Invalid characters in string/i, 'caractere de controle (ex.: TAB ou quebra de linha) dentro do texto; use \\t ou \\n'],
  [/^Invalid symbol/i, 'símbolo inválido'],
  [/^Incorrect type/i, 'tipo incorreto'],
];
export const translateProblem = (msg: string) => (getLang() === 'en' ? msg : JSON_MSGS.find(([re]) => re.test(msg))?.[1] ?? msg);

