# Building Aegis File Encryption Tool

This guide provides instructions for compiling, building, and packaging Aegis File Encryption Tool for development and production environments.

---

## 1. System Requirements & Toolchains

- **Node.js**: `v18.0` to `v22.x` (LTS recommended)
- **Rust Toolchain**: `v1.77.0+` (stable)
- **Cargo**: Installed with Rust (`rustup default stable`)
- **Tauri CLI**: Installed via `npm run tauri` or `cargo install tauri-cli`

### Linux System Dependencies (Ubuntu / Debian)

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

### macOS Dependencies

- macOS 10.13 (High Sierra) or later.
- Xcode Command Line Tools:
```bash
xcode-select --install
```

### Windows Dependencies

- Windows 10 / 11 (64-bit).
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload.
- WebView2 Runtime (pre-installed on modern Windows 10/11).

---

## 2. Development Setup

```bash
# Clone the repository
git clone https://github.com/aegis-security/file-encryption-tool.git
cd file-encryption-tool

# Install node dependencies
npm install

# Run Vite development server
npm run dev

# Run Tauri desktop app with hot development reload
npm run tauri dev
```

---

## 3. Production Compilation & Packaging

### Compiling Frontend Assets
```bash
npm run build
```
This bundles the optimized React frontend into `./dist`.

### Compiling Native Tauri Desktop Bundle
```bash
npm run tauri build
```
The output installers and binaries will be located in:
- **Linux**: `src-tauri/target/release/bundle/deb/` and `src-tauri/target/release/bundle/appimage/`
- **macOS**: `src-tauri/target/release/bundle/dmg/` and `src-tauri/target/release/bundle/macos/`
- **Windows**: `src-tauri/target/release/bundle/nsis/` and `src-tauri/target/release/bundle/msi/`

---

## 4. Code Quality & Verification Commands

Before creating releases, run the following verification checks:

```bash
# 1. Frontend Type Safety & Linting
npm run lint

# 2. Rust Formatting Check
cd src-tauri && cargo fmt --check

# 3. Rust Clippy Linters
cargo clippy --all-targets -- -D warnings

# 4. Rust Unit & Integration Tests
cargo test --all-targets
```

---

## 5. Release Code Signing

### Windows (Authenticode)
Set environment variables before running `npm run tauri build`:
```bash
export TAURI_SIGNING_PRIVATE_KEY="path/to/key.key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="password"
```

### macOS (Notarization)
Set Apple developer credentials:
```bash
export APPLE_CERTIFICATE="base64-cert"
export APPLE_CERTIFICATE_PASSWORD="password"
export APPLE_ID="developer@example.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID123"
```
