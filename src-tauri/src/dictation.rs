#[cfg(target_os = "macos")]
mod native {
    use std::{
        ffi::{c_char, CStr, CString},
        sync::OnceLock,
    };
    use tauri::Emitter;

    static APP: OnceLock<tauri::AppHandle> = OnceLock::new();

    #[derive(Clone, serde::Serialize)]
    struct Event {
        token: u32,
        kind: String,
        text: String,
    }

    extern "C" {
        fn pp_dictation_start(
            token: u32,
            language: *const c_char,
            callback: extern "C" fn(u32, *const c_char, *const c_char),
        );
        fn pp_dictation_stop(token: u32, cancel: bool);
    }

    extern "C" fn event(token: u32, kind: *const c_char, text: *const c_char) {
        // The native callback owns both UTF-8 strings for the duration of this call.
        let payload = unsafe {
            Event {
                token,
                kind: CStr::from_ptr(kind).to_string_lossy().into_owned(),
                text: CStr::from_ptr(text).to_string_lossy().into_owned(),
            }
        };
        if let Some(app) = APP.get() {
            let _ = app.emit("dictation", payload);
        }
    }

    pub fn start(app: tauri::AppHandle, token: u32, language: &str) {
        let _ = APP.set(app);
        let locale = CString::new(language).unwrap(); // Validated by the command.
        unsafe {
            pp_dictation_start(token, locale.as_ptr(), event);
        }
    }
    pub fn stop(token: u32, cancel: bool) {
        unsafe {
            pp_dictation_stop(token, cancel);
        }
    }
}

#[tauri::command]
pub fn dictation_available() -> bool {
    cfg!(target_os = "macos")
}

#[tauri::command]
pub fn dictation_start(app: tauri::AppHandle, token: u32, language: String) -> Result<(), String> {
    if !matches!(language.as_str(), "pt-BR" | "en-US") {
        return Err("language".into());
    }
    #[cfg(target_os = "macos")]
    {
        native::start(app, token, &language);
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, token);
        Err("unsupported".into())
    }
}

#[tauri::command]
pub fn dictation_stop(token: u32, cancel: bool) {
    #[cfg(target_os = "macos")]
    native::stop(token, cancel);
    #[cfg(not(target_os = "macos"))]
    let _ = (token, cancel);
}
