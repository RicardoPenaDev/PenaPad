import { AlertTriangle, Minus, Plus } from 'lucide-react';
import type { Encoding, Eol } from '../types';
import { languageName } from '../monaco';
import { t, num } from '../i18n';

export interface StatusInfo {
  line: number;
  col: number;
  selChars: number;
  selLines: number;
  cursors: number;
  totalChars: number;
  totalLines: number;
}

export interface Problem { line: number; col: number; message: string; total: number }

export default function StatusBar({ info, eol, encoding, language, zoom, onEol, onEncoding, onZoom, message, problem, onProblem }: {
  info: StatusInfo;
  message?: string;
  problem?: Problem | null;
  onProblem?: () => void;
  eol: Eol;
  encoding: Encoding;
  language: string;
  zoom: number;
  onEol: (e: Eol) => void;
  onEncoding: (e: Encoding) => void;
  onZoom: (z: number) => void;
}) {
  const sep = <span className="h-[14px] w-px bg-[var(--border-strong)]" />;
  return (
    <div className="flex h-[26px] shrink-0 items-center gap-3 overflow-hidden border-t border-[var(--border)] bg-[var(--chrome)] px-3 text-[11.5px] whitespace-nowrap text-[var(--text-2)]">
      <span className="min-w-[40px] max-w-[340px] shrink truncate font-medium text-[var(--accent-text)]" title={message}>{message || t('Pronto')}</span>
      {problem && (
        <>
          <span className="h-[14px] w-px bg-[var(--border-strong)]" />
          <button
            onClick={onProblem}
            title={`${problem.message}\n\n${t('Clique para ir até o erro')}`}
            className="flex min-w-[60px] max-w-[460px] shrink items-center gap-1 rounded px-1 text-[var(--diff-del)] hover:bg-[var(--hover)]"
          >
            <AlertTriangle size={12} className="shrink-0" />
            <span className="truncate">
              {t('Erro na linha {l}, coluna {c}:', { l: problem.line, c: problem.col })} {problem.message}
              {problem.total > 1 ? ` (+${problem.total - 1})` : ''}
            </span>
          </button>
        </>
      )}
      {sep}
      <span>{t('Linha: {l}, Coluna: {c}', { l: info.line, c: info.col })}</span>
      {info.selChars > 0 && (
        <>
          {sep}
          <span>
            {t('Seleção: {n} caracteres', { n: num(info.selChars) })}{info.selLines > 1 ? ` (${t('{n} linhas', { n: info.selLines })})` : ''}
            {info.cursors > 1 ? ` · ${info.cursors} cursores` : ''}
          </span>
        </>
      )}
      {sep}
      <span>{t(info.totalLines === 1 ? 'Total: {c} caracteres · 1 linha' : 'Total: {c} caracteres · {l} linhas', { c: num(info.totalChars), l: num(info.totalLines) })}</span>

      <div className="flex-1" />

      <span>{languageName(language)}</span>
      {sep}
      <select title={t("Quebra de linha")} className="ui-select h-[20px]" value={eol} onChange={(e) => onEol(e.target.value as Eol)}>
        <option value="LF">LF (macOS/Linux)</option>
        <option value="CRLF">CRLF (Windows)</option>
      </select>
      {sep}
      <select title={t("Codificação ao salvar")} className="ui-select h-[20px]" value={encoding} onChange={(e) => onEncoding(e.target.value as Encoding)}>
        <option value="utf8">UTF-8</option>
        <option value="utf16le">UTF-16</option>
        <option value="ascii">ASCII</option>
      </select>
      {sep}
      <div className="flex items-center gap-1.5">
        <button title={t("Diminuir zoom")} onClick={() => onZoom(zoom - 10)} className="rounded p-0.5 hover:bg-[var(--hover)]"><Minus size={12} /></button>
        <input
          type="range"
          min={50}
          max={300}
          step={10}
          value={zoom}
          onChange={(e) => onZoom(Number(e.target.value))}
          onDoubleClick={() => onZoom(100)}
          className="zoom-range w-[110px]"
          title={t("Zoom (duplo clique: 100%)")}
        />
        <button title={t("Aumentar zoom")} onClick={() => onZoom(zoom + 10)} className="rounded p-0.5 hover:bg-[var(--hover)]"><Plus size={12} /></button>
        <button title={t("Redefinir para 100%")} onClick={() => onZoom(100)} className="w-[38px] rounded text-right hover:bg-[var(--hover)]">{zoom}%</button>
      </div>
    </div>
  );
}
