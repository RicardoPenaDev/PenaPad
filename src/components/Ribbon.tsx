import { useState, type ReactNode } from 'react';
import {
  FilePlus, FolderOpen, Save, SaveAll, Undo2, Redo2, Scissors, Copy, ClipboardPaste, WrapText,
  ZoomIn, ZoomOut, Search, Replace, MessageSquareCode, CopyPlus, ArrowUp, ArrowDown, Trash2,
  CaseUpper, CaseLower, Eraser, ArrowDownAZ, ArrowDownZA, Wand2, Map as MapIcon, ListOrdered,
  Pilcrow, Sun, Moon, Monitor, FoldVertical, UnfoldVertical, CornerDownRight, ChevronDown,
  ChevronUp, TextSelect, Code2, Braces, FileCode2, FileText, Hash, Terminal, Database, Globe, Palette,
  Maximize2, X as XIcon, Search as SearchIcon, Columns2, Rows2, ArrowLeftRight, RotateCw,
  SquareDashed, Languages, Info, ListX, ListMinus, History, ArrowLeftToLine, ArrowRightToLine, GitCompareArrows, MousePointerClick,
} from 'lucide-react';
import { allLanguages, languageName } from '../monaco';
import { kt } from '../platform';
import { t } from '../i18n';

export type Exec = (cmd: string, arg?: string) => void;

export interface RibbonState {
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  whitespace: boolean;
  theme: 'system' | 'light' | 'dark';
  language: string;
  zoom: number;
  split: boolean;
  columnSelection: boolean;
  splitDir: 'row' | 'col';
  uiLang: 'auto' | 'pt' | 'en';
}

const TABS = [
  { id: 'home', label: 'Início' },
  { id: 'edit', label: 'Editar' },
  { id: 'view', label: 'Visualizar' },
  { id: 'lang', label: 'Linguagem' },
  { id: 'find', label: 'Localizar' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function Big({ icon, label, onClick, active, title }: { icon: ReactNode; label: string; onClick: () => void; active?: boolean; title?: string }) {
  return (
    <button
      title={title ?? label}
      onClick={onClick}
      className={`flex h-[62px] min-w-[54px] flex-col items-center justify-center gap-1 rounded-md px-2 text-[11.5px] leading-tight transition-colors ${
        active ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'hover:bg-[var(--hover)] active:bg-[var(--pressed)]'
      }`}
    >
      <span className={active ? '' : 'text-[var(--accent)]'}>{icon}</span>
      <span className="max-w-[72px] text-center">{label}</span>
    </button>
  );
}

function Small({ icon, label, onClick, active, title }: { icon: ReactNode; label: string; onClick: () => void; active?: boolean; title?: string }) {
  return (
    <button
      title={title ?? label}
      onClick={onClick}
      className={`flex h-[20px] items-center gap-1.5 rounded px-1.5 text-[11.5px] whitespace-nowrap transition-colors ${
        active ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'hover:bg-[var(--hover)] active:bg-[var(--pressed)]'
      }`}
    >
      <span className="text-[var(--text-2)]">{icon}</span>
      {label}
    </button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col border-r border-[var(--border)] px-2 last:border-r-0">
      <div className="flex flex-1 items-center gap-0.5">{children}</div>
      <div className="pb-0.5 text-center text-[10.5px] text-[var(--text-3)]">{label}</div>
    </div>
  );
}

function Stack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col justify-center gap-[1px]">{children}</div>;
}

const I = 22; // ícone grande
const S = 14; // ícone pequeno

const QUICK_LANGS: { id: string; label: string; icon: ReactNode }[] = [
  { id: 'plaintext', label: 'Texto', icon: <FileText size={I} strokeWidth={1.5} /> },
  { id: 'javascript', label: 'JavaScript', icon: <Braces size={I} strokeWidth={1.5} /> },
  { id: 'typescript', label: 'TypeScript', icon: <FileCode2 size={I} strokeWidth={1.5} /> },
  { id: 'python', label: 'Python', icon: <Code2 size={I} strokeWidth={1.5} /> },
  { id: 'html', label: 'HTML', icon: <Globe size={I} strokeWidth={1.5} /> },
  { id: 'css', label: 'CSS', icon: <Palette size={I} strokeWidth={1.5} /> },
  { id: 'json', label: 'JSON', icon: <Braces size={I} strokeWidth={1.5} /> },
  { id: 'sql', label: 'SQL', icon: <Database size={I} strokeWidth={1.5} /> },
  { id: 'markdown', label: 'Markdown', icon: <Hash size={I} strokeWidth={1.5} /> },
  { id: 'shell', label: 'Shell', icon: <Terminal size={I} strokeWidth={1.5} /> },
];

function LanguagePicker({ value, exec }: { value: string; exec: Exec }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const langs = allLanguages().filter((l) => !q || l.name.toLowerCase().includes(q.toLowerCase()) || l.id.includes(q.toLowerCase()));
  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); setQ(''); }}
        className="flex h-[28px] w-[200px] items-center justify-between rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-[12.5px] hover:border-[var(--accent)]"
      >
        <span className="truncate">{languageName(value)}</span>
        <ChevronDown size={14} className="text-[var(--text-3)]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-[32px] left-0 z-50 w-[240px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
            <div className="flex items-center gap-1.5 border-b border-[var(--border)] px-2 py-1.5">
              <SearchIcon size={13} className="text-[var(--text-3)]" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setOpen(false);
                  if (e.key === 'Enter' && langs[0]) { exec('language', langs[0].id); setOpen(false); }
                }}
                placeholder={t("Filtrar linguagens…")}
                className="w-full bg-transparent text-[12.5px] outline-none"
              />
            </div>
            <div className="lang-list max-h-[320px] overflow-y-auto py-1">
              {langs.map((l) => (
                <button
                  key={l.id}
                  onClick={() => { exec('language', l.id); setOpen(false); }}
                  className={`flex w-full items-center justify-between px-3 py-[3px] text-left text-[12.5px] hover:bg-[var(--accent)] hover:text-white ${l.id === value ? 'font-semibold text-[var(--accent-text)]' : ''}`}
                >
                  {l.name}
                  <span className="text-[10.5px] opacity-60">{l.id}</span>
                </button>
              ))}
              {langs.length === 0 && <div className="px-3 py-2 text-[12px] text-[var(--text-3)]">{t('Nenhuma linguagem encontrada')}</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Ribbon({ exec, state }: { exec: Exec; state: RibbonState }) {
  const [tab, setTab] = useState<TabId>('home');
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="border-b border-[var(--border)] bg-[var(--chrome)]">
      <div data-tauri-drag-region className="flex h-[30px] items-end gap-1 px-3">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => { setTab(tb.id); setCollapsed(false); }}
            onDoubleClick={() => setCollapsed(!collapsed)}
            className={`relative h-[28px] rounded-t-md px-3 text-[12.5px] transition-colors ${
              tab === tb.id && !collapsed ? 'font-semibold text-[var(--accent-text)]' : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--hover)]'
            }`}
          >
            {t(tb.label)}
            {tab === tb.id && !collapsed && <span className="absolute right-3 bottom-0 left-3 h-[3px] rounded-full bg-[var(--accent)]" />}
          </button>
        ))}
        <div data-tauri-drag-region className="flex-1 self-stretch" />
        <button
          title={t('Sobre o PenaPad')}
          aria-label={t('Sobre o PenaPad')}
          onClick={() => exec('about')}
          className="mb-1 rounded p-1 text-[var(--text-3)] hover:bg-[var(--hover)] hover:text-[var(--text-2)]"
        >
          <Info size={14} />
        </button>
        <button
          title={collapsed ? t('Expandir a Faixa de Opções') : t('Recolher a Faixa de Opções')}
          onClick={() => setCollapsed(!collapsed)}
          className="mb-1 rounded p-1 text-[var(--text-3)] hover:bg-[var(--hover)]"
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {!collapsed && (
        <div className="mx-2 mb-2 ribbon-scroll flex h-[86px] items-stretch overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--chrome-2)] px-1 pt-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {tab === 'home' && (
            <>
              <Group label={t("Arquivo")}>
                <Big icon={<FilePlus size={I} strokeWidth={1.5} />} label={t("Novo")} title={kt("Novo (⌘N)")} onClick={() => exec('new')} />
                <Big icon={<FolderOpen size={I} strokeWidth={1.5} />} label={t("Abrir")} title={kt("Abrir (⌘O)")} onClick={() => exec('open')} />
                <Big icon={<Save size={I} strokeWidth={1.5} />} label={t("Salvar")} title={kt("Salvar (⌘S)")} onClick={() => exec('save')} />
                <Big icon={<SaveAll size={I} strokeWidth={1.5} />} label={t("Salvar Como")} title={kt("Salvar Como (⇧⌘S)")} onClick={() => exec('saveAs')} />
              </Group>
              <Group label={t("Área de Transferência")}>
                <Big icon={<ClipboardPaste size={I} strokeWidth={1.5} />} label={t("Colar")} title={kt("Colar (⌘V)")} onClick={() => exec('paste')} />
                <Stack>
                  <Small icon={<Scissors size={S} />} label={t("Recortar")} title={kt("Recortar (⌘X)")} onClick={() => exec('cut')} />
                  <Small icon={<Copy size={S} />} label={t("Copiar")} title={kt("Copiar (⌘C)")} onClick={() => exec('copy')} />
                  <Small icon={<TextSelect size={S} />} label={t("Selecionar Tudo")} title={kt("Selecionar Tudo (⌘A)")} onClick={() => exec('selectAll')} />
                </Stack>
              </Group>
              <Group label={t("Histórico")}>
                <Stack>
                  <Small icon={<Undo2 size={S} />} label={t("Desfazer")} title={kt("Desfazer (⌘Z)")} onClick={() => exec('undo')} />
                  <Small icon={<Redo2 size={S} />} label={t("Refazer")} title={kt("Refazer (⇧⌘Z)")} onClick={() => exec('redo')} />
                  <Small icon={<History size={S} />} label={t("Versões…")} title={kt("Histórico de versões guardadas deste documento, mesmo depois de fechar o app (⇧⌘H)")} onClick={() => exec('history')} />
                </Stack>
              </Group>
              <Group label={t("Exibição")}>
                <Big icon={<WrapText size={I} strokeWidth={1.5} />} label={t("Quebra de Linha")} active={state.wordWrap} title={kt("Quebra Automática de Linha (⌥Z)")} onClick={() => exec('wordWrap')} />
                <Big icon={state.splitDir === 'row' ? <Columns2 size={I} strokeWidth={1.5} /> : <Rows2 size={I} strokeWidth={1.5} />} label={t("Dividir Tela")} active={state.split} title={kt("Dividir a tela em duas vistas (⌘\\)")} onClick={() => exec('split')} />
                <Stack>
                  <Small icon={<ZoomIn size={S} />} label={t("Ampliar")} title={kt("Aumentar Zoom (⌘+)")} onClick={() => exec('zoomIn')} />
                  <Small icon={<ZoomOut size={S} />} label={t("Reduzir")} title={kt("Diminuir Zoom (⌘−)")} onClick={() => exec('zoomOut')} />
                  <Small icon={<Maximize2 size={S} />} label={`${state.zoom}%`} title={kt("Zoom 100% (⌘0)")} onClick={() => exec('zoomReset')} />
                </Stack>
              </Group>
              <Group label={t("Linguagem")}>
                <div className="flex flex-col gap-1">
                  <LanguagePicker value={state.language} exec={exec} />
                  <span className="text-[10.5px] text-[var(--text-3)]">{t('Detectada pela extensão do arquivo')}</span>
                </div>
              </Group>
              <Group label={t("Localizar")}>
                <Big icon={<Search size={I} strokeWidth={1.5} />} label={t("Localizar")} title={kt("Localizar (⌘F)")} onClick={() => exec('find')} />
                <Big icon={<Replace size={I} strokeWidth={1.5} />} label={t("Substituir")} title={kt("Substituir (⌥⌘F)")} onClick={() => exec('replace')} />
              </Group>
            </>
          )}

          {tab === 'edit' && (
            <>
              <Group label={t("Histórico")}>
                <Big icon={<Undo2 size={I} strokeWidth={1.5} />} label={t("Desfazer")} onClick={() => exec('undo')} />
                <Big icon={<Redo2 size={I} strokeWidth={1.5} />} label={t("Refazer")} onClick={() => exec('redo')} />
              </Group>
              <Group label={t("Código")}>
                <Big icon={<MessageSquareCode size={I} strokeWidth={1.5} />} label={t("Comentar")} title={kt("Comentar / Descomentar a linha ou a seleção (⌘/)")} onClick={() => exec('comment')} />
                <Big icon={<Wand2 size={I} strokeWidth={1.5} />} label={t("Formatar")} title={kt("Formatar Documento (⇧⌥F)")} onClick={() => exec('format')} />
                <Big icon={<Braces size={I} strokeWidth={1.5} />} label={t("Formatar JSON")} title={t("Deixa um JSON de uma linha legível e mostra onde estão os erros")} onClick={() => exec('formatJson')} />
              </Group>
              <Group label={t("Vários Cursores")}>
                <Big icon={<TextSelect size={I} strokeWidth={1.5} />} label={t("Próxima Ocorrência")} title={kt("Seleciona a próxima ocorrência da palavra/seleção com mais um cursor (⌘D)")} onClick={() => exec('addNextOccurrence')} />
                <Big icon={<MousePointerClick size={I} strokeWidth={1.5} />} label={t("Todas as Ocorrências")} title={kt("Um cursor em cada ocorrência para editar todas juntas (⇧⌘L). Dica: ⌘ + clique cria um cursor extra")} onClick={() => exec('selectOccurrences')} />
                <Big icon={<SquareDashed size={I} strokeWidth={1.5} />} label={t("Seleção em Coluna")} active={state.columnSelection} title={kt("Liga/desliga a seleção em bloco (coluna). Sem ligar: ⌥ + arrastar")} onClick={() => exec('columnSelection')} />
              </Group>
              <Group label={t("Linhas")}>
                <Stack>
                  <Small icon={<CopyPlus size={S} />} label={t("Duplicar")} title={kt("Duplicar Linha (⇧⌥↓)")} onClick={() => exec('duplicate')} />
                  <Small icon={<ArrowUp size={S} />} label={t("Mover para Cima")} title={kt("Mover Linha para Cima (⌥↑)")} onClick={() => exec('moveUp')} />
                  <Small icon={<ArrowDown size={S} />} label={t("Mover para Baixo")} title={kt("Mover Linha para Baixo (⌥↓)")} onClick={() => exec('moveDown')} />
                </Stack>
                <Stack>
                  <Small icon={<Trash2 size={S} />} label={t("Excluir Linha")} title={kt("Excluir Linha (⇧⌘K)")} onClick={() => exec('deleteLine')} />
                  <Small icon={<ArrowDownAZ size={S} />} label={t("Ordenar A→Z")} title={kt("Ordena a seleção ou o documento (⌘Z desfaz)")} onClick={() => exec('sortAsc')} />
                  <Small icon={<ArrowDownZA size={S} />} label={t("Ordenar Z→A")} title={kt("Ordena a seleção ou o documento (⌘Z desfaz)")} onClick={() => exec('sortDesc')} />
                </Stack>
                <Stack>
                  <Small icon={<ListX size={S} />} label={t("Remover Duplicadas")} title={t("Mantém só a primeira de cada linha repetida (seleção ou documento)")} onClick={() => exec('dedupe')} />
                  <Small icon={<ListMinus size={S} />} label={t("Remover Linhas Vazias")} title={t("Remove linhas vazias ou só com espaços (seleção ou documento)")} onClick={() => exec('removeEmpty')} />
                  <Small icon={<Eraser size={S} />} label={t("Limpar Espaços")} title={t("Remove espaços no início e no fim das linhas (seleção ou documento)")} onClick={() => exec('trimBoth')} />
                </Stack>
                <Stack>
                  <Small icon={<ArrowLeftToLine size={S} />} label={t("Adicionar Prefixo…")} title={t("Insere um texto no início de cada linha")} onClick={() => exec('prefix')} />
                  <Small icon={<ArrowRightToLine size={S} />} label={t("Adicionar Sufixo…")} title={t("Insere um texto no fim de cada linha")} onClick={() => exec('suffix')} />
                  <Small icon={<Eraser size={S} />} label={t("Espaços no Fim")} title={t("Remove só os espaços no fim das linhas")} onClick={() => exec('trim')} />
                </Stack>
              </Group>
              <Group label={t("Texto")}>
                <Stack>
                  <Small icon={<CaseUpper size={S} />} label={t("MAIÚSCULAS")} onClick={() => exec('upper')} />
                  <Small icon={<CaseLower size={S} />} label={t("minúsculas")} onClick={() => exec('lower')} />
                </Stack>
              </Group>
              <Group label={t("Navegação")}>
                <Big icon={<CornerDownRight size={I} strokeWidth={1.5} />} label={t("Ir para Linha")} title={kt("Ir para Linha (⌃G)")} onClick={() => exec('gotoLine')} />
              </Group>
            </>
          )}

          {tab === 'view' && (
            <>
              <Group label={t("Editor")}>
                <Big icon={<WrapText size={I} strokeWidth={1.5} />} label={t("Quebra de Linha")} active={state.wordWrap} onClick={() => exec('wordWrap')} />
                <Big icon={<MapIcon size={I} strokeWidth={1.5} />} label={t("Minimapa")} active={state.minimap} onClick={() => exec('minimap')} />
                <Big icon={<ListOrdered size={I} strokeWidth={1.5} />} label={t("Nº de Linha")} active={state.lineNumbers} onClick={() => exec('lineNumbers')} />
                <Big icon={<Pilcrow size={I} strokeWidth={1.5} />} label={t("Espaços")} title={t("Mostrar Espaços em Branco")} active={state.whitespace} onClick={() => exec('whitespace')} />
              </Group>
              <Group label={t("Dobramento")}>
                <Stack>
                  <Small icon={<FoldVertical size={S} />} label={t("Recolher Tudo")} onClick={() => exec('foldAll')} />
                  <Small icon={<UnfoldVertical size={S} />} label={t("Expandir Tudo")} onClick={() => exec('unfoldAll')} />
                </Stack>
              </Group>
              <Group label={t("Dividir Tela")}>
                <Big
                  icon={state.splitDir === 'row' ? <Columns2 size={I} strokeWidth={1.5} /> : <Rows2 size={I} strokeWidth={1.5} />}
                  label={t("Dividir Tela")} active={state.split} title={kt("Dividir a tela em duas vistas (⌘\\)")} onClick={() => exec('split')}
                />
                <Stack>
                  <Small icon={<ArrowLeftRight size={S} />} label={t("Mover Aba para o Outro Lado")} title={t("Move a aba atual para a outra vista")} onClick={() => exec('moveOther')} />
                  <Small icon={<RotateCw size={S} />} label={state.splitDir === 'row' ? t('Empilhar (Cima/Baixo)') : t('Lado a Lado')} title={t("Alterna entre lado a lado e um em cima do outro")} onClick={() => exec('rotateSplit')} />
                  <Small icon={<GitCompareArrows size={S} />} label={t("Comparar os Dois Lados")} title={t("Mostra as diferenças entre os textos (com a tela dividida, compara esquerda × direita)")} onClick={() => exec('compare')} />
                </Stack>
              </Group>
              <Group label={t("Zoom")}>
                <Big icon={<ZoomIn size={I} strokeWidth={1.5} />} label={t("Ampliar")} onClick={() => exec('zoomIn')} />
                <Big icon={<ZoomOut size={I} strokeWidth={1.5} />} label={t("Reduzir")} onClick={() => exec('zoomOut')} />
                <Big icon={<Maximize2 size={I} strokeWidth={1.5} />} label="100%" onClick={() => exec('zoomReset')} />
              </Group>
              <Group label={t("Tema")}>
                <Big icon={<Sun size={I} strokeWidth={1.5} />} label={t("Claro")} active={state.theme === 'light'} onClick={() => exec('theme', 'light')} />
                <Big icon={<Moon size={I} strokeWidth={1.5} />} label={t("Escuro")} active={state.theme === 'dark'} onClick={() => exec('theme', 'dark')} />
                <Big icon={<Monitor size={I} strokeWidth={1.5} />} label={t("Sistema")} active={state.theme === 'system'} onClick={() => exec('theme', 'system')} />
              </Group>
              <Group label={t("Idioma")}>
                <Stack>
                  <Small icon={<Languages size={S} />} label={t("Automático")} title={t("Segue o idioma do sistema")} active={state.uiLang === 'auto'} onClick={() => exec('uiLang', 'auto')} />
                  <Small icon={<span className="inline-block w-[14px] text-center text-[10px] font-semibold">PT</span>} label="Português" active={state.uiLang === 'pt'} onClick={() => exec('uiLang', 'pt')} />
                  <Small icon={<span className="inline-block w-[14px] text-center text-[10px] font-semibold">EN</span>} label="English" active={state.uiLang === 'en'} onClick={() => exec('uiLang', 'en')} />
                </Stack>
              </Group>
            </>
          )}

          {tab === 'lang' && (
            <>
              <Group label={t("Linguagem do Documento")}>
                <div className="flex flex-col gap-1 px-1">
                  <LanguagePicker value={state.language} exec={exec} />
                  <button onClick={() => exec('detectLanguage')} className="self-start rounded px-1 text-[11.5px] text-[var(--accent-text)] hover:underline">
                    {t('Detectar automaticamente')}
                  </button>
                </div>
              </Group>
              <Group label={t("Acesso Rápido")}>
                {QUICK_LANGS.map((l) => (
                  <Big key={l.id} icon={l.icon} label={t(l.label)} active={state.language === l.id} onClick={() => exec('language', l.id)} />
                ))}
              </Group>
            </>
          )}

          {tab === 'find' && (
            <>
              <Group label={t("Localizar")}>
                <Big icon={<Search size={I} strokeWidth={1.5} />} label={t("Localizar")} title={kt("Localizar (⌘F)")} onClick={() => exec('find')} />
                <Big icon={<Replace size={I} strokeWidth={1.5} />} label={t("Substituir")} title={kt("Substituir (⌥⌘F)")} onClick={() => exec('replace')} />
                <Stack>
                  <Small icon={<ChevronDown size={S} />} label={t("Próxima")} title={kt("Próxima ocorrência (⌘G)")} onClick={() => exec('findNext')} />
                  <Small icon={<ChevronUp size={S} />} label={t("Anterior")} title={kt("Ocorrência anterior (⇧⌘G)")} onClick={() => exec('findPrev')} />
                  <Small icon={<XIcon size={S} />} label={t("Fechar Busca")} onClick={() => exec('closeFind')} />
                </Stack>
              </Group>
              <Group label={t("Seleção")}>
                <Big icon={<TextSelect size={I} strokeWidth={1.5} />} label={t("Todas as Ocorrências")} title={kt("Um cursor em cada ocorrência da seleção (⇧⌘L)")} onClick={() => exec('selectOccurrences')} />
                <Big icon={<CopyPlus size={I} strokeWidth={1.5} />} label={t("Próxima Ocorrência")} title={kt("Adiciona a próxima ocorrência à seleção (⌘D)")} onClick={() => exec('addNextOccurrence')} />
              </Group>
              <Group label={t("Navegação")}>
                <Big icon={<CornerDownRight size={I} strokeWidth={1.5} />} label={t("Ir para Linha")} onClick={() => exec('gotoLine')} />
              </Group>
            </>
          )}
        </div>
      )}
    </div>
  );
}
