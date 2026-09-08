# 🛡️ Aegis — File Encryption Tool

<div align="center">

![Aegis File Encryption Tool Banner](https://img.shields.io/badge/Aegis-File_Encryption_Tool-0F172A?style=for-the-badge&logo=shield&logoColor=60A5FA)

**A local-first, air-gapped, high-performance desktop file encryption & decryption suite.**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?style=flat-square)](https://github.com/aegis-security/file-encryption-tool/releases)
[![License](https://img.shields.io/badge/license-Apache_2.0-emerald.svg?style=flat-square)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-orange.svg?style=flat-square&logo=tauri)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-1.77+-red.svg?style=flat-square&logo=rust)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Cipher](https://img.shields.io/badge/Cipher-XChaCha20--Poly1305-blueviolet.svg?style=flat-square)](https://en.wikipedia.org/wiki/ChaCha20-Poly1305)
[![KDF](https://img.shields.io/badge/KDF-Argon2id_RFC_9106-teal.svg?style=flat-square)](https://datatracker.ietf.org/doc/html/rfc9106)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg?style=flat-square)](#platform-support)
[![Security](https://img.shields.io/badge/Zero-Telemetry%20%7C%20Zero--Cloud-brightgreen.svg?style=flat-square)](#security-guarantees)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Stickers & Badges](#-stickers--badges)
- [Core Highlights](#-core-highlights)
- [Security Guarantees](#-security-guarantees)
- [Architecture](#-architecture)
- [Container Format Specification (v1)](#-container-format-specification-v1)
- [Platform Support](#-platform-support)
- [Installation Guide](#-installation-guide)
  - [Pre-Built Binaries](#pre-built-binaries)
  - [Building from Source](#building-from-source)
- [Usage Guide](#-usage-guide)
  - [1. Encrypting Files](#1-encrypting-files)
  - [2. Decrypting Files](#2-decrypting-files)
  - [3. Quick Queue Drag-and-Drop](#3-quick-queue-drag-and-drop)
  - [4. Batch Queue Management](#4-batch-queue-management)
  - [5. Output Conflict Handling](#5-output-conflict-handling)
  - [6. Crash Recovery & Stale Temp Files](#6-crash-recovery--stale-temp-files)
- [Configuration & Performance Tuning](#-configuration--performance-tuning)
- [Troubleshooting & FAQ](#-troubleshooting--faq)
- [Development & Verification](#-development--verification)
- [License](#-license)

---

## 🌟 Overview

**Aegis File Encryption Tool** is an industrial-grade, local-first desktop application designed for secure streaming encryption and decryption of sensitive files. Built on the modern **Tauri 2.x** framework with a native **Rust** cryptographic core and a responsive **React 19 / TypeScript** user interface, Aegis guarantees absolute data sovereignty.

Unlike traditional cloud-dependent encryption services or unwieldy command-line scripts, Aegis delivers:
1. **Zero External Communication**: No network requests, no telemetric analytics, no user tracking, and no cloud synchronization.
2. **Streaming Cryptography**: Constant memory footprint (~64 KiB buffer) capable of encrypting files from a few bytes to hundreds of gigabytes without RAM spikes or system thrashing.
3. **Tamper-Evident Authenticated Packaging**: Every chunk is individually authenticated with ChaCha20-Poly1305 AAD, stopping truncation, chunk re-ordering, or byte injection attacks in their tracks.
4. **Crash-Resilient Atomic Writes**: Output is written exclusively to temporary files (`.aegis_tmp_*`) and atomically moved to the destination upon successful verification of the entire container.
5. **Universal Hybrid Operation**: Runs natively on desktop (Windows, macOS, Linux) with native file pickers and hardware acceleration, while offering an in-browser WebCrypto fallback for instant evaluation.

---

## 🏷️ Stickers & Badges

You can embed these project status stickers in your repository or documentation:

```markdown
<!-- Release Version -->
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?style=for-the-badge)](https://github.com/aegis-security/file-encryption-tool/releases)

<!-- License -->
[![License](https://img.shields.io/badge/license-Apache_2.0-emerald.svg?style=for-the-badge)](LICENSE)

<!-- Security -->
[![Security](https://img.shields.io/badge/Security-Argon2id%20%2B%20XChaCha20--Poly1305-indigo.svg?style=for-the-badge)](SECURITY.md)

<!-- Platform Support -->
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-black.svg?style=for-the-badge&logo=linux)](https://tauri.app)
```

| Sticker | Badge URL | Target |
| :--- | :--- | :--- |
| **Release v1.0.0** | `https://img.shields.io/badge/version-1.0.0-blue.svg` | Production Release |
| **Apache 2.0** | `https://img.shields.io/badge/license-Apache_2.0-emerald.svg` | Open Source License |
| **XChaCha20-Poly1305** | `https://img.shields.io/badge/Cipher-XChaCha20--Poly1305-blueviolet.svg` | Authenticated AEAD |
| **Argon2id (RFC 9106)** | `https://img.shields.io/badge/KDF-Argon2id-teal.svg` | Memory-Hard Key Derivation |
| **Tauri 2.x** | `https://img.shields.io/badge/Tauri-2.x-orange.svg` | Native Desktop Shell |
| **Rust Core** | `https://img.shields.io/badge/Rust-1.77+-red.svg` | Safe Cryptographic Engine |
| **Zero Telemetry** | `https://img.shields.io/badge/Telemetry-None-brightgreen.svg` | 100% Offline & Private |

---

## ⚡ Core Highlights

- **🔒 Authenticated Streaming AEAD**: Uses **XChaCha20-Poly1305** with a 192-bit nonce. Files are processed in 64 KiB chunks with a 128-bit Poly1305 authentication tag per chunk.
- **🛡️ Memory-Hard Key Derivation**: Implements **Argon2id** (RFC 9106) with configurable parameters (default: 64 MB memory cost, 3 time iterations, 4 parallelism threads) to defeat GPU/ASIC cracking arrays.
- **🎲 Cryptographic Randomness**: 128-bit salts and 192-bit base nonces are sourced directly from operating system CSPRNG (`rand::thread_rng`).
- **🧹 Memory Scrubbing (Zeroize)**: All key buffers, derived secrets, and password strings implement `Zeroize` and `ZeroizeOnDrop` to purge sensitive bytes from memory immediately upon disposal.
- **📦 Native Drag-and-Drop & Quick Queue**: Drop single or batch files anywhere on the interface to automatically detect format (`.enc` -> Decrypt; other -> Encrypt) and prompt for secure passphrase dispatch.
- **🚦 Multi-Threaded Queue**: Process multiple files simultaneously with configurable thread worker limits (1 to 8 concurrent jobs), live progress tracking, and instantaneous per-job cancellation.
- **🔄 Smart Conflict Resolution**: Offers automatic non-destructive renaming (`file (1).txt`), explicit overwrite, or skipping when target destinations already exist.
- **🩹 Automated Crash Recovery**: Scans working directories for interrupted `.aegis_tmp_*` files and presents an intuitive UI to safely inspect, clean, or recover orphaned operations.
- **🚨 Production Error Boundary**: Sanitizes UI rendering failures, completely redacting sensitive passphrase or key material before displaying diagnostic telemetry.

---

## 🔐 Security Guarantees

| Security Property | Implementation Details |
| :--- | :--- |
| **Confidentiality** | 256-bit symmetric encryption using XChaCha20 stream cipher. |
| **Integrity & Authenticity** | 128-bit Poly1305 MAC tag computed over every chunk plus authenticated metadata. |
| **Anti-Reordering Protection** | Additional Authenticated Data (AAD) binds the big-endian 64-bit chunk index (`k`) to each chunk. |
| **Anti-Truncation Protection** | The final chunk is cryptographically sealed with a terminal flag `is_last = 1` inside its AAD. Truncated streams fail authentication. |
| **Side-Channel Mitigation** | Argon2id combines Argon2d (data-dependent) and Argon2i (data-independent) memory passes to prevent cache-timing attacks. |
| **Zero Data Leaks** | Original plaintext files are opened read-only and never modified or deleted automatically. |
| **Strict CSP** | WebViews enforce `default-src 'self'; script-src 'self'` preventing any external script loading or network socket exfiltration. |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           React 19 Frontend                             │
│  ┌───────────────────────┬─────────────────────────┬─────────────────┐  │
│  │   Zustand Stores      │   Modular Views         │  Components     │  │
│  │   - useQueueStore     │   - DashboardPage       │  - QuickQueue   │  │
│  │   - useFileStore      │   - EncryptPage         │  - ConflictDlg  │  │
│  │   - useUIStore        │   - DecryptPage         │  - ErrorBoundary│  │
│  │   - useSessionStore   │   - QueuePage / History │  - ProgressBars │  │
│  └───────────────────────┴─────────────────────────┴─────────────────┘  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                    IPC Bridge / Desktop Abstraction
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌──────────────────────────────────────┐    ┌──────────────────────────────────────┐
│       Native Tauri 2.x Engine        │    │       Browser WebCrypto Engine       │
│  ┌────────────────────────────────┐  │    │  ┌────────────────────────────────┐  │
│  │ Commands & Service Handlers    │  │    │  │ Client-Side Simulation         │  │
│  │ - FileService (Native Dialogs) │  │    │  │ - PBKDF2 (100,000 iterations)  │  │
│  │ - OutputPathService (Sanitize) │  │    │  │ - AES-GCM 256-bit              │  │
│  │ - RecoveryService (Stale Temp) │  │    │  │ - In-Memory Blob Management    │  │
│  │ - SecurityService (Argon2id)   │  │    │  └────────────────────────────────┘  │
│  ├────────────────────────────────┤  │    └──────────────────────────────────────┘
│  │ Cryptographic Core (Rust)      │  │
│  │ - XChaCha20-Poly1305 Streaming │  │
│  │ - Argon2id KDF Engine          │  │
│  │ - BaseNonce Derivation         │  │
│  │ - Memory Zeroization on Drop   │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

---

## 📄 Container Format Specification (v1)

Encrypted files created by Aegis have the `.enc` extension and strictly follow the v1 binary format:

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                       Magic: "AEGIS" (5 bytes)                |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
| Version (0x01)| Cipher (0x01) |  KDF (0x01)   | Nonce (0x01)  |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                Argon2 Memory Cost: m_cost (4 bytes BE)        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                Argon2 Time Cost: t_cost (4 bytes BE)          |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|              Argon2 Parallelism: p_cost (4 bytes BE)          |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
| Salt Len (16) |                                               |
+-+-+-+-+-+-+-+-+            Salt (16 bytes)                    |
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
+                   Base Nonce (24 bytes)                       +
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                   Chunk Size: chunk_size (4 bytes BE)         |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|             Encrypted Metadata Length: meta_len (4 bytes BE)  |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|       Encrypted Metadata Payload (meta_len bytes + 16B tag)   |
|         (Authenticated JSON: original filename, size, date)   |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
| Chunk 1 Length (4B BE)|Last? (1B)| Payload + Poly1305 Tag(16B)|
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
| Chunk 2 Length (4B BE)|Last? (1B)| Payload + Poly1305 Tag(16B)|
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
| ...                                                           |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

---

## 💻 Platform Support

| Operating System | Architecture | Supported Formats | Status |
| :--- | :--- | :--- | :--- |
| **Windows** | x86_64, ARM64 | `.msi` (Windows Installer), `.exe` (NSIS) | ✅ Tested & Supported |
| **macOS** | Apple Silicon (ARM64), Intel (x86_64) | `.dmg`, `.app` | ✅ Tested & Supported |
| **Linux (Debian / Ubuntu)** | x86_64, aarch64 | `.deb` package | ✅ Tested & Supported |
| **Linux (Universal)** | x86_64 | `.AppImage` standalone binary | ✅ Tested & Supported |
| **Web Browser** | Any modern evergreen browser | WebAssembly / WebCrypto Simulation | ✅ Tested & Supported |

---

## 🚀 Installation Guide

### Pre-Built Binaries

Download the appropriate installer from the [Releases](https://github.com/aegis-security/file-encryption-tool/releases) section:

- **Windows**: Run `File-Encryption-Tool_1.0.0_x64-setup.exe` or `.msi`.
- **macOS**: Open `File-Encryption-Tool_1.0.0_universal.dmg` and drag `File Encryption Tool` to Applications.
- **Linux (Debian/Ubuntu)**:
  ```bash
  sudo dpkg -i file-encryption-tool_1.0.0_amd64.deb
  sudo apt-get install -f # resolve dependencies if needed
  ```
- **Linux (AppImage)**:
  ```bash
  chmod +x File-Encryption-Tool_1.0.0_amd64.AppImage
  ./File-Encryption-Tool_1.0.0_amd64.AppImage
  ```

---

### Building from Source

#### Prerequisites

1. **Node.js**: `v18.0` or higher ([Download Node.js](https://nodejs.org/))
2. **Rust**: `v1.77.0` or higher ([Install Rust](https://rustup.rs/)):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
3. **OS-Specific Packages**:

##### Ubuntu / Debian:
```bash
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

##### Fedora:
```bash
sudo dnf check-update
sudo dnf groupinstall "C Development Tools and Libraries"
sudo dnf install webkit2gtk4.1-devel openssl-devel libappindicator-gtk3-devel librsvg2-devel
```

##### Arch Linux:
```bash
sudo pacman -Syu --needed base-devel webkit2gtk-4.1 openssl libappindicator-gtk3 librsvg
```

---

#### Step-by-Step Build Commands

```bash
# 1. Clone the repository
git clone https://github.com/aegis-security/file-encryption-tool.git
cd file-encryption-tool

# 2. Install Node dependencies
npm install

# 3. Verify TypeScript code quality
npm run lint

# 4. Run frontend in browser development mode
npm run dev

# 5. Launch native desktop application in development mode
npm run tauri dev

# 6. Compile optimized release binaries
npm run build
npm run tauri build
```

Compiled desktop packages are written to `src-tauri/target/release/bundle/`.

---

## 📖 Usage Guide

### 1. Encrypting Files

1. Open **Aegis File Encryption Tool** and navigate to the **Encrypt** tab.
2. Click **Browse Files** or drag and drop files onto the primary file selector zone.
3. Verify the file list (size, path, and duplicate indicators).
4. Enter a strong passphrase in the **Password** field.
   - The interactive password strength meter evaluates entropy, length, character variety, and dictionary resistance.
   - You may toggle the eye icon to verify input or provide a confirmation passphrase.
5. *(Optional)* Specify a custom **Output Directory**. By default, encrypted `.enc` files are created adjacent to the source file.
6. Click **Encrypt Files**.
7. The application transitions to the **Queue** view where real-time streaming progress, throughput speed, and estimated time remaining are displayed.

---

### 2. Decrypting Files

1. Navigate to the **Decrypt** tab.
2. Select your encrypted file(s) (`.enc`, `.aegis`, or `.vault`).
3. Enter the passphrase originally used to encrypt the files.
4. Click **Decrypt Files**.
5. Aegis parses the file header, verifies the magic bytes and version, derives the decryption key using Argon2id, decrypts the authenticated file metadata, and streams the decrypted plaintext chunks into the destination directory.
6. If the passphrase is incorrect or the file was tampered with, Aegis halts processing and displays:
   ```
   Authentication failed: Invalid password or corrupted container.
   ```

---

### 3. Quick Queue Drag-and-Drop

Aegis includes a **Quick Queue** dropzone directly on the **Dashboard** and **Encrypt** screens:

- **Drop Any File**: Drag files directly from your desktop or file manager onto the quick dropzone.
- **Smart Auto-Detection**:
  - Files ending in `.enc`, `.aegis`, or `.vault` are automatically queued for **Decryption**.
  - All other files are automatically queued for **Encryption**.
- **Instant Password Prompt**: A streamlined modal prompts for the passphrase and dispatches all files into the active processing queue immediately.

---

### 4. Batch Queue Management

Navigate to the **Queue** tab to monitor and control jobs:

- **Concurrency Limits**: Adjust concurrent processing workers (1 to 8 workers) using the slider in the header.
- **Pause & Resume**: Temporarily suspend queue processing without losing state or corrupting in-progress files.
- **Cancel Individual Jobs**: Terminate any queued or running operation. Partial temporary files are cleanly expunged.
- **Detailed Telemetry**: Inspect processed bytes, total bytes, transfer rates (MB/s), elapsed time, and remaining time.

---

### 5. Output Conflict Handling

When an output file already exists at the target location, Aegis prevents accidental overwrites through three customizable strategies:

1. **Auto-Rename (Default)**: Appends a sequential number before the extension (e.g. `document (1).pdf`).
2. **Overwrite**: Explicitly replaces the destination file with the newly processed output.
3. **Skip**: Bypasses the file and marks the queue item as skipped without error.

Configure your default preference in **Settings** > **Conflict Strategy**.

---

### 6. Crash Recovery & Stale Temp Files

If a computer suddenly loses power or crashes during an operation, Aegis ensures clean recovery:

1. Temporary writes use the format `.aegis_tmp_<uuid>`.
2. On the **Dashboard** or in **Settings**, click **Check for Temporary Files**.
3. Aegis scans the default and selected directories for orphaned temporary files.
4. You can review file sizes, age, and clean them up with one click.

---

## ⚙️ Configuration & Performance Tuning

Access the **Settings** tab to customize operational parameters:

| Setting | Default Value | Options | Description |
| :--- | :--- | :--- | :--- |
| **Max Concurrent Jobs** | `2` | `1` - `8` | Number of simultaneous encryption/decryption threads. |
| **Default Chunk Size** | `64 KiB` | `16 KiB` - `1 MiB` | Size of streaming buffer chunks. Smaller chunks use less memory; larger chunks improve SSD throughput. |
| **Argon2 Memory Cost** | `64 MB` | `16 MB` - `256 MB` | RAM allocation for Argon2id key derivation. |
| **Argon2 Time Cost** | `3 iterations` | `1` - `10` | Computational iterations for key stretching. |
| **Conflict Resolution** | `Rename` | `Rename`, `Overwrite`, `Skip` | Default behavior when destination file exists. |
| **Sound / Celebrations** | `Enabled` | `Enabled`, `Disabled` | Confetti & completion notifications upon queue finish. |

---

## ❓ Troubleshooting & FAQ

### Q1: "Authentication failed: Invalid password or corrupted container."
**Cause**: The password entered does not match the password used to encrypt the container, or the file was modified, truncated, or corrupted in transit.
**Fix**: Double check caps lock, special characters, and verify the file hash matches the original container. Aegis cannot recover files with forgotten passwords.

### Q2: Linux error: `error while loading shared libraries: libwebkit2gtk-4.1.so.0`
**Fix**: Install the WebKitGTK runtime library:
```bash
sudo apt install libwebkit2gtk-4.1-0
```

### Q3: Are my passwords or keys saved anywhere?
**No.** Aegis is strictly zero-knowledge. Passwords are held temporarily in volatile memory wrapped in `Zeroize` containers and scrubbed immediately after key derivation. No keys, hashes, or passwords ever touch disk or network.

### Q4: Can I encrypt folders directly?
**Tip**: You can drag and select multiple files from a folder simultaneously. Aegis will batch process every file individually while preserving original file names and extensions in the encrypted metadata.

---

## 🧪 Development & Verification

To verify code quality, security rules, and build correctness:

```bash
# Run TypeScript typechecker and ESLint
npm run lint

# Run Vite production build test
npm run build

# Check Rust code formatting
cd src-tauri && cargo fmt --check

# Run Rust Clippy static analyzer
cargo clippy --all-targets -- -D warnings

# Execute Rust cryptographic unit tests
cargo test --all-targets
```

---

## 📄 License

```
Copyright 2026 Aegis Security Team

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

See the full [LICENSE](LICENSE) file for complete terms and conditions.
