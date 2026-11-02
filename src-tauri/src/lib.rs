mod history;

use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, RunEvent, Runtime, WebviewWindow, WindowEvent};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind, MessageDialogResult};

#[derive(Default)]
struct AppState {
    force_quit: bool,
    quitting: bool,
    ready: bool,
    pending: Vec<PathBuf>,
}

type State = Mutex<AppState>;

#[derive(Serialize, Clone)]
struct Doc {
    path: String,
    name: String,
    content: String,
    encoding: &'static str,
    eol: &'static str,
    mtime: f64,
    size: u64,
}

#[derive(Serialize, Clone)]
struct Saved {
    path: String,
    name: String,
    mtime: f64,
    size: u64,
}

#[derive(Serialize, Clone)]
struct Stat {
    mtime: f64,
    size: u64,
}

/// Data de modificação (ms) e tamanho: usados para perceber alterações feitas por outros programas
fn stat(p: &Path) -> Option<Stat> {
    let m = std::fs::metadata(p).ok()?;
    let mtime = m
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs_f64() * 1000.0)
        .unwrap_or(0.0);
    Some(Stat { mtime, size: m.len() })
}

#[derive(Serialize, Clone)]
struct MenuPayload {
    cmd: String,
    arg: Option<String>,
}

// ---------- Codificação ----------

fn decode(buf: &[u8]) -> (String, &'static str) {
    let utf16 = |bytes: &[u8], be: bool| -> String {
        let units: Vec<u16> = bytes
            .chunks_exact(2)
            .map(|c| if be { u16::from_be_bytes([c[0], c[1]]) } else { u16::from_le_bytes([c[0], c[1]]) })
            .collect();
        String::from_utf16_lossy(&units)
    };
    if buf.starts_with(&[0xFF, 0xFE]) {
        return (utf16(&buf[2..], false), "utf16le");
    }
    if buf.starts_with(&[0xFE, 0xFF]) {
        return (utf16(&buf[2..], true), "utf16le");
    }
    if buf.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return (String::from_utf8_lossy(&buf[3..]).into_owned(), "utf8");
    }
    if !buf.is_empty() && buf.is_ascii() {
        return (String::from_utf8_lossy(buf).into_owned(), "ascii");
    }
    match std::str::from_utf8(buf) {
        Ok(s) => (s.to_owned(), "utf8"),
        // Não é UTF-8 válido: interpreta como Latin-1 (salvará em UTF-8)
        Err(_) => (buf.iter().map(|&b| b as char).collect(), "utf8"),
    }
}

fn encode(text: &str, encoding: &str) -> Vec<u8> {
    match encoding {
        "utf16le" => {
            let mut out = vec![0xFF, 0xFE];
            for u in text.encode_utf16() {
                out.extend_from_slice(&u.to_le_bytes());
            }
            out
        }
        "ascii" => text.chars().map(|c| if c.is_ascii() { c as u8 } else { b'?' }).collect(),
        _ => text.as_bytes().to_vec(),
    }
}

fn file_name(p: &Path) -> String {
    p.file_name().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default()
}

fn read_doc(p: &Path) -> Result<Doc, String> {
    let st = stat(p).ok_or_else(|| "arquivo não encontrado".to_string())?;
    let buf = std::fs::read(p).map_err(|e| e.to_string())?;
    let (content, encoding) = decode(&buf);
    let eol = if content.contains("\r\n") { "CRLF" } else { "LF" };
    Ok(Doc { path: p.to_string_lossy().into_owned(), name: file_name(p), content, encoding, eol, mtime: st.mtime, size: st.size })
}

fn read_many<R: Runtime>(app: &AppHandle<R>, paths: &[PathBuf]) -> Vec<Doc> {
    let mut docs = Vec::new();
    for p in paths {
        if !p.is_file() {
            continue;
        }
        match read_doc(p) {
            Ok(d) => docs.push(d),
            Err(e) => {
                app.dialog()
                    .message(format!("{}\n\n{}", p.display(), e))
                    .title("Não foi possível abrir o arquivo")
                    .kind(MessageDialogKind::Error)
                    .show(|_| {});
            }
        }
    }
    docs
}

fn main_window<R: Runtime>(app: &AppHandle<R>) -> Option<WebviewWindow<R>> {
    app.get_webview_window("main")
}

// ---------- Comandos ----------

#[tauri::command]
fn renderer_ready(app: AppHandle, state: tauri::State<State>) -> Vec<Doc> {
    let pending = {
        let mut s = state.lock().unwrap();
        s.ready = true;
        std::mem::take(&mut s.pending)
    };
    if let Some(w) = main_window(&app) {
        let _ = w.show();
        let _ = w.set_focus();
    }
    read_many(&app, &pending)
}

#[tauri::command]
async fn open_files(app: AppHandle, window: WebviewWindow) -> Vec<Doc> {
    let picked = app.dialog().file().set_parent(&window).blocking_pick_files();
    let paths: Vec<PathBuf> = picked.unwrap_or_default().into_iter().filter_map(|f| f.into_path().ok()).collect();
    read_many(&app, &paths)
}

#[tauri::command]
async fn open_paths(app: AppHandle, paths: Vec<String>) -> Vec<Doc> {
    let paths: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    read_many(&app, &paths)
}

#[tauri::command]
async fn save_file(path: String, content: String, encoding: String) -> Result<Saved, String> {
    let p = PathBuf::from(&path);
    std::fs::write(&p, encode(&content, &encoding)).map_err(|e| e.to_string())?;
    let st = stat(&p).unwrap_or(Stat { mtime: 0.0, size: 0 });
    Ok(Saved { name: file_name(&p), path, mtime: st.mtime, size: st.size })
}

#[tauri::command]
async fn save_as(app: AppHandle, window: WebviewWindow, content: String, encoding: String, suggested_name: Option<String>) -> Result<Option<Saved>, String> {
    let chosen = app
        .dialog()
        .file()
        .set_parent(&window)
        .set_file_name(suggested_name.unwrap_or_else(|| "Sem título.txt".into()))
        .blocking_save_file();
    let Some(fp) = chosen else { return Ok(None) };
    let p = fp.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&p, encode(&content, &encoding)).map_err(|e| e.to_string())?;
    let st = stat(&p).unwrap_or(Stat { mtime: 0.0, size: 0 });
    Ok(Some(Saved { name: file_name(&p), path: p.to_string_lossy().into_owned(), mtime: st.mtime, size: st.size }))
}

#[tauri::command]
async fn confirm_close(app: AppHandle, window: WebviewWindow, name: String) -> String {
    let r = app
        .dialog()
        .message("Suas alterações serão perdidas se você não salvá-las.")
        .title(format!("Deseja salvar as alterações em \"{name}\"?"))
        .kind(MessageDialogKind::Warning)
        .parent(&window)
        .buttons(MessageDialogButtons::YesNoCancelCustom("Salvar".into(), "Não Salvar".into(), "Cancelar".into()))
        .blocking_show_with_result();
    match r {
        MessageDialogResult::Yes => "save",
        MessageDialogResult::No => "discard",
        MessageDialogResult::Custom(s) if s == "Salvar" => "save",
        MessageDialogResult::Custom(s) if s == "Não Salvar" => "discard",
        _ => "cancel",
    }
    .into()
}

#[tauri::command]
async fn stat_paths(paths: Vec<String>) -> Vec<Option<Stat>> {
    paths.iter().map(|p| stat(Path::new(p))).collect()
}

/// Antes de salvar por cima de um arquivo que outro programa alterou
#[tauri::command]
async fn confirm_overwrite(app: AppHandle, window: WebviewWindow, name: String) -> String {
    let r = app
        .dialog()
        .message("Se salvar agora, as alterações feitas fora do PenaPad serão perdidas. Você pode comparar as duas versões antes de decidir.")
        .title(format!("\"{name}\" foi alterado por outro programa"))
        .kind(MessageDialogKind::Warning)
        .parent(&window)
        .buttons(MessageDialogButtons::YesNoCancelCustom("Comparar".into(), "Sobrescrever".into(), "Cancelar".into()))
        .blocking_show_with_result();
    match r {
        MessageDialogResult::Yes => "compare",
        MessageDialogResult::No => "overwrite",
        MessageDialogResult::Custom(s) if s == "Comparar" => "compare",
        MessageDialogResult::Custom(s) if s == "Sobrescrever" => "overwrite",
        _ => "cancel",
    }
    .into()
}

#[tauri::command]
fn set_title(window: WebviewWindow, title: String) {
    let _ = window.set_title(&title);
}

#[tauri::command]
fn set_theme(window: WebviewWindow, mode: String) {
    let theme = match mode.as_str() {
        "light" => Some(tauri::Theme::Light),
        "dark" => Some(tauri::Theme::Dark),
        _ => None,
    };
    let _ = window.set_theme(theme);
}

#[tauri::command]
fn quit(app: AppHandle, state: tauri::State<State>) {
    state.lock().unwrap().force_quit = true;
    app.exit(0);
}

// ---------- Sessão (mantém o que estava escrito ao fechar, como no Notepad++) ----------

fn session_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    // PENAPAD_DATA_DIR: pasta separada para testes, sem tocar na sessão de uso normal
    let dir = match std::env::var_os("PENAPAD_DATA_DIR") {
        Some(d) => PathBuf::from(d),
        None => app.path().app_data_dir().map_err(|e| e.to_string())?,
    };
    std::fs::create_dir_all(dir.join("backup")).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Grava de forma atômica (arquivo temporário + rename): nunca deixa um backup pela metade.
pub(crate) fn write_atomic(path: &Path, data: &[u8]) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, data).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())
}

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

#[derive(Serialize)]
struct SessionData {
    meta: Option<String>,
    backups: HashMap<String, String>,
}

#[tauri::command]
async fn session_load(app: AppHandle) -> Result<SessionData, String> {
    let dir = session_dir(&app)?;
    history::prune(&dir);
    let meta = std::fs::read_to_string(dir.join("session.json")).ok();
    let mut backups = HashMap::new();
    if let Ok(entries) = std::fs::read_dir(dir.join("backup")) {
        for e in entries.flatten() {
            let p = e.path();
            if p.extension().and_then(|x| x.to_str()) != Some("txt") {
                continue;
            }
            let Some(id) = p.file_stem().and_then(|x| x.to_str()).map(str::to_owned) else { continue };
            if let Ok(text) = std::fs::read_to_string(&p) {
                backups.insert(id, text);
            }
        }
    }
    Ok(SessionData { meta, backups })
}

/// Grava/remove o backup do conteúdo de uma aba (None = a aba não precisa de backup).
#[tauri::command]
async fn session_backup(app: AppHandle, id: String, content: Option<String>) -> Result<(), String> {
    if !valid_id(&id) {
        return Err("id inválido".into());
    }
    let path = session_dir(&app)?.join("backup").join(format!("{id}.txt"));
    match content {
        Some(c) => write_atomic(&path, c.as_bytes()),
        None => {
            let _ = std::fs::remove_file(&path);
            Ok(())
        }
    }
}

/// Grava a lista de abas e apaga backups de abas que não existem mais.
#[tauri::command]
async fn session_save(app: AppHandle, meta: String, keep: Vec<String>) -> Result<(), String> {
    let dir = session_dir(&app)?;
    write_atomic(&dir.join("session.json"), meta.as_bytes())?;
    if let Ok(entries) = std::fs::read_dir(dir.join("backup")) {
        for e in entries.flatten() {
            let p = e.path();
            let stem = p.file_stem().and_then(|x| x.to_str()).unwrap_or_default().to_owned();
            if !keep.iter().any(|k| *k == stem) {
                let _ = std::fs::remove_file(&p);
            }
        }
    }
    Ok(())
}

// ---------- Histórico local de versões ----------

#[tauri::command]
async fn history_save(app: AppHandle, key: String, name: String, reason: String, content: String) -> Result<Option<history::Entry>, String> {
    history::save(&session_dir(&app)?, &key, &name, &reason, &content)
}

#[tauri::command]
async fn history_list(app: AppHandle, key: String) -> Result<Vec<history::Entry>, String> {
    Ok(history::list(&session_dir(&app)?, &key))
}

#[tauri::command]
async fn history_read(app: AppHandle, key: String, id: String) -> Result<String, String> {
    history::read(&session_dir(&app)?, &key, &id)
}

#[tauri::command]
async fn history_rename(app: AppHandle, from: String, to: String) -> Result<(), String> {
    history::rename(&session_dir(&app)?, &from, &to)
}

// ---------- Diagnóstico (só com PENAPAD_DEBUG definido; usado nos testes) ----------

#[tauri::command]
fn debug_enabled() -> bool {
    std::env::var_os("PENAPAD_DEBUG").is_some()
}

#[tauri::command]
async fn debug_write(app: AppHandle, text: String) -> Result<(), String> {
    if std::env::var_os("PENAPAD_DEBUG").is_none() {
        return Ok(());
    }
    write_atomic(&session_dir(&app)?.join("debug.json"), text.as_bytes())
}

/// Próximo comando de teste (arquivo `cmd.txt` na pasta de dados), consumido ao ler
#[tauri::command]
async fn debug_take_cmd(app: AppHandle) -> Option<String> {
    std::env::var_os("PENAPAD_DEBUG")?;
    let p = session_dir(&app).ok()?.join("cmd.txt");
    let s = std::fs::read_to_string(&p).ok()?;
    let _ = std::fs::remove_file(&p);
    Some(s)
}

/// Lê arquivos da sessão anterior sem mostrar erro (arquivos apagados são ignorados).
#[tauri::command]
async fn read_paths_quiet(paths: Vec<String>) -> Vec<Option<Doc>> {
    paths.into_iter().map(|p| read_doc(Path::new(&p)).ok()).collect()
}

// ---------- Submenus compartilhados (menu principal e clique direito) ----------

fn lines_submenu<R: Runtime>(app: &AppHandle<R>, prefix: &str) -> tauri::Result<tauri::menu::Submenu<R>> {
    let it = |id: &str, label: &str, accel: Option<&str>| {
        let mut b = MenuItemBuilder::with_id(format!("{prefix}{id}"), label);
        if let Some(a) = accel {
            b = b.accelerator(a);
        }
        b.build(app)
    };
    SubmenuBuilder::new(app, "Linhas")
        .item(&it("duplicate", "Duplicar Linha", Some("Shift+Alt+Down"))?)
        .item(&it("moveUp", "Mover Linha para Cima", Some("Alt+Up"))?)
        .item(&it("moveDown", "Mover Linha para Baixo", Some("Alt+Down"))?)
        .item(&it("deleteLine", "Excluir Linha", Some("CmdOrCtrl+Shift+K"))?)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&it("sortAsc", "Ordenar (A→Z)", None)?)
        .item(&it("sortDesc", "Ordenar (Z→A)", None)?)
        .item(&it("dedupe", "Remover Linhas Duplicadas", None)?)
        .item(&it("removeEmpty", "Remover Linhas Vazias", None)?)
        .item(&it("trimBoth", "Remover Espaços no Início e no Fim", None)?)
        .item(&it("trim", "Remover Espaços no Fim", None)?)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&it("prefix", "Adicionar Prefixo…", None)?)
        .item(&it("suffix", "Adicionar Sufixo…", None)?)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&it("upper", "MAIÚSCULAS", None)?)
        .item(&it("lower", "minúsculas", None)?)
        .build()
}

fn selection_submenu<R: Runtime>(app: &AppHandle<R>, prefix: &str) -> tauri::Result<tauri::menu::Submenu<R>> {
    let it = |id: &str, label: &str, accel: Option<&str>, enabled: bool| {
        let mut b = MenuItemBuilder::with_id(format!("{prefix}{id}"), label).enabled(enabled);
        if let Some(a) = accel {
            b = b.accelerator(a);
        }
        b.build(app)
    };
    SubmenuBuilder::new(app, "Seleção e Cursores")
        .item(&it("addNextOccurrence", "Selecionar Próxima Ocorrência", Some("CmdOrCtrl+D"), true)?)
        .item(&it("selectOccurrences", "Selecionar Todas as Ocorrências", Some("CmdOrCtrl+Shift+L"), true)?)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&it("columnSelection", "Modo Seleção em Coluna (ou ⌥ + arrastar)", None, true)?)
        .item(&it("info-cursor", "Cursor Extra: ⌘ + clique", None, false)?)
        .build()
}

// ---------- Menu de contexto nativo ----------

#[tauri::command]
fn show_context_menu(app: AppHandle, window: WebviewWindow, has_selection: bool, can_undo: bool, can_redo: bool) -> Result<(), String> {
    let item = |id: &str, label: &str, accel: Option<&str>, enabled: bool| {
        let mut b = MenuItemBuilder::with_id(format!("ctx-{id}"), label).enabled(enabled);
        if let Some(a) = accel {
            b = b.accelerator(a);
        }
        b.build(&app)
    };
    let sep = || PredefinedMenuItem::separator(&app);
    let build = || -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
        let lines = lines_submenu(&app, "ctx-")?;
        let selection = selection_submenu(&app, "ctx-")?;
        MenuBuilder::new(&app)
            .item(&item("undo", "Desfazer", Some("CmdOrCtrl+Z"), can_undo)?)
            .item(&item("redo", "Refazer", Some("CmdOrCtrl+Shift+Z"), can_redo)?)
            .item(&sep()?)
            .item(&item("cut", "Recortar", Some("CmdOrCtrl+X"), has_selection)?)
            .item(&item("copy", "Copiar", Some("CmdOrCtrl+C"), has_selection)?)
            .item(&item("paste", "Colar", Some("CmdOrCtrl+V"), true)?)
            .item(&item("selectAll", "Selecionar Tudo", Some("CmdOrCtrl+A"), true)?)
            .item(&sep()?)
            .item(&selection)
            .item(&lines)
            .item(&sep()?)
            .item(&item("comment", "Comentar/Descomentar Linha", Some("CmdOrCtrl+/"), true)?)
            .item(&item("format", "Formatar Documento", Some("Shift+Alt+F"), true)?)
            .item(&item("formatJson", "Formatar JSON", None, true)?)
            .build()
    };
    let menu = build().map_err(|e| e.to_string())?;
    window.popup_menu(&menu).map_err(|e| e.to_string())
}

/// Clique direito numa aba: mover para a outra vista / fechar
#[tauri::command]
fn show_tab_menu(app: AppHandle, window: WebviewWindow, tab_id: String, move_label: String) -> Result<(), String> {
    if !valid_id(&tab_id) {
        return Err("id inválido".into());
    }
    let menu = MenuBuilder::new(&app)
        .item(&MenuItemBuilder::with_id(format!("ctx-moveOther:{tab_id}"), move_label).build(&app).map_err(|e| e.to_string())?)
        .item(&PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?)
        .item(&MenuItemBuilder::with_id(format!("ctx-closeTab:{tab_id}"), "Fechar Aba").build(&app).map_err(|e| e.to_string())?)
        .item(&MenuItemBuilder::with_id(format!("ctx-history:{tab_id}"), "Histórico de Versões…").build(&app).map_err(|e| e.to_string())?)
        .item(&MenuItemBuilder::with_id("ctx-reopenClosed", "Reabrir Aba Fechada").accelerator("CmdOrCtrl+Shift+T").build(&app).map_err(|e| e.to_string())?)
        .build()
        .map_err(|e| e.to_string())?;
    window.popup_menu(&menu).map_err(|e| e.to_string())
}

#[tauri::command]
fn clipboard_read(app: AppHandle) -> String {
    app.clipboard().read_text().unwrap_or_default()
}

#[tauri::command]
fn clipboard_write(app: AppHandle, text: String) {
    let _ = app.clipboard().write_text(text);
}

// ---------- Saída: grava a sessão e encerra, sem perguntar ----------

fn request_quit<R: Runtime>(app: &AppHandle<R>) {
    {
        let s = app.state::<State>();
        let mut s = s.lock().unwrap();
        if s.force_quit {
            drop(s);
            app.exit(0);
            return;
        }
        if s.quitting {
            return;
        }
        s.quitting = true;
    }
    // A interface grava o que falta e chama `quit`. Se não responder, sai mesmo assim.
    let _ = app.emit("session-flush", ());
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(4));
        handle.state::<State>().lock().unwrap().force_quit = true;
        handle.exit(0);
    });
}

// ---------- Menu nativo ----------

fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<tauri::menu::Menu<R>> {
    let it = |id: &str, label: &str, accel: Option<&str>| {
        let mut b = MenuItemBuilder::with_id(id, label);
        if let Some(a) = accel {
            b = b.accelerator(a);
        }
        b.build(app)
    };
    let sep = || PredefinedMenuItem::separator(app);

    let about = AboutMetadata {
        name: Some("PenaPad".into()),
        version: Some(app.package_info().version.to_string()),
        comments: Some("Editor de texto e código leve para macOS.".into()),
        website: Some("https://github.com/RicardoPenaDev/PenaPad".into()),
        website_label: Some("github.com/RicardoPenaDev/PenaPad".into()),
        copyright: Some("© 2026 Ricardo Pena · Licença MIT".into()),
        credits: Some("Feito com Tauri, React e Monaco Editor (MIT, © Microsoft). Componentes de terceiros: THIRD_PARTY_NOTICES.md no repositório.".into()),
        ..Default::default()
    };

    let app_menu = SubmenuBuilder::new(app, "PenaPad")
        .item(&PredefinedMenuItem::about(app, Some("Sobre o PenaPad"), Some(about))?)
        .item(&sep()?)
        .item(&PredefinedMenuItem::services(app, Some("Serviços"))?)
        .item(&sep()?)
        .item(&PredefinedMenuItem::hide(app, Some("Ocultar PenaPad"))?)
        .item(&PredefinedMenuItem::hide_others(app, Some("Ocultar Outros"))?)
        .item(&PredefinedMenuItem::show_all(app, Some("Mostrar Tudo"))?)
        .item(&sep()?)
        .item(&it("quit", "Encerrar PenaPad", Some("CmdOrCtrl+Q"))?)
        .build()?;

    let file = SubmenuBuilder::new(app, "Arquivo")
        .item(&it("new", "Novo", Some("CmdOrCtrl+N"))?)
        .item(&it("open", "Abrir…", Some("CmdOrCtrl+O"))?)
        .item(&sep()?)
        .item(&it("save", "Salvar", Some("CmdOrCtrl+S"))?)
        .item(&it("saveAs", "Salvar Como…", Some("CmdOrCtrl+Shift+S"))?)
        .item(&sep()?)
        .item(&it("close", "Fechar Aba", Some("CmdOrCtrl+W"))?)
        .item(&it("reopenClosed", "Reabrir Aba Fechada", Some("CmdOrCtrl+Shift+T"))?)
        .item(&it("history", "Histórico de Versões…", Some("CmdOrCtrl+Shift+H"))?)
        .item(&sep()?)
        .item(&it("compare", "Comparar Textos…", None)?)
        .build()?;

    let edit = SubmenuBuilder::new(app, "Editar")
        .item(&it("undo", "Desfazer", Some("CmdOrCtrl+Z"))?)
        .item(&it("redo", "Refazer", Some("CmdOrCtrl+Shift+Z"))?)
        .item(&sep()?)
        .item(&PredefinedMenuItem::cut(app, Some("Recortar"))?)
        .item(&PredefinedMenuItem::copy(app, Some("Copiar"))?)
        .item(&PredefinedMenuItem::paste(app, Some("Colar"))?)
        .item(&it("selectAll", "Selecionar Tudo", Some("CmdOrCtrl+A"))?)
        .item(&sep()?)
        .item(&selection_submenu(app, "")?)
        .item(&lines_submenu(app, "")?)
        .item(&sep()?)
        .item(&it("comment", "Comentar/Descomentar Linha", Some("CmdOrCtrl+/"))?)
        .item(&it("format", "Formatar Documento", Some("Shift+Alt+F"))?)
        .item(&it("formatJson", "Formatar JSON", None)?)
        .item(&sep()?)
        .item(&it("find", "Localizar…", Some("CmdOrCtrl+F"))?)
        .item(&it("replace", "Substituir…", Some("CmdOrCtrl+Alt+F"))?)
        .item(&it("findNext", "Localizar Próxima", Some("CmdOrCtrl+G"))?)
        .item(&it("findPrev", "Localizar Anterior", Some("CmdOrCtrl+Shift+G"))?)
        .item(&it("gotoLine", "Ir para Linha…", Some("Ctrl+G"))?)
        .build()?;

    let view = SubmenuBuilder::new(app, "Visualizar")
        .item(&it("palette", "Paleta de Comandos…", Some("CmdOrCtrl+Shift+P"))?)
        .item(&sep()?)
        .item(&it("wordWrap", "Quebra Automática de Linha", Some("Alt+Z"))?)
        .item(&it("minimap", "Minimapa", None)?)
        .item(&it("lineNumbers", "Números de Linha", None)?)
        .item(&sep()?)
        .item(&it("split", "Dividir Tela", Some("CmdOrCtrl+\\"))?)
        .item(&it("moveOther", "Mover Aba para o Outro Lado", None)?)
        .item(&it("rotateSplit", "Alternar Lado a Lado / Empilhado", None)?)
        .item(&it("compare", "Comparar Textos…", None)?)
        .item(&sep()?)
        .item(&it("zoomIn", "Aumentar Zoom", Some("CmdOrCtrl+="))?)
        .item(&it("zoomOut", "Diminuir Zoom", Some("CmdOrCtrl+-"))?)
        .item(&it("zoomReset", "Zoom 100%", Some("CmdOrCtrl+0"))?)
        .item(&sep()?)
        .item(&it("theme:light", "Tema Claro", None)?)
        .item(&it("theme:dark", "Tema Escuro", None)?)
        .item(&it("theme:system", "Tema do Sistema", None)?)
        .item(&sep()?)
        .item(&PredefinedMenuItem::fullscreen(app, Some("Tela Cheia"))?)
        .build()?;

    let window = SubmenuBuilder::new(app, "Janela")
        .item(&PredefinedMenuItem::minimize(app, Some("Minimizar"))?)
        .item(&PredefinedMenuItem::maximize(app, Some("Zoom"))?)
        .build()?;

    MenuBuilder::new(app).items(&[&app_menu, &file, &edit, &view, &window]).build()
}

// ---------- App ----------

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(State::default())
        .menu(build_menu)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            let id = id.strip_prefix("ctx-").unwrap_or(id);
            if id == "quit" {
                request_quit(app);
                return;
            }
            let (cmd, arg) = match id.split_once(':') {
                Some((c, a)) => (c.to_string(), Some(a.to_string())),
                None => (id.to_string(), None),
            };
            let _ = app.emit("menu", MenuPayload { cmd, arg });
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                let force = app.state::<State>().lock().unwrap().force_quit;
                if !force {
                    api.prevent_close();
                    request_quit(app);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            renderer_ready,
            open_files,
            open_paths,
            save_file,
            save_as,
            confirm_close,
            session_load,
            session_backup,
            session_save,
            read_paths_quiet,
            show_context_menu,
            show_tab_menu,
            stat_paths,
            history_save,
            history_list,
            history_read,
            history_rename,
            debug_enabled,
            debug_write,
            debug_take_cmd,
            confirm_overwrite,
            set_title,
            set_theme,
            quit,
            clipboard_read,
            clipboard_write
        ])
        .build(tauri::generate_context!())
        .expect("erro ao iniciar o PenaPad")
        .run(|app, event| match event {
            #[cfg(target_os = "macos")]
            RunEvent::Opened { urls } => {
                let paths: Vec<PathBuf> = urls.iter().filter_map(|u| u.to_file_path().ok()).collect();
                let ready = {
                    let s = app.state::<State>();
                    let mut s = s.lock().unwrap();
                    if !s.ready {
                        s.pending.extend(paths.clone());
                    }
                    s.ready
                };
                if ready {
                    for d in read_many(app, &paths) {
                        let _ = app.emit("file-opened", d);
                    }
                }
            }
            RunEvent::ExitRequested { api, code, .. } => {
                let force = app.state::<State>().lock().unwrap().force_quit;
                if code.is_none() && !force {
                    api.prevent_exit();
                    request_quit(app);
                }
            }
            _ => {}
        });
}
