//! Sessão em disco: lista de abas (`session.json`) e o texto das abas não salvas (`backup/<id>.txt`).
//!
//! Regras para nunca perder texto:
//! - toda gravação é atômica (arquivo temporário + fsync + rename);
//! - a versão anterior da lista de abas fica em `session.prev.json`, usada se a atual estiver estragada;
//! - uma lista estragada ou de formato desconhecido é guardada à parte (`session.corrupt-<data>.json`), nunca apagada;
//! - backups só são apagados quando a interface confirma que restaurou a sessão (`prune`).

use serde::Serialize;
use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};

pub const SESSION_VERSION: u64 = 1;
const KEEP_CORRUPT: usize = 5;

/// Grava de forma atômica: nunca deixa um arquivo pela metade, nem após queda de energia.
pub fn write_atomic(path: &Path, data: &[u8]) -> Result<(), String> {
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("arquivo");
    let tmp = path.with_file_name(format!(".{name}.tmp"));
    let res = (|| -> std::io::Result<()> {
        let mut f = std::fs::File::create(&tmp)?;
        f.write_all(data)?;
        f.sync_all()?;
        drop(f);
        std::fs::rename(&tmp, path)
    })();
    if let Err(e) = res {
        let _ = std::fs::remove_file(&tmp);
        return Err(io_message(&e));
    }
    Ok(())
}

/// Erros de disco em português (os do sistema chegam em inglês)
pub fn io_message(e: &std::io::Error) -> String {
    use std::io::ErrorKind::*;
    match e.kind() {
        PermissionDenied | ReadOnlyFilesystem => "sem permissão para gravar na pasta de dados".into(),
        StorageFull | QuotaExceeded => "o disco está cheio".into(),
        _ => e.to_string(),
    }
}

#[derive(Serialize, Debug, Default)]
pub struct Loaded {
    /// Lista de abas válida (JSON), se houver
    pub meta: Option<String>,
    /// Texto de cada backup encontrado, pelo id da aba
    pub backups: HashMap<String, String>,
    /// O que aconteceu de anormal ao ler (mostrado ao usuário), ou None
    pub problem: Option<String>,
}

fn valid_meta(text: &str) -> Result<(), String> {
    let v: serde_json::Value = serde_json::from_str(text).map_err(|_| "a lista de abas estava danificada".to_string())?;
    match v.get("v").and_then(|x| x.as_u64()) {
        Some(SESSION_VERSION) => {}
        Some(n) => return Err(format!("a lista de abas é de outra versão do PenaPad (formato {n})")),
        None => return Err("a lista de abas estava danificada".into()),
    }
    if !v.get("tabs").map(|t| t.is_array()).unwrap_or(false) {
        return Err("a lista de abas estava danificada".into());
    }
    Ok(())
}

fn timestamp() -> String {
    let s = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    s.to_string()
}

/// Guarda um arquivo de sessão problemático para análise, mantendo só os mais recentes
fn quarantine(dir: &Path, file: &Path) {
    let dest = dir.join(format!("session.corrupt-{}.json", timestamp()));
    let _ = std::fs::rename(file, &dest);
    let mut old: Vec<PathBuf> = std::fs::read_dir(dir)
        .map(|r| r.flatten().map(|e| e.path()).filter(|p| p.file_name().and_then(|n| n.to_str()).is_some_and(|n| n.starts_with("session.corrupt-"))).collect())
        .unwrap_or_default();
    old.sort();
    while old.len() > KEEP_CORRUPT {
        let _ = std::fs::remove_file(old.remove(0));
    }
}

pub fn load(dir: &Path) -> Loaded {
    let mut out = Loaded::default();
    let cur = dir.join("session.json");
    let prev = dir.join("session.prev.json");
    let mut problems = Vec::new();
    for (i, p) in [&cur, &prev].into_iter().enumerate() {
        let Ok(bytes) = std::fs::read(p) else { continue };
        let text = String::from_utf8_lossy(&bytes).into_owned();
        match valid_meta(&text) {
            Ok(()) => {
                out.meta = Some(text);
                if i == 1 {
                    problems.push("as abas foram restauradas da cópia anterior".to_string());
                }
                break;
            }
            Err(e) => {
                if i == 0 {
                    problems.push(e);
                }
                quarantine(dir, p);
            }
        }
    }
    if let Ok(entries) = std::fs::read_dir(dir.join("backup")) {
        for e in entries.flatten() {
            let p = e.path();
            if p.extension().and_then(|x| x.to_str()) != Some("txt") {
                continue;
            }
            let Some(id) = p.file_stem().and_then(|x| x.to_str()).map(str::to_owned) else { continue };
            if id.starts_with('.') {
                continue; // temporário de uma gravação interrompida
            }
            // Bytes inválidos viram "�" em vez de o backup sumir
            if let Ok(bytes) = std::fs::read(&p) {
                out.backups.insert(id, String::from_utf8_lossy(&bytes).into_owned());
            }
        }
    }
    if !problems.is_empty() {
        out.problem = Some(problems.join("; "));
    }
    out
}

/// Grava a lista de abas. Com `prune`, apaga backups de abas que não existem mais.
pub fn save(dir: &Path, meta: &str, keep: &[String], prune: bool) -> Result<(), String> {
    valid_meta(meta).map_err(|e| format!("lista de abas inválida: {e}"))?;
    let cur = dir.join("session.json");
    // A anterior vira session.prev.json (se a nova falhar no meio, a anterior continua lá)
    if cur.exists() {
        let _ = std::fs::copy(&cur, dir.join("session.prev.json"));
    }
    write_atomic(&cur, meta.as_bytes())?;
    if prune {
        if let Ok(entries) = std::fs::read_dir(dir.join("backup")) {
            for e in entries.flatten() {
                let p = e.path();
                let stem = p.file_stem().and_then(|x| x.to_str()).unwrap_or_default().to_owned();
                if !keep.iter().any(|k| *k == stem) {
                    let _ = std::fs::remove_file(&p);
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("penapad-sess-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(d.join("backup")).unwrap();
        d
    }

    const META: &str = r#"{"v":1,"active":"a","tabs":[{"id":"a"}]}"#;
    const META2: &str = r#"{"v":1,"active":"b","tabs":[{"id":"b"}]}"#;

    fn corrupt_files(d: &Path) -> usize {
        std::fs::read_dir(d).unwrap().flatten().filter(|e| e.file_name().to_string_lossy().starts_with("session.corrupt-")).count()
    }

    #[test]
    fn sessao_normal() {
        let d = tmp("normal");
        std::fs::write(d.join("backup/a.txt"), "texto").unwrap();
        save(&d, META, &["a".into()], true).unwrap();
        let l = load(&d);
        assert_eq!(l.meta.as_deref(), Some(META));
        assert_eq!(l.backups.get("a").map(String::as_str), Some("texto"));
        assert!(l.problem.is_none());
    }

    #[test]
    fn sem_sessao_nao_e_problema() {
        let d = tmp("vazia");
        let l = load(&d);
        assert!(l.meta.is_none() && l.problem.is_none());
    }

    #[test]
    fn sessao_estragada_usa_a_anterior_e_guarda_a_estragada() {
        let d = tmp("estragada");
        save(&d, META, &[], true).unwrap();
        save(&d, META2, &[], true).unwrap(); // agora prev = META
        std::fs::write(d.join("session.json"), "{\"v\":1,\"tabs\":[{\"id\":").unwrap(); // cortada no meio
        let l = load(&d);
        assert_eq!(l.meta.as_deref(), Some(META), "volta para a cópia anterior");
        assert!(l.problem.unwrap().contains("cópia anterior"));
        assert_eq!(corrupt_files(&d), 1, "a estragada fica guardada");
    }

    #[test]
    fn sessao_e_anterior_estragadas_mantem_os_backups() {
        let d = tmp("tudo-estragado");
        std::fs::write(d.join("session.json"), "lixo").unwrap();
        std::fs::write(d.join("session.prev.json"), "").unwrap();
        std::fs::write(d.join("backup/x.txt"), "rascunho importante").unwrap();
        let l = load(&d);
        assert!(l.meta.is_none());
        assert!(l.problem.is_some());
        assert_eq!(l.backups.get("x").map(String::as_str), Some("rascunho importante"));
    }

    #[test]
    fn formato_de_outra_versao_nao_e_sobrescrito_sem_guardar() {
        let d = tmp("versao");
        let futuro = r#"{"v":2,"tabs":[]}"#;
        std::fs::write(d.join("session.json"), futuro).unwrap();
        let l = load(&d);
        assert!(l.meta.is_none());
        assert!(l.problem.unwrap().contains("formato 2"));
        let guardado = std::fs::read_dir(&d).unwrap().flatten().find(|e| e.file_name().to_string_lossy().starts_with("session.corrupt-")).unwrap();
        assert_eq!(std::fs::read_to_string(guardado.path()).unwrap(), futuro);
    }

    #[test]
    fn sem_prune_nenhum_backup_e_apagado() {
        let d = tmp("prune");
        std::fs::write(d.join("backup/orfao.txt"), "x").unwrap();
        save(&d, META, &["a".into()], false).unwrap();
        assert!(d.join("backup/orfao.txt").exists());
        save(&d, META, &["a".into()], true).unwrap();
        assert!(!d.join("backup/orfao.txt").exists());
    }

    #[test]
    fn backup_com_bytes_invalidos_nao_some() {
        let d = tmp("utf8");
        std::fs::write(d.join("backup/b.txt"), [b'o', b'i', 0xff, b'!']).unwrap();
        let l = load(&d);
        assert_eq!(l.backups.get("b").map(String::as_str), Some("oi\u{fffd}!"));
    }

    #[test]
    fn recusa_gravar_lista_invalida() {
        let d = tmp("invalida");
        save(&d, META, &[], true).unwrap();
        assert!(save(&d, "{}", &[], true).is_err());
        assert_eq!(std::fs::read_to_string(d.join("session.json")).unwrap(), META, "a boa continua lá");
    }

    #[test]
    fn temporario_interrompido_e_ignorado() {
        let d = tmp("tmp");
        std::fs::write(d.join("backup/.a.txt.tmp"), "meio").unwrap();
        std::fs::write(d.join("backup/a.txt"), "inteiro").unwrap();
        let l = load(&d);
        assert_eq!(l.backups.len(), 1);
        assert_eq!(l.backups.get("a").map(String::as_str), Some("inteiro"));
    }

    #[cfg(unix)]
    #[test]
    fn erro_de_gravacao_e_informado_e_nao_estraga_o_anterior() {
        use std::os::unix::fs::PermissionsExt;
        let d = tmp("somente-leitura");
        save(&d, META, &[], true).unwrap();
        std::fs::set_permissions(&d, std::fs::Permissions::from_mode(0o555)).unwrap();
        let r = save(&d, META2, &[], true);
        std::fs::set_permissions(&d, std::fs::Permissions::from_mode(0o755)).unwrap();
        assert!(r.is_err(), "o erro chega até a interface");
        assert_eq!(std::fs::read_to_string(d.join("session.json")).unwrap(), META);
    }
}
