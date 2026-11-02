import { AlertTriangle, Minus, Plus } from 'lucide-react';
import type { Encoding, Eol } from '../types';
import { languageName } from '../monaco';

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
      <span className="min-w-[40px] max-w-[340px] shrink truncate font-medium text-[var(--accent-text)]" title={message}>{message || 'Pronto'}</span>
      {problem && (
        <>
          <span className="h-[14px] w-px bg-[var(--border-strong)]" />
          <button
            onClick={onProblem}
            title={`${problem.message}\n\nClique para ir até o erro`}
            className="flex min-w-[60px] max-w-[460px] shrink items-center gap-1 rounded px-1 text-[var(--diff-del)] hover:bg-[var(--hover)]"
          >
            <AlertTriangle size={12} className="shrink-0" />
            <span className="truncate">
              Erro na linha {problem.line}, coluna {problem.col}: {problem.message}
              {problem.total > 1 ? ` (+${problem.total - 1})` : ''}
            </span>
          </button>
        </>
      )}
      {sep}
      <span>Linha: {info.line}, Coluna: {info.col}</span>
      {info.selChars > 0 && (
        <>
          {sep}
          <span>
            Seleção: {info.selChars.toLocaleString('pt-BR')} caracteres{info.selLines > 1 ? ` (${info.selLines} linhas)` : ''}
            {info.cursors > 1 ? ` · ${info.cursors} cursores` : ''}
          </span>
        </>
      )}
      {sep}
      <span>Total: {info.totalChars.toLocaleString('pt-BR')} caracteres · {info.totalLines.toLocaleString('pt-BR')} linhas</span>

      <div className="flex-1" />

      <span>{languageName(language)}</span>
      {sep}
      <select title="Quebra de linha" className="ui-select h-[20px]" value={eol} onChange={(e) => onEol(e.target.value as Eol)}>
        <option value="LF">LF (macOS/Linux)</option>
        <option value="CRLF">CRLF (Windows)</option>
      </select>
      {sep}
      <select title="Codificação ao salvar" className="ui-select h-[20px]" value={encoding} onChange={(e) => onEncoding(e.target.value as Encoding)}>
        <option value="utf8">UTF-8</option>
        <option value="utf16le">UTF-16</option>
        <option value="ascii">ASCII</option>
      </select>
      {sep}
      <div className="flex items-center gap-1.5">
        <button title="Diminuir zoom" onClick={() => onZoom(zoom - 10)} className="rounded p-0.5 hover:bg-[var(--hover)]"><Minus size={12} /></button>
        <input
          type="range"
          min={50}
          max={300}
          step={10}
          value={zoom}
          onChange={(e) => onZoom(Number(e.target.value))}
          onDoubleClick={() => onZoom(100)}
          className="zoom-range w-[110px]"
          title="Zoom (duplo clique: 100%)"
        />
        <button title="Aumentar zoom" onClick={() => onZoom(zoom + 10)} className="rounded p-0.5 hover:bg-[var(--hover)]"><Plus size={12} /></button>
        <button title="Redefinir para 100%" onClick={() => onZoom(100)} className="w-[38px] rounded text-right hover:bg-[var(--hover)]">{zoom}%</button>
      </div>
    </div>
  );
}
