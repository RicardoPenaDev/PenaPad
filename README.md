<p align="center">
  <img src="docs/icon.png" width="96" alt="Ícone do PenaPad">
</p>

<h1 align="center">PenaPad</h1>

<p align="center">
  Editor de texto e código leve para macOS, Windows e Linux, no espírito do Notepad++.<br>
  Abas, tela dividida, comparação de textos, histórico de versões e nada se perde ao fechar.
</p>

<p align="center">
  <a href="https://github.com/RicardoPenaDev/PenaPad/releases"><b>⬇ Baixar</b></a>
  · macOS (Apple Silicon e Intel) · Windows 10 e 11 · Linux (AppImage, .deb, .rpm, Flatpak) · gratuito e de código aberto
</p>

![PenaPad com um arquivo TypeScript aberto](docs/screenshots/01-principal.png)

## Por que o PenaPad

- **Nada se perde ao fechar.** Feche o app com textos não salvos: na próxima vez eles voltam exatamente como estavam,
  com as abas, a posição do cursor e a tela dividida. Sem perguntas ao sair.
- **Histórico de versões local.** O PenaPad guarda versões do texto em disco (ao abrir, ao salvar, a cada 5 minutos
  e antes de qualquer troca grande). Dá para comparar com a versão atual e restaurar.
- **Leve.** Usa o WebView do próprio sistema (não leva um navegador inteiro junto) e carrega só as partes do
  editor que usa. Instalador de 3 a 7 MB e cerca de 70–120 MB de memória no uso normal.
- **Do jeito de cada sistema.** No Mac, menus nativos e atalhos com ⌘; no Windows e no Linux, a barra de janela
  do sistema e atalhos com Ctrl. Clique direito nativo, tema claro e escuro, em português.

## Recursos

### Tela dividida
Dois arquivos lado a lado (ou um em cima do outro), cada lado com suas próprias abas. `⌘\` (`Ctrl+\`) divide e junta;
clique direito numa aba para mandá-la para o outro lado.

![Tela dividida no tema escuro](docs/screenshots/02-tela-dividida-escuro.png)

### Comparar textos
Compare duas abas, uma aba com o texto copiado, com a versão do disco ou com uma versão do histórico.
Diferenças destacadas por linha e por palavra, navegação com `F7` / `⇧F7`, lado a lado ou em uma coluna.

![Comparação entre duas versões de um arquivo](docs/screenshots/03-comparar.png)

### Substituir Tudo com prévia
Antes de trocar, o PenaPad mostra cada linha que vai mudar (antes e depois). Dá para desmarcar linhas.
Funciona com expressões regulares e grupos (`$1`, `$2`). Um `⌘Z` (`Ctrl+Z`) desfaz tudo.

![Prévia do Substituir Tudo](docs/screenshots/04-previa-substituir.png)

### Paleta de comandos
`⇧⌘P` (`Ctrl+Shift+P`) e digite parte do nome de qualquer função — sem precisar lembrar onde fica no menu.
Também troca a linguagem e pula para qualquer aba aberta.

![Paleta de comandos](docs/screenshots/05-paleta-comandos.png)

### Histórico de versões
`⇧⌘H` (`Ctrl+Shift+H`) lista as versões guardadas do documento. Abrindo uma, ela aparece comparada com o texto atual,
com opções para restaurar ou abrir numa aba nova.

![Histórico de versões](docs/screenshots/06-historico-versoes.png)

### E mais
- **Linhas:** ordenar (A→Z, Z→A, com números na ordem certa), remover duplicadas, remover vazias, limpar espaços,
  adicionar prefixo/sufixo, duplicar, mover e excluir linhas. Valem para a seleção ou para o documento todo.
- **Vários cursores e seleção em coluna:** `⌘D`, `⇧⌘L`, `⌘` + clique, `⌥` + arrastar
  (no Windows e no Linux: `Ctrl+D`, `Ctrl+Shift+L`, `Ctrl` + clique, `Alt` + arrastar).
- **JSON:** formatar e validar; erros aparecem na barra de status com linha e coluna, e um clique leva até eles.
- **Arquivos alterados por outros programas:** o PenaPad percebe e oferece comparar, recarregar ou manter sua versão.
  Também avisa se o arquivo foi apagado ou movido, sem perder o texto.
- **Reabrir aba fechada** (`⇧⌘T` / `Ctrl+Shift+T`), inclusive com texto não salvo.
- Realce de sintaxe para dezenas de linguagens, detecção pela extensão, quebra de linha, minimapa, zoom,
  codificações UTF-8 / UTF-16 / ASCII e quebras de linha LF / CRLF.

## Atalhos principais

| Ação | macOS | Windows e Linux |
|---|---|---|
| Paleta de comandos | `⇧⌘P` | `Ctrl+Shift+P` |
| Dividir tela | `⌘\` | `Ctrl+\` |
| Localizar / Substituir | `⌘F` / `⌥⌘F` | `Ctrl+F` / `Ctrl+H` |
| Localizar próxima / anterior | `⌘G` / `⇧⌘G` | `F3` / `Shift+F3` |
| Substituir Tudo (com prévia) | `⌘↩` no campo Substituir | `Ctrl+Enter` no campo Substituir |
| Reabrir aba fechada | `⇧⌘T` | `Ctrl+Shift+T` |
| Histórico de versões | `⇧⌘H` | `Ctrl+Shift+H` |
| Selecionar próxima ocorrência / todas | `⌘D` / `⇧⌘L` | `Ctrl+D` / `Ctrl+Shift+L` |
| Duplicar / mover / excluir linha | `⇧⌥↓` / `⌥↑` `⌥↓` / `⇧⌘K` | `Shift+Alt+↓` / `Alt+↑` `Alt+↓` / `Ctrl+Shift+K` |
| Formatar documento | `⇧⌥F` | `Shift+Alt+F` |
| Ir para linha | `⌃G` | `Ctrl+G` |
| Quebra automática de linha | `⌥Z` | `Alt+Z` |
| Tela cheia / sair | menu Visualizar / `⌘Q` | `F11` / `Ctrl+Q` |

No Mac os atalhos aparecem nos menus; em todos os sistemas aparecem na paleta de comandos e nas dicas dos botões.

## Instalação

Todos os arquivos ficam na [página de versões](https://github.com/RicardoPenaDev/PenaPad/releases).

### macOS
1. Baixe o `PenaPad_x.y.z_universal.dmg` (funciona em Macs Apple Silicon e Intel, macOS 11 ou mais novo).
2. Abra o arquivo e arraste o PenaPad para **Aplicativos**.
3. **Primeira abertura:** o app ainda não é assinado com um certificado da Apple, então o macOS mostra um aviso.
   Abra o PenaPad uma vez, feche o aviso e vá em **Ajustes do Sistema → Privacidade e Segurança**, role até o fim
   e clique em **Abrir Mesmo Assim**. Isso só é necessário uma vez.

   Se preferir pelo Terminal:
   ```sh
   xattr -dr com.apple.quarantine /Applications/PenaPad.app
   ```

### Windows
1. Baixe o `PenaPad_x.y.z_x64-setup.exe` e abra. A instalação é só para o seu usuário e não pede senha de administrador.
2. **Aviso do Windows:** como o instalador ainda não tem assinatura digital paga, o Windows pode mostrar
   "O Windows protegeu o computador". Clique em **Mais informações → Executar assim mesmo**.
3. O PenaPad aparece no menu Iniciar e em **Abrir com** para arquivos de texto e código.

Precisa do Windows 10 ou 11 (o WebView2, que o PenaPad usa, já vem com eles).

### Linux
Escolha um formato (todos para PCs x86_64):

| Formato | Para quem | Como instalar |
|---|---|---|
| `.AppImage` | qualquer distribuição, sem instalar | `chmod +x PenaPad_*.AppImage` e abra o arquivo |
| `.deb` | Ubuntu, Debian, Mint, Pop!_OS | `sudo apt install ./PenaPad_*_amd64.deb` |
| `.rpm` | Fedora, openSUSE | `sudo dnf install ./PenaPad-*.x86_64.rpm` |
| `.flatpak` | qualquer distribuição com Flatpak | `flatpak install --user PenaPad_*.flatpak` |

O pacote Flatpak usa o runtime GNOME 50 do Flathub. Se ele ainda não estiver instalado, rode antes
`flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`.

### Onde ficam os dados
Tudo fica só no seu computador: `session.json` e `backup/` (textos abertos) e `history/` (versões: até 50 por
documento, 30 dias, 200 MB no total). O PenaPad não se conecta à internet.

| Sistema | Pasta |
|---|---|
| macOS | `~/Library/Application Support/com.ricardopena.penapad/` |
| Windows | `%APPDATA%\com.ricardopena.penapad\` |
| Linux | `~/.local/share/com.ricardopena.penapad/` |
| Flatpak | `~/.var/app/com.ricardopena.penapad/data/com.ricardopena.penapad/` |

## Compilar a partir do código

Requisitos: [Node.js](https://nodejs.org) 20+ e [Rust](https://rustup.rs), mais o que o Tauri pede em cada sistema
([lista](https://tauri.app/start/prerequisites/)): ferramentas de linha de comando do Xcode no Mac, Build Tools do
Visual Studio no Windows, WebKitGTK 4.1 no Linux.

```sh
git clone https://github.com/RicardoPenaDev/PenaPad.git
cd PenaPad
npm install
npm start          # abre em modo de desenvolvimento
npx tauri build    # gera os instaladores do sistema em que você está
npx tauri build --target universal-apple-darwin --bundles dmg   # Mac: Apple Silicon + Intel
```

As versões publicadas são geradas pelo GitHub Actions ([`.github/workflows/release.yml`](.github/workflows/release.yml)):
ao enviar uma tag `v*`, ele compila no macOS, no Windows e no Linux, monta o Flatpak
([`flatpak/`](flatpak/)) e deixa tudo numa versão em rascunho.

Feito com [Tauri 2](https://tauri.app), [React](https://react.dev), [Monaco Editor](https://microsoft.github.io/monaco-editor/)
e [Tailwind CSS](https://tailwindcss.com). Estrutura:

```
src/                interface (React + TypeScript)
  App.tsx           abas, tela dividida, sessão, comandos
  components/       barra de opções, busca, comparação, paleta, diálogos
src-tauri/src/      parte nativa (Rust)
  lib.rs            arquivos, sessão, menus nativos
  history.rs        histórico de versões em disco
flatpak/            manifesto do pacote Flatpak
```

## Licença

[MIT](LICENSE) © 2026 Ricardo Pena. Componentes de terceiros em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

O PenaPad é um projeto independente, sem relação com o Notepad++ ou com a Microsoft.

---

### English

**PenaPad** is a lightweight, free and open-source text and code editor for macOS, Windows and Linux, inspired by Notepad++.
Unsaved text survives quitting, and it has tabs, split view, text compare, local version history, Replace All
with preview, a command palette (`⇧⌘P` / `Ctrl+Shift+P`), line tools, multi-cursor and JSON formatting.
Built with Tauri 2 + Monaco. The interface is in Brazilian Portuguese.
[Download](https://github.com/RicardoPenaDev/PenaPad/releases): macOS 11+ (universal `.dmg`), Windows 10/11 (`.exe`),
Linux x86_64 (`.AppImage`, `.deb`, `.rpm`, `.flatpak`).
MIT licensed.
