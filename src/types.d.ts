export type Encoding = 'utf8' | 'utf16le' | 'ascii';
export type Eol = 'LF' | 'CRLF';

export interface OpenedDoc {
  path: string;
  name: string;
  content: string;
  encoding: Encoding;
  eol: Eol;
  mtime?: number;
  size?: number;
}

export interface FileStat { mtime: number; size: number }
