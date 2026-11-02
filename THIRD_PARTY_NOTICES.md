# Componentes de terceiros

O PenaPad é distribuído sob a licença MIT (veja [LICENSE](LICENSE)) e usa os componentes de código aberto abaixo.
Todos têm licenças permissivas que permitem uso, modificação e distribuição, inclusive gratuita.

## Incluídos no app

| Componente | Uso | Licença |
|---|---|---|
| [Monaco Editor](https://github.com/microsoft/monaco-editor) 0.57 | Editor de texto, realce de sintaxe, comparação | MIT — © Microsoft Corporation |
| [React](https://github.com/facebook/react) 19 | Interface | MIT — © Meta Platforms, Inc. |
| [Lucide](https://github.com/lucide-icons/lucide) | Ícones da interface | ISC — © Lucide Contributors |
| [Tauri](https://github.com/tauri-apps/tauri) 2 (+ plugins dialog e clipboard-manager) | Janela nativa, menus, arquivos | MIT ou Apache-2.0 — © Tauri Programme within The Commons Conservancy |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) 4 | Estilos (gerados na compilação) | MIT — © Tailwind Labs, Inc. |
| [serde / serde_json](https://github.com/serde-rs) | Leitura e gravação de JSON | MIT ou Apache-2.0 |

O Monaco Editor inclui componentes próprios de terceiros, listados no arquivo
[ThirdPartyNotices.txt](https://github.com/microsoft/monaco-editor/blob/main/ThirdPartyNotices.txt) do projeto.

## Bibliotecas Rust indiretas

O app também usa cerca de 260 bibliotecas Rust indiretas (dependências do Tauri). Todas têm licenças permissivas:
a grande maioria é MIT e/ou Apache-2.0; algumas usam Unicode-3.0, Zlib, BSD-2/BSD-3, Unlicense, CC0 ou MPL-2.0
(estas últimas sem modificações, com código-fonte disponível em [crates.io](https://crates.io)).
A lista completa pode ser gerada com:

```sh
cd src-tauri && cargo metadata --format-version 1 | jq -r '.packages[] | "\(.name) \(.version) — \(.license)"'
```

## Marcas

"Notepad++" é marca de seu respectivo dono e é citada apenas como comparação. O PenaPad não tem relação com o Notepad++,
com a Microsoft ou com qualquer outro produto mencionado. O nome e o ícone de pena do PenaPad são originais.
