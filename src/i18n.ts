// Idioma da interface: português ou inglês. Os textos ficam escritos em português no código;
// `t()` devolve a tradução do dicionário (src/locales/en.ts) quando o idioma é inglês.
// Variáveis: t('Abrir "{name}"', { name }) — o mesmo {name} aparece na tradução.

import { EN } from './locales/en';
import { storeGet, storeSet } from './storage';

export type Lang = 'pt' | 'en';
export type LangPref = 'auto' | Lang;

let lang: Lang = 'pt';
const missing = new Set<string>();

export function systemLang(): Lang {
  const l = (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || 'pt';
  return l.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export function langPref(): LangPref {
  const p = storeGet('language');
  return p === 'pt' || p === 'en' ? p : 'auto';
}

export function setLangPref(p: LangPref) {
  storeSet('language', p);
}

export const resolveLang = (p: LangPref): Lang => (p === 'auto' ? systemLang() : p);

/** Define o idioma em uso (chamado uma vez ao iniciar) */
export function initLang(l: Lang = resolveLang(langPref())) {
  lang = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l === 'pt' ? 'pt-BR' : 'en';
}

export const getLang = () => lang;
/** Locale para datas e números */
export const locale = () => (lang === 'pt' ? 'pt-BR' : 'en-US');

export function t(pt: string, vars?: Record<string, string | number>): string {
  let s = pt;
  if (lang === 'en') {
    const tr = EN[pt];
    if (tr !== undefined) s = tr;
    else if (!missing.has(pt)) {
      missing.add(pt);
      if (import.meta.env?.DEV) console.warn('[i18n] sem tradução:', pt);
    }
  }
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  return s;
}

/** Textos sem tradução encontrados até agora (usado nos testes) */
export const missingTranslations = () => [...missing];

/** Número no formato do idioma (1.234 / 1,234) */
export const num = (n: number) => n.toLocaleString(locale());
/** Singular ou plural, já traduzido */
export const plural = (n: number, one: string, many: string) => t(n === 1 ? one : many);
