use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

use crate::errors::AppError;
use crate::utils::paths::{are_same_file, normalize_path};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConflictStrategy {
    Ask,
    Skip,
    Rename,
    Cancel,
    Overwrite,
}

impl Default for ConflictStrategy {
    fn default() -> Self {
        ConflictStrategy::Ask
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OutputConflictType {
    None,
    ExistingFile,
    InternalBatchCollision,
    SameAsInput,
    InvalidDirectory,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannedOutputItem {
    pub input_path: String,
    pub input_filename: String,
    pub planned_output_path: String,
    pub planned_output_filename: String,
    pub original_output_path: String,
    pub conflict_type: OutputConflictType,
    pub is_conflict: bool,
    pub is_skipped: bool,
    pub auto_renamed: bool,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchConflictPlan {
    pub total_files: usize,
    pub conflict_count: usize,
    pub existing_file_conflicts: usize,
    pub internal_collisions: usize,
    pub has_conflicts: bool,
    pub strategy: ConflictStrategy,
    pub items: Vec<PlannedOutputItem>,
}

pub struct OutputPathService;

impl OutputPathService {
    pub fn new() -> Self {
        Self
    }

    /// Sanitizes an input filename or recovered metadata filename to prevent path traversal
    /// and illegal filesystem characters.
    pub fn sanitize_filename(name: &str) -> String {
        let mut clean: String = name
            .chars()
            .filter(|c| {
                !c.is_control()
                    && *c != '/'
                    && *c != '\\'
                    && *c != ':'
                    && *c != '*'
                    && *c != '?'
                    && *c != '"'
                    && *c != '<'
                    && *c != '>'
                    && *c != '|'
                    && *c != '\0'
            })
            .collect();

        // Trim leading and trailing whitespace and dots
        clean = clean.trim().trim_matches('.').to_string();

        if clean.is_empty() {
            "file".to_string()
        } else if clean.len() > 255 {
            clean[..255].to_string()
        } else {
            clean
        }
    }

    /// Generates base proposed output filename for encryption or decryption.
    /// Preserves file extension structure properly.
    pub fn generate_base_output_filename(
        input_filename: &str,
        mode: &str,
        custom_suffix: Option<&str>,
    ) -> String {
        let sanitized = Self::sanitize_filename(input_filename);
        let enc_suffix = custom_suffix.unwrap_or(".enc");

        if mode == "decrypt" {
            if let Some(stripped) = sanitized.strip_suffix(".enc") {
                stripped.to_string()
            } else if let Some(stripped) = sanitized.strip_suffix(".aegis") {
                stripped.to_string()
            } else if let Some(stripped) = sanitized.strip_suffix(".vault") {
                stripped.to_string()
            } else {
                format!("{}.decrypted", sanitized)
            }
        } else {
            if sanitized.ends_with(enc_suffix) {
                sanitized
            } else {
                format!("{}{}", sanitized, enc_suffix)
            }
        }
    }

    /// Generates a deterministic safe numeric rename preserving extension structure.
    /// Examples:
    /// - report.pdf + 1 => report (1).pdf
    /// - report.pdf.enc + 1 => report (1).pdf.enc
    /// - archive.tar.gz + 1 => archive (1).tar.gz
    pub fn generate_numeric_rename(filename: &str, sequence: usize) -> String {
        if sequence == 0 {
            return filename.to_string();
        }

        let is_enc = filename.ends_with(".enc")
            || filename.ends_with(".aegis")
            || filename.ends_with(".vault");

        if is_enc {
            // E.g. "report.pdf.enc" -> stem "report.pdf", suffix ".enc"
            let (stem, suffix) = if let Some(s) = filename.strip_suffix(".enc") {
                (s, ".enc")
            } else if let Some(s) = filename.strip_suffix(".aegis") {
                (s, ".aegis")
            } else {
                (filename.strip_suffix(".vault").unwrap_or(filename), ".vault")
            };

            let path = Path::new(stem);
            let file_stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or(stem);
            let ext = path.extension().and_then(|e| e.to_str());

            if let Some(ext) = ext {
                format!("{} ({}) .{}{}", file_stem.trim(), sequence, ext, suffix)
                    .replace(" .", ".")
            } else {
                format!("{} ({}){}", file_stem.trim(), sequence, suffix)
            }
        } else {
            let path = Path::new(filename);
            let file_stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or(filename);
            let ext = path.extension().and_then(|e| e.to_str());

            if let Some(ext) = ext {
                format!("{} ({}).{}", file_stem.trim(), sequence, ext)
            } else {
                format!("{} ({})", file_stem.trim(), sequence)
            }
        }
    }

    /// Finds the next available non-conflicting filename in the target directory and in the batch reserved set.
    pub fn find_available_unique_path(
        target_dir: &Path,
        base_filename: &str,
        reserved_paths: &HashSet<PathBuf>,
    ) -> (PathBuf, String) {
        let mut sequence = 0;
        loop {
            let candidate_name = if sequence == 0 {
                base_filename.to_string()
            } else {
                Self::generate_numeric_rename(base_filename, sequence)
            };

            let candidate_path = target_dir.join(&candidate_name);
            let normalized = normalize_path(&candidate_path);

            if !candidate_path.exists() && !reserved_paths.contains(&normalized) {
                return (candidate_path, candidate_name);
            }

            sequence += 1;
            if sequence > 9999 {
                // Failsafe with timestamp
                let fallback = format!(
                    "{}_{}",
                    chrono::Utc::now().timestamp_millis(),
                    base_filename
                );
                let p = target_dir.join(&fallback);
                return (p, fallback);
            }
        }
    }

    /// Comprehensive pre-flight planning and conflict detection for an entire batch.
    pub fn plan_batch_outputs(
        &self,
        input_paths: &[String],
        output_dir: Option<&str>,
        mode: &str,
        strategy: ConflictStrategy,
        custom_suffix: Option<&str>,
    ) -> Result<BatchConflictPlan, AppError> {
        let out_dir_buf = if let Some(dir) = output_dir {
            let p = PathBuf::from(dir);
            if !p.exists() {
                return Err(AppError::InvalidOutputDirectory(format!(
                    "Output directory does not exist: {}",
                    dir
                )));
            }
            Some(p)
        } else {
            None
        };

        let mut planned_items = Vec::with_capacity(input_paths.len());
        let mut existing_conflicts = 0;
        let mut internal_collisions = 0;

        // Track proposed output targets to catch internal batch collisions
        let mut target_to_count: HashMap<PathBuf, usize> = HashMap::new();

        // 1. Initial proposal pass
        for in_path_str in input_paths {
            let in_path = Path::new(in_path_str);
            let in_filename = in_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("file");

            let target_parent = match &out_dir_buf {
                Some(dir) => dir.clone(),
                None => in_path
                    .parent()
                    .unwrap_or_else(|| Path::new("."))
                    .to_path_buf(),
            };

            let base_name = Self::generate_base_output_filename(in_filename, mode, custom_suffix);
            let raw_output_path = target_parent.join(&base_name);
            let normalized_output = normalize_path(&raw_output_path);

            *target_to_count.entry(normalized_output).or_insert(0) += 1;
        }

        // 2. Conflict evaluation and resolution pass according to strategy
        let mut reserved_paths: HashSet<PathBuf> = HashSet::new();

        for in_path_str in input_paths {
            let in_path = Path::new(in_path_str);
            let in_filename = in_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("file");

            let target_parent = match &out_dir_buf {
                Some(dir) => dir.clone(),
                None => in_path
                    .parent()
                    .unwrap_or_else(|| Path::new("."))
                    .to_path_buf(),
            };

            let base_name = Self::generate_base_output_filename(in_filename, mode, custom_suffix);
            let original_output_path = target_parent.join(&base_name);
            let orig_norm = normalize_path(&original_output_path);

            // Determine conflict type
            let mut conflict_type = OutputConflictType::None;
            let mut message = None;

            if are_same_file(in_path, &original_output_path) {
                conflict_type = OutputConflictType::SameAsInput;
                message = Some("Output path is identical to the source input file.".to_string());
            } else if original_output_path.exists() {
                conflict_type = OutputConflictType::ExistingFile;
                existing_conflicts += 1;
                message = Some("A file with this name already exists in the destination folder.".to_string());
            } else if target_to_count.get(&orig_norm).copied().unwrap_or(0) > 1 {
                conflict_type = OutputConflictType::InternalBatchCollision;
                internal_collisions += 1;
                message = Some("Multiple files in this batch resolve to the same output filename.".to_string());
            }

            let is_conflict = conflict_type != OutputConflictType::None;

            let (final_output_path, final_output_name, is_skipped, auto_renamed) = match strategy {
                ConflictStrategy::Rename => {
                    if is_conflict || reserved_paths.contains(&orig_norm) {
                        let (unique_p, unique_name) = Self::find_available_unique_path(
                            &target_parent,
                            &base_name,
                            &reserved_paths,
                        );
                        let norm_unique = normalize_path(&unique_p);
                        reserved_paths.insert(norm_unique);
                        (unique_p, unique_name, false, true)
                    } else {
                        reserved_paths.insert(orig_norm.clone());
                        (original_output_path.clone(), base_name.clone(), false, false)
                    }
                }
                ConflictStrategy::Skip => {
                    if is_conflict {
                        (original_output_path.clone(), base_name.clone(), true, false)
                    } else {
                        reserved_paths.insert(orig_norm.clone());
                        (original_output_path.clone(), base_name.clone(), false, false)
                    }
                }
                ConflictStrategy::Overwrite | ConflictStrategy::Ask | ConflictStrategy::Cancel => {
                    reserved_paths.insert(orig_norm.clone());
                    (original_output_path.clone(), base_name.clone(), false, false)
                }
            };

            planned_items.push(PlannedOutputItem {
                input_path: in_path_str.clone(),
                input_filename: in_filename.to_string(),
                planned_output_path: final_output_path.to_string_lossy().to_string(),
                planned_output_filename: final_output_name,
                original_output_path: original_output_path.to_string_lossy().to_string(),
                conflict_type,
                is_conflict,
                is_skipped,
                auto_renamed,
                message,
            });
        }

        let total_conflicts = existing_conflicts + internal_collisions;

        Ok(BatchConflictPlan {
            total_files: input_paths.len(),
            conflict_count: total_conflicts,
            existing_file_conflicts: existing_conflicts,
            internal_collisions,
            has_conflicts: total_conflicts > 0,
            strategy,
            items: planned_items,
        })
    }
}

impl Default for OutputPathService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use std::fs::File;

    #[test]
    fn test_filename_sanitization() {
        assert_eq!(OutputPathService::sanitize_filename("../../etc/passwd"), "etcpasswd");
        assert_eq!(OutputPathService::sanitize_filename("valid_doc.pdf"), "valid_doc.pdf");
        assert_eq!(OutputPathService::sanitize_filename("bad:name?.txt"), "badname.txt");
    }

    #[test]
    fn test_numeric_rename_extension_preservation() {
        assert_eq!(
            OutputPathService::generate_numeric_rename("report.pdf", 1),
            "report (1).pdf"
        );
        assert_eq!(
            OutputPathService::generate_numeric_rename("report.pdf.enc", 1),
            "report (1).pdf.enc"
        );
        assert_eq!(
            OutputPathService::generate_numeric_rename("archive.tar.gz", 2),
            "archive.tar (2).gz"
        );
    }

    #[test]
    fn test_batch_conflict_detection_and_rename_strategy() {
        let dir = tempdir().unwrap();
        let dir_path = dir.path();

        // Create an existing file
        let existing = dir_path.join("data.txt.enc");
        File::create(&existing).unwrap();

        let service = OutputPathService::new();
        let inputs = vec![
            "/tmp/data.txt".to_string(),
            "/other/data.txt".to_string(),
        ];

        // Test with Ask strategy
        let plan_ask = service
            .plan_batch_outputs(
                &inputs,
                Some(&dir_path.to_string_lossy()),
                "encrypt",
                ConflictStrategy::Ask,
                None,
            )
            .unwrap();

        assert!(plan_ask.has_conflicts);
        assert!(plan_ask.conflict_count >= 1);

        // Test with Rename strategy
        let plan_rename = service
            .plan_batch_outputs(
                &inputs,
                Some(&dir_path.to_string_lossy()),
                "encrypt",
                ConflictStrategy::Rename,
                None,
            )
            .unwrap();

        assert_eq!(plan_rename.items.len(), 2);
        assert_ne!(
            plan_rename.items[0].planned_output_path,
            plan_rename.items[1].planned_output_path
        );
        assert!(plan_rename.items[0].planned_output_path.contains(" (1).enc") || plan_rename.items[0].planned_output_path.contains(" (2).enc"));
    }
}
