fn main() {
    println!("cargo:rerun-if-changed=native/dictation.m");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        let out = std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap());
        let arch = match std::env::var("CARGO_CFG_TARGET_ARCH").unwrap().as_str() {
            "aarch64" => "arm64",
            "x86_64" => "x86_64",
            other => panic!("unsupported macOS architecture: {other}"),
        };
        let object = out.join("dictation.o");
        assert!(std::process::Command::new("xcrun")
            .args([
                "clang",
                "-c",
                "-fobjc-arc",
                "-fblocks",
                "-O2",
                "-arch",
                arch,
                "-mmacosx-version-min=11.0",
                "native/dictation.m",
                "-o",
            ])
            .arg(&object)
            .status()
            .expect("clang")
            .success());
        assert!(std::process::Command::new("ar")
            .arg("crs")
            .arg(out.join("libpenapad_dictation.a"))
            .arg(&object)
            .status()
            .expect("ar")
            .success());
        println!("cargo:rustc-link-search=native={}", out.display());
        println!("cargo:rustc-link-lib=static=penapad_dictation");
        for framework in ["Foundation", "AVFoundation", "Speech"] {
            println!("cargo:rustc-link-lib=framework={framework}");
        }
    }
    tauri_build::build()
}
