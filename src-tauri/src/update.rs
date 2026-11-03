//! Atualização automática pelos Releases do GitHub (arquivo latest.json, assinado com a chave do projeto).
//! A interface pergunta antes de instalar; a sessão é gravada antes de o app reiniciar.

use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_updater::{Update, UpdaterExt};

/// Atualização encontrada e ainda não instalada
#[derive(Default)]
pub struct Pending(pub Mutex<Option<Update>>);

#[derive(Serialize)]
pub struct Info {
    version: String,
    current: String,
    notes: Option<String>,
    /// false = este tipo de instalação não se atualiza sozinho (.deb, .rpm, Flatpak): mostrar o link
    can_install: bool,
}

/// Instalações que o PenaPad consegue atualizar sozinho
fn can_self_update() -> bool {
    if cfg!(target_os = "linux") {
        // Só o AppImage; .deb/.rpm/Flatpak são atualizados pelo gerenciador de pacotes ou baixando de novo
        std::env::var_os("APPIMAGE").is_some()
    } else {
        true
    }
}

fn updater<R: Runtime>(app: &AppHandle<R>) -> Result<tauri_plugin_updater::Updater, String> {
    let mut b = app.updater_builder();
    // Para testes: outro endereço de latest.json
    if let Some(url) = std::env::var_os("PENAPAD_UPDATE_URL") {
        let url = url.to_string_lossy().parse().map_err(|e| format!("{e}"))?;
        b = b.endpoints(vec![url]).map_err(|e| e.to_string())?;
    }
    b.build().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_check(app: AppHandle) -> Result<Option<Info>, String> {
    if std::env::var_os("FLATPAK_ID").is_some() && std::env::var_os("PENAPAD_UPDATE_URL").is_none() {
        return Ok(None); // no Flatpak quem atualiza é o próprio Flatpak
    }
    let found = updater(&app)?.check().await.map_err(|e| e.to_string())?;
    let Some(u) = found else { return Ok(None) };
    let info = Info { version: u.version.clone(), current: u.current_version.clone(), notes: u.body.clone(), can_install: can_self_update() };
    *app.state::<Pending>().0.lock().unwrap() = Some(u);
    Ok(Some(info))
}

/// Endereços que a interface pode abrir no navegador (lista fechada: a página não abre links arbitrários)
pub const DONATE_URL: &str = ""; // ex.: "https://ko-fi.com/…" — vazio esconde o botão de apoio

fn link_url(kind: &str) -> Option<String> {
    const REPO: &str = "https://github.com/RicardoPenaDev/PenaPad";
    Some(match kind {
        "site" => REPO.to_string(),
        "issues" => format!("{REPO}/issues/new"),
        "license" => format!("{REPO}/blob/main/LICENSE"),
        "notices" => format!("{REPO}/blob/main/THIRD_PARTY_NOTICES.md"),
        "releases" => format!("{REPO}/releases"),
        "donate" if !DONATE_URL.is_empty() => DONATE_URL.to_string(),
        _ => return None,
    })
}

fn open_in_browser(url: &str) {
    #[cfg(target_os = "macos")]
    let r = std::process::Command::new("open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let r = std::process::Command::new("explorer").arg(url).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let r = std::process::Command::new("xdg-open").arg(url).spawn();
    let _ = r;
}

#[tauri::command]
pub fn open_link(kind: String) {
    if let Some(url) = link_url(&kind) {
        open_in_browser(&url);
    }
}

/// Se há link de apoio configurado (mostra o botão "Pague um café")
#[tauri::command]
pub fn donate_enabled() -> bool {
    !DONATE_URL.is_empty()
}

/// Abre a página da versão no navegador
#[tauri::command]
pub fn open_releases(version: Option<String>) {
    let url = match version {
        Some(v) if v.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-') => format!("https://github.com/RicardoPenaDev/PenaPad/releases/tag/v{v}"),
        _ => "https://github.com/RicardoPenaDev/PenaPad/releases/latest".to_string(),
    };
    open_in_browser(&url);
}

/// Baixa, confere a assinatura, instala e reinicia. A interface já gravou a sessão antes de chamar.
#[tauri::command]
pub async fn update_install(app: AppHandle) -> Result<(), String> {
    let u = app.state::<Pending>().0.lock().unwrap().take().ok_or("nenhuma atualização pendente")?;
    u.download_and_install(|_, _| {}, || {}).await.map_err(|e| e.to_string())?;
    crate::allow_exit(&app);
    app.restart();
}

#[cfg(test)]
mod tests {
    use super::link_url;

    #[test]
    fn so_abre_enderecos_conhecidos() {
        assert_eq!(link_url("site").as_deref(), Some("https://github.com/RicardoPenaDev/PenaPad"));
        assert!(link_url("https://exemplo.com").is_none());
        assert!(link_url("../etc").is_none());
    }
}
