# Contributing to Aegis File Encryption Tool

Thank you for contributing to the Aegis File Encryption Tool! We welcome community contributions aimed at enhancing reliability, security, accessibility, and platform integration.

---

## Code of Conduct

All contributors are expected to uphold a welcoming, respectful, and harassment-free environment.

---

## Development Workflow

1. **Fork & Branch**: Create a feature or bugfix branch from `main`:
   ```bash
   git checkout -b feature/my-hardening-patch
   ```
2. **Implement Changes**:
   - Write clear, concise, typed code.
   - For cryptographic code, consult `SECURITY.md` and ensure memory zeroization is preserved.
   - Do not add unauthenticated data fields or alter the binary container format without version bumping.
3. **Run Verification**:
   ```bash
   npm run lint
   npm run build
   ```
4. **Submit PR**: Open a Pull Request detailing the changes, reasoning, and test results.

---

## Security Guidelines for Code Reviews

- **No Secret Logging**: Passwords, keys, and decrypted content must never be passed to `log::info!`, `console.log`, or error strings.
- **Panic Safety**: All Rust commands must return structured `Result<T, AppError>`. Never use `.unwrap()` or `.expect()` in production paths.
- **Bound Allocations**: Chunk sizes and buffer sizes must have hard upper limits to prevent Denial of Service (DoS) via malicious header values.
