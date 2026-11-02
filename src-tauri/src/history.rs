//! Histórico local de versões ("snapshots") gravado em disco.
//!
//! Cada documento tem uma pasta própria em `<dados>/history/<hash da chave>/` com:
//!   - `index.json`: lista das versões (data, motivo, tamanho, hash do conteúdo)
//!   - `<id>.txt`: o texto de cada versão
//! A chave é `f:<caminho>` para arquivos (o histórico continua ao reabrir o arquivo)
//! e `u:<id da aba>` para textos ainda sem arquivo.
//!
//! Limites: 50 versões por documento, 30 dias, 200 MB no total, 20 MB por versão.

use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

const MAX_PER_DOC: usize = 50;
const MAX_TOTAL_BYTES: u64 = 200 * 1024 * 1024;
const MAX_SNAPSHOT_BYTES: usize = 20 * 1024 * 1024;
const MAX_AGE_MS: f64 = 30.0 * 24.0 * 3600.0 * 1000.0;

#[derive(Serialize, Deserialize, Clone)]
pub struct Entry {
    pub id: String,
    pub ts: f64,
    pub reason: String,
    pub size: u64,
    pub lines: u64,
    pub hash: u64,
    pub name: String,
}

#[derive(Serialize, Deserialize, Default)]
struct Index {
    key: String,
    entries: Vec<Entry>,
}

fn now_ms() -> f64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs_f64() * 1000.0)
        .unwrap_or(0.0)
}

fn hash_of<T: Hash + ?Sized>(v: &T) -> u64 {
    let mut h = DefaultHasher::new();
    v.hash(&mut h);
    h.finish()
}

fn root(data: &Path) -> PathBuf {
    data.join("history")
}

fn doc_dir(data: &Path, key: &str) -> PathBuf {
    root(data).join(format!("{:016x}", hash_of(key)))
}

fn read_index(dir: &Path) -> Index {
    std::fs::read_to_string(dir.join("index.json"))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_index(dir: &Path, idx: &Index) -> Result<(), String> {
    let json = serde_json::to_vec(idx).map_err(|e| e.to_string())?;
    crate::write_atomic(&dir.join("index.json"), &json)
}

fn valid_snapshot_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 32 && id.chars().all(|c| c.is_ascii_digit())
}

/// Grava uma versão. Não grava se o texto for igual ao da última versão (ou grande demais).
pub fn save(data: &Path, key: &str, name: &str, reason: &str, content: &str) -> Result<Option<Entry>, String> {
    if content.len() > MAX_SNAPSHOT_BYTES {
        return Ok(None);
    }
    let dir = doc_dir(data, key);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut idx = read_index(&dir);
    idx.key = key.to_string();
    let h = hash_of(content);
    if idx.entries.last().is_some_and(|e| e.hash == h && e.size == content.len() as u64) {
        return Ok(None);
    }
    let mut ts = now_ms().floor();
    if let Some(last) = idx.entries.last() {
        if ts <= last.ts {
            ts = last.ts + 1.0; // ids sempre crescentes, mesmo com duas versões no mesmo milissegundo
        }
    }
    let id = format!("{}", ts as u64);
    crate::write_atomic(&dir.join(format!("{id}.txt")), content.as_bytes())?;
    let entry = Entry {
        id,
        ts,
        reason: reason.chars().take(40).collect(),
        size: content.len() as u64,
        lines: content.lines().count().max(1) as u64,
        hash: h,
        name: name.chars().take(200).collect(),
    };
    idx.entries.push(entry.clone());
    while idx.entries.len() > MAX_PER_DOC {
        let old = idx.entries.remove(0);
        let _ = std::fs::remove_file(dir.join(format!("{}.txt", old.id)));
    }
    write_index(&dir, &idx)?;
    prune(data);
    Ok(Some(entry))
}

/// Versões do documento, da mais nova para a mais antiga
pub fn list(data: &Path, key: &str) -> Vec<Entry> {
    let mut v = read_index(&doc_dir(data, key)).entries;
    v.reverse();
    v
}

pub fn read(data: &Path, key: &str, id: &str) -> Result<String, String> {
    if !valid_snapshot_id(id) {
        return Err("id inválido".into());
    }
    std::fs::read_to_string(doc_dir(data, key).join(format!("{id}.txt"))).map_err(|e| e.to_string())
}

/// Junta o histórico de `from` em `to` (ex.: texto sem título que foi salvo como arquivo)
pub fn rename(data: &Path, from: &str, to: &str) -> Result<(), String> {
    if from == to {
        return Ok(());
    }
    let src = doc_dir(data, from);
    let src_idx = read_index(&src);
    if src_idx.entries.is_empty() {
        return Ok(());
    }
    let dst = doc_dir(data, to);
    std::fs::create_dir_all(&dst).map_err(|e| e.to_string())?;
    let mut dst_idx = read_index(&dst);
    dst_idx.key = to.to_string();
    for e in src_idx.entries {
        let from_file = src.join(format!("{}.txt", e.id));
        let mut e2 = e.clone();
        while dst_idx.entries.iter().any(|x| x.id == e2.id) {
            e2.ts += 1.0;
            e2.id = format!("{}", e2.ts as u64);
        }
        if std::fs::rename(&from_file, dst.join(format!("{}.txt", e2.id))).is_ok() {
            dst_idx.entries.push(e2);
        }
    }
    dst_idx.entries.sort_by(|a, b| a.ts.total_cmp(&b.ts));
    while dst_idx.entries.len() > MAX_PER_DOC {
        let old = dst_idx.entries.remove(0);
        let _ = std::fs::remove_file(dst.join(format!("{}.txt", old.id)));
    }
    write_index(&dst, &dst_idx)?;
    let _ = std::fs::remove_dir_all(&src);
    Ok(())
}

/// Aplica os limites globais: idade máxima e tamanho total (apaga as versões mais antigas primeiro)
pub fn prune(data: &Path) {
    let Ok(dirs) = std::fs::read_dir(root(data)) else { return };
    let cutoff = now_ms() - MAX_AGE_MS;
    let mut all: Vec<(f64, PathBuf, String, u64)> = Vec::new(); // (ts, pasta, id, tamanho)
    for d in dirs.flatten() {
        let dir = d.path();
        if !dir.is_dir() {
            continue;
        }
        let mut idx = read_index(&dir);
        let before = idx.entries.len();
        idx.entries.retain(|e| {
            let keep = e.ts >= cutoff;
            if !keep {
                let _ = std::fs::remove_file(dir.join(format!("{}.txt", e.id)));
            }
            keep
        });
        if idx.entries.is_empty() {
            let _ = std::fs::remove_dir_all(&dir);
            continue;
        }
        if idx.entries.len() != before {
            let _ = write_index(&dir, &idx);
        }
        for e in &idx.entries {
            all.push((e.ts, dir.clone(), e.id.clone(), e.size));
        }
    }
    let mut total: u64 = all.iter().map(|x| x.3).sum();
    if total <= MAX_TOTAL_BYTES {
        return;
    }
    all.sort_by(|a, b| a.0.total_cmp(&b.0));
    let mut removed: std::collections::HashMap<PathBuf, Vec<String>> = Default::default();
    for (_, dir, id, size) in all {
        if total <= MAX_TOTAL_BYTES {
            break;
        }
        let _ = std::fs::remove_file(dir.join(format!("{id}.txt")));
        removed.entry(dir).or_default().push(id);
        total = total.saturating_sub(size);
    }
    for (dir, ids) in removed {
        let mut idx = read_index(&dir);
        idx.entries.retain(|e| !ids.contains(&e.id));
        if idx.entries.is_empty() {
            let _ = std::fs::remove_dir_all(&dir);
        } else {
            let _ = write_index(&dir, &idx);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("penapad-hist-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn grava_le_e_nao_duplica() {
        let d = tmp("dup");
        assert!(save(&d, "f:/a.txt", "a.txt", "aberto", "v1").unwrap().is_some());
        assert!(save(&d, "f:/a.txt", "a.txt", "auto", "v1").unwrap().is_none(), "texto igual ao último não grava");
        let e2 = save(&d, "f:/a.txt", "a.txt", "salvo", "v2").unwrap().unwrap();
        let l = list(&d, "f:/a.txt");
        assert_eq!(l.len(), 2);
        assert_eq!(l[0].id, e2.id, "mais nova primeiro");
        assert_eq!(read(&d, "f:/a.txt", &l[1].id).unwrap(), "v1");
        assert!(read(&d, "f:/a.txt", "../x").is_err(), "id inválido é recusado");
    }

    #[test]
    fn limite_por_documento() {
        let d = tmp("cap");
        for i in 0..(MAX_PER_DOC + 7) {
            save(&d, "u:x", "x", "auto", &format!("versão {i}")).unwrap();
        }
        let l = list(&d, "u:x");
        assert_eq!(l.len(), MAX_PER_DOC);
        assert_eq!(read(&d, "u:x", &l[0].id).unwrap(), format!("versão {}", MAX_PER_DOC + 6));
        let files = std::fs::read_dir(doc_dir(&d, "u:x")).unwrap().count();
        assert_eq!(files, MAX_PER_DOC + 1, "arquivos antigos apagados (+ index.json)");
    }

    #[test]
    fn junta_sem_titulo_no_arquivo() {
        let d = tmp("ren");
        save(&d, "u:tab1", "Sem título 1", "auto", "rascunho").unwrap();
        save(&d, "f:/b.txt", "b.txt", "aberto", "antigo").unwrap();
        rename(&d, "u:tab1", "f:/b.txt").unwrap();
        assert!(list(&d, "u:tab1").is_empty());
        let l = list(&d, "f:/b.txt");
        assert_eq!(l.len(), 2);
        let textos: Vec<String> = l.iter().map(|e| read(&d, "f:/b.txt", &e.id).unwrap()).collect();
        assert!(textos.contains(&"rascunho".to_string()) && textos.contains(&"antigo".to_string()));
    }

    #[test]
    fn apaga_versoes_velhas() {
        let d = tmp("age");
        save(&d, "u:velho", "v", "auto", "texto velho").unwrap();
        let dir = doc_dir(&d, "u:velho");
        let mut idx = read_index(&dir);
        idx.entries[0].ts -= MAX_AGE_MS + 1000.0;
        write_index(&dir, &idx).unwrap();
        save(&d, "u:novo", "n", "auto", "texto novo").unwrap(); // dispara a limpeza
        assert!(list(&d, "u:velho").is_empty());
        assert!(!dir.exists());
        assert_eq!(list(&d, "u:novo").len(), 1);
    }

    #[test]
    fn ignora_texto_grande_demais() {
        let d = tmp("big");
        let grande = "x".repeat(MAX_SNAPSHOT_BYTES + 1);
        assert!(save(&d, "u:g", "g", "auto", &grande).unwrap().is_none());
    }
}
