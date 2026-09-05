# Changelog

All notable changes to the Aegis File Encryption Tool will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-04

### Initial Production Release

#### Added
- **Core Cryptography**:
  - Authenticated streaming encryption and decryption engine using **XChaCha20-Poly1305** (256-bit key, 192-bit nonce, 128-bit MAC tag).
  - Password key derivation utilizing **Argon2id** (RFC 9106) with configurable memory hardness, iteration limits, and thread parallelism.
  - CSPRNG random salt generation (128-bit) and base nonce generation (192-bit).
  - Explicit chunk-level Additional Authenticated Data (AAD) binding 64-bit index and terminal block flag.
  - Zeroization for all sensitive in-memory key representations (`zeroize::ZeroizeOnDrop`).
- **File Management & Conflict Engine**:
  - File picker integration with support for single and multi-file selection.
  - Native drag-and-drop zone on Dashboard and Encrypt view with immediate batch queue dispatch.
  - Robust output conflict detection with customizable strategies: `Rename`, `Overwrite`, and `Skip`.
  - Comprehensive filename sanitization preventing directory traversal and reserving OS device handles.
  - Atomic temporary file generation (`.aegis_tmp_*`) with automatic crash recovery scanning.
- **Queue & Batch Processing**:
  - Concurrent multi-job execution with configurable thread concurrency limits (1 to 8 workers).
  - Pause, resume, and per-job cancellation controls.
  - Real-time progress monitoring with processing speed, time remaining, and byte counters.
  - Duplicate file prevention and batch summary statistics.
- **Desktop & Web Fallback Support**:
  - Tauri 2.x desktop shell integration with IPC bridge.
  - Browser fallback mode using WebCrypto APIs (PBKDF2 and AES-GCM) for zero-install instant preview.
  - Production-ready error boundary catching UI errors and redacting sensitive data.
- **Packaging & Hardening**:
  - Strict Content Security Policy (CSP).
  - Multi-platform packaging targets: Debian (.deb), AppImage (.AppImage), Windows (.msi, .exe), macOS (.dmg).
  - Complete application icon suites (32x32, 128x128, 256x256, 512x512, ICO, ICNS).
  - Comprehensive documentation (`README.md`, `SECURITY.md`, `BUILDING.md`, `CONTRIBUTING.md`).
