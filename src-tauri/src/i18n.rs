//! Idioma dos menus e janelas nativas (o mesmo da interface). Os textos ficam em português no código;
//! `tr()` devolve a tradução em inglês quando o idioma é inglês.

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};

static EN: AtomicBool = AtomicBool::new(false);

pub fn en() -> bool {
    EN.load(Ordering::Relaxed)
}

/// "auto" segue o idioma do sistema
pub fn resolve(pref: &str) -> bool {
    match pref {
        "en" => true,
        "pt" => false,
        _ => !sys_locale::get_locale().unwrap_or_default().to_lowercase().starts_with("pt"),
    }
}

/// Idioma ao abrir: a escolha gravada (arquivo `language` na pasta de dados) ou o do sistema
pub fn init(data_dir: &Path) {
    let pref = std::fs::read_to_string(data_dir.join("language")).unwrap_or_default();
    EN.store(resolve(pref.trim()), Ordering::Relaxed);
}

/// Grava a escolha e aplica. Devolve true se o idioma mudou.
pub fn set(data_dir: &Path, pref: &str) -> bool {
    let _ = std::fs::write(data_dir.join("language"), pref);
    let new = resolve(pref);
    EN.swap(new, Ordering::Relaxed) != new
}

pub fn tr(pt: &'static str) -> &'static str {
    if !en() {
        return pt;
    }
    english(pt).unwrap_or(pt)
}

fn english(pt: &str) -> Option<&'static str> {
    Some(match pt {
        // Menus
        "Arquivo" => "File",
        "Editar" => "Edit",
        "Visualizar" => "View",
        "Janela" => "Window",
        "Linhas" => "Lines",
        "Seleção e Cursores" => "Selection and Cursors",
        "Idioma" => "Language",
        "Automático (do sistema)" => "Automatic (system)",
        "PenaPad" => "PenaPad",
        "Sobre o PenaPad" => "About PenaPad",
        "Serviços" => "Services",
        "Ocultar PenaPad" => "Hide PenaPad",
        "Ocultar Outros" => "Hide Others",
        "Mostrar Tudo" => "Show All",
        "Encerrar PenaPad" => "Quit PenaPad",
        "Procurar Atualizações…" => "Check for Updates…",
        "Novo" => "New",
        "Abrir…" => "Open…",
        "Salvar" => "Save",
        "Salvar Como…" => "Save As…",
        "Fechar Aba" => "Close Tab",
        "Reabrir Aba Fechada" => "Reopen Closed Tab",
        "Histórico de Versões…" => "Version History…",
        "Comparar Textos…" => "Compare Texts…",
        "Desfazer" => "Undo",
        "Refazer" => "Redo",
        "Recortar" => "Cut",
        "Copiar" => "Copy",
        "Colar" => "Paste",
        "Selecionar Tudo" => "Select All",
        "Comentar/Descomentar Linha" => "Toggle Line Comment",
        "Formatar Documento" => "Format Document",
        "Formatar JSON" => "Format JSON",
        "Localizar…" => "Find…",
        "Substituir…" => "Replace…",
        "Localizar Próxima" => "Find Next",
        "Localizar Anterior" => "Find Previous",
        "Ir para Linha…" => "Go to Line…",
        "Paleta de Comandos…" => "Command Palette…",
        "Quebra Automática de Linha" => "Word Wrap",
        "Minimapa" => "Minimap",
        "Números de Linha" => "Line Numbers",
        "Dividir Tela" => "Split View",
        "Mover Aba para o Outro Lado" => "Move Tab to the Other Side",
        "Alternar Lado a Lado / Empilhado" => "Toggle Side by Side / Stacked",
        "Aumentar Zoom" => "Zoom In",
        "Diminuir Zoom" => "Zoom Out",
        "Zoom 100%" => "Zoom 100%",
        "Tema Claro" => "Light Theme",
        "Tema Escuro" => "Dark Theme",
        "Tema do Sistema" => "System Theme",
        "Tela Cheia" => "Full Screen",
        "Minimizar" => "Minimize",
        "Zoom" => "Zoom",
        "Duplicar Linha" => "Duplicate Line",
        "Mover Linha para Cima" => "Move Line Up",
        "Mover Linha para Baixo" => "Move Line Down",
        "Excluir Linha" => "Delete Line",
        "Ordenar (A→Z)" => "Sort (A→Z)",
        "Ordenar (Z→A)" => "Sort (Z→A)",
        "Remover Linhas Duplicadas" => "Remove Duplicate Lines",
        "Remover Linhas Vazias" => "Remove Empty Lines",
        "Remover Espaços no Início e no Fim" => "Trim Leading and Trailing Spaces",
        "Remover Espaços no Fim" => "Trim Trailing Spaces",
        "Adicionar Prefixo…" => "Add Prefix…",
        "Adicionar Sufixo…" => "Add Suffix…",
        "MAIÚSCULAS" => "UPPERCASE",
        "minúsculas" => "lowercase",
        "Selecionar Próxima Ocorrência" => "Select Next Occurrence",
        "Selecionar Todas as Ocorrências" => "Select All Occurrences",
        "Modo Seleção em Coluna (ou ⌥ + arrastar)" => "Column Selection Mode (or ⌥ + drag)",
        "Modo Seleção em Coluna (ou Alt + arrastar)" => "Column Selection Mode (or Alt + drag)",
        "Cursor Extra: ⌘ + clique" => "Extra Cursor: ⌘ + click",
        "Cursor Extra: Ctrl + clique" => "Extra Cursor: Ctrl + click",
        // Janelas de aviso
        "Não foi possível abrir o arquivo" => "The file could not be opened",
        "Sem título.txt" => "Untitled.txt",
        "Suas alterações serão perdidas se você não salvá-las." => "Your changes will be lost if you don't save them.",
        "Não Salvar" => "Don't Save",
        "Cancelar" => "Cancel",
        "Comparar" => "Compare",
        "Sobrescrever" => "Overwrite",
        "Se salvar agora, as alterações feitas fora do PenaPad serão perdidas. Você pode comparar as duas versões antes de decidir." => {
            "If you save now, the changes made outside PenaPad will be lost. You can compare both versions before deciding."
        }
        "O PenaPad não conseguiu guardar a sessão" => "PenaPad could not save the session",
        "Continuar no PenaPad" => "Stay in PenaPad",
        "Sair Mesmo Assim" => "Quit Anyway",
        "Editor de texto e código leve." => "Lightweight text and code editor.",
        "© 2026 Ricardo Pena · Licença MIT" => "© 2026 Ricardo Pena · MIT License",
        "Feito com Tauri, React e Monaco Editor (MIT, © Microsoft). Componentes de terceiros: THIRD_PARTY_NOTICES.md no repositório." => {
            "Built with Tauri, React and Monaco Editor (MIT, © Microsoft). Third-party components: THIRD_PARTY_NOTICES.md in the repository."
        }
        // Sessão
        "a lista de abas estava danificada" => "the tab list was damaged",
        "as abas foram restauradas da cópia anterior" => "the tabs were restored from the previous copy",
        "sem permissão para gravar na pasta de dados" => "no permission to write to the data folder",
        "o disco está cheio" => "the disk is full",
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Todo `tr("…")` do código precisa ter tradução
    #[test]
    fn todo_texto_tem_traducao() {
        let src = [include_str!("lib.rs"), include_str!("session.rs")].concat();
        let mut faltando = Vec::new();
        let mut rest = src.as_str();
        while let Some(i) = rest.find("tr(\"") {
            let after = &rest[i + 4..];
            let end = after.find("\")").or_else(|| after.find('"')).unwrap();
            let key = &after[..end];
            if english(key).is_none() && !faltando.contains(&key) {
                faltando.push(key);
            }
            rest = &after[end..];
        }
        // textos dentro de tr(if … { "a" } else { "b" })
        for k in ["Modo Seleção em Coluna (ou ⌥ + arrastar)", "Modo Seleção em Coluna (ou Alt + arrastar)", "Cursor Extra: ⌘ + clique", "Cursor Extra: Ctrl + clique"] {
            assert!(english(k).is_some(), "{k}");
        }
        assert!(faltando.is_empty(), "sem tradução: {faltando:?}");
    }

    #[test]
    fn escolha_explicita_ganha_do_sistema() {
        assert!(resolve("en"));
        assert!(!resolve("pt"));
    }
}
