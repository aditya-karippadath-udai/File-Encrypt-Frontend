use std::path::{Path, PathBuf};

/// Check if a filename/extension matches known encrypted formats (.enc, .aegis, .vault)
pub fn is_encrypted_extension(path: &Path) -> bool {
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        let lower = ext.to_lowercase();
        lower == "enc" || lower == "aegis" || lower == "vault"
    } else {
        false
    }
}

/// Normalizes a path, resolving canonical paths when they exist, or cleaning components.
pub fn normalize_path(path: &Path) -> PathBuf {
    if let Ok(canonical) = path.canonicalize() {
        return canonical;
    }

    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::CurDir => {}
            std::path::Component::ParentDir => {
                normalized.pop();
            }
            c => normalized.push(c),
        }
    }
    normalized
}

/// Checks whether two path strings or paths refer to the exact same canonical file on disk
pub fn are_same_file(path_a: &Path, path_b: &Path) -> bool {
    let norm_a = normalize_path(path_a);
    let norm_b = normalize_path(path_b);
    norm_a == norm_b
}

/// Generates an output destination path for an encrypted file.
/// If `output_dir` is None, outputs into the same parent folder as the input file.
/// Suffix defaults to ".enc" if not specified.
pub fn generate_encrypted_output_path(
    input_path: &Path,
    output_dir: Option<&Path>,
    suffix: Option<&str>,
) -> PathBuf {
    let file_name = input_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file");

    let enc_suffix = suffix.unwrap_or(".enc");
    let output_file_name = if file_name.ends_with(enc_suffix) {
        format!("{}.enc", file_name)
    } else {
        format!("{}{}", file_name, enc_suffix)
    };

    if let Some(dir) = output_dir {
        dir.join(output_file_name)
    } else if let Some(parent) = input_path.parent() {
        parent.join(output_file_name)
    } else {
        PathBuf::from(output_file_name)
    }
}

/// Generates an output destination path for a decrypted file.
/// Strips known encrypted extensions (.enc, .aegis, .vault) or adds .decrypted if not identifiable.
pub fn generate_decrypted_output_path(input_path: &Path, output_dir: Option<&Path>) -> PathBuf {
    let file_name = input_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file");

    let output_file_name = if file_name.ends_with(".enc") {
        file_name.strip_suffix(".enc").unwrap().to_string()
    } else if file_name.ends_with(".aegis") {
        file_name.strip_suffix(".aegis").unwrap().to_string()
    } else if file_name.ends_with(".vault") {
        file_name.strip_suffix(".vault").unwrap().to_string()
    } else {
        format!("{}.decrypted", file_name)
    };

    if let Some(dir) = output_dir {
        dir.join(output_file_name)
    } else if let Some(parent) = input_path.parent() {
        parent.join(output_file_name)
    } else {
        PathBuf::from(output_file_name)
    }
}
