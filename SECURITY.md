# Security Model & Policy

Aegis File Encryption Tool is engineered from the ground up for zero-trust, local-first data protection. This document details our cryptographic architecture, security guarantees, memory safety measures, and vulnerability reporting procedures.

---

## Cryptographic Primitives

| Component | Standard / Algorithm | Parameters | Purpose |
| :--- | :--- | :--- | :--- |
| **Symmetric Cipher** | XChaCha20-Poly1305 | 256-bit Key, 192-bit Nonce, 128-bit MAC Tag | Authenticated encryption of file metadata and chunked file payloads. |
| **Key Derivation** | Argon2id (RFC 9106) | m=64MB, t=3, p=4 (Default), 16-byte Salt | Password-based key stretching resistant to GPU and ASIC brute-force attacks. |
| **Entropy Source** | OS CSPRNG (`rand::thread_rng`) | 128-bit Salt, 192-bit BaseNonce | Generation of cryptographically unpredictable salts and base nonces. |
| **Memory Sanitization** | `zeroize` / `ZeroizeOnDrop` | Secure overwrite on deallocation | Eradication of intermediate keys and secrets from RAM. |

---

## Threat Model & Mitigations

### 1. Chunk Reordering, Substitution, and Truncation
- **Threat**: An adversary intercepts or modifies an encrypted container by reordering chunks, inserting chunks from another file, or truncating the stream to hide data.
- **Mitigation**: Every chunk is encrypted with Additional Authenticated Data (AAD) consisting of `[chunk_index (8 bytes BE)][is_last_chunk (1 byte)]`. Any alteration of chunk sequencing, omission of the terminal chunk, or extraneous trailing data causes the Poly1305 authentication tag to fail validation, aborting the process immediately before writing unauthenticated data.

### 2. Password & Key Leakage in Memory
- **Threat**: Cold boot attacks, memory dumping, core dumps, or lingering heap allocations expose user passwords or derived master keys.
- **Mitigation**: Key buffers are wrapped in `DerivedKey` which implements `zeroize::ZeroizeOnDrop`. Plaintext passwords in memory are zeroed out as soon as key derivation completes. Passwords are never serialized into state, written to disk, or transmitted over any network socket.

### 3. Inadvertent Data Overwrites & Temp Leaks
- **Threat**: An interrupted or failed encryption operation leaves partially unencrypted plaintext files or overwrites existing user files.
- **Mitigation**: All operations write strictly to isolated atomic temporary files (`.aegis_tmp_<uuid>`). Once cryptographic verification of the final block succeeds, the temp file is atomically renamed to the designated destination path. On crash or cancellation, automated cleanup removes all orphaned temporary artifacts.

### 4. Cross-Site Scripting & Desktop WebView Compromise
- **Threat**: Malicious payloads injected into file names or metadata attempt to execute scripts within the desktop WebView.
- **Mitigation**:
  - Strict Content Security Policy (`default-src 'self'`).
  - Strict input sanitization of original file names eliminating directory traversal (`../`), null bytes (`\0`), control characters, and OS-reserved device handles.
  - React's automated contextual escaping prevents script injection.

---

## Security Best Practices for Users

1. **Password Entropy**: Use strong, unique passphrases (16+ characters recommended).
2. **Backups**: Retain an unencrypted backup of critical files in a secure location until encryption and decryption integrity have been verified.
3. **Loss of Password**: There is no backdoor, recovery key, or master override. If the passphrase is lost, data recovery is mathematically infeasible.

---

## Reporting a Vulnerability

If you discover a potential security flaw in Aegis File Encryption Tool, please do NOT file a public issue.

Email the security team with:
- Summary of the vulnerability
- Steps to reproduce or proof-of-concept (PoC)
- Affected versions and operating environments

We commit to acknowledging reports within 48 hours and providing a remediation timeline.
