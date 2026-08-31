pub mod encryption;
pub mod format;
pub mod key_derivation;
pub mod nonce;
pub mod random;

pub use encryption::{
    build_chunk_aad, encrypt_chunk, encrypt_file_stream, CancellationCheck,
    EncryptionProgressCallback, POLY1305_TAG_LENGTH,
};
pub use format::{
    EncryptedFileHeader, OriginalFileMetadata, ALGORITHM_XCHACHA20_POLY1305, CURRENT_FORMAT_VERSION,
    DEFAULT_CHUNK_SIZE, KDF_ARGON2ID, MAX_CHUNK_SIZE, MAX_HEADER_SIZE, MAX_METADATA_SIZE,
    MIN_CHUNK_SIZE, NONCE_STRATEGY_SEQUENTIAL,
};
pub use key_derivation::{
    derive_key_argon2id, Argon2ParamsConfig, DerivedKey, DEFAULT_M_COST, DEFAULT_P_COST,
    DEFAULT_T_COST, STANDARD_KEY_LENGTH,
};
pub use nonce::{BaseNonce, METADATA_CHUNK_INDEX, XCHACHA20_NONCE_LENGTH};
pub use random::{Salt, DEFAULT_SALT_LENGTH, MAX_SALT_LENGTH, MIN_SALT_LENGTH};
