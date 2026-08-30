import { PasswordEvaluation } from '../../utils/passwordStrength';

/**
 * Request payload for backend password validation.
 */
export interface PasswordValidationRequest {
  password: string;
  confirmPassword?: string;
}

/**
 * Result of password validation check.
 */
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Request payload for preparing/testing key derivation.
 */
export interface KeyDerivationRequest {
  password: string;
}

/**
 * Safe public metadata returned from key derivation operations.
 * CRITICAL: Never contains raw derived keys, passwords, or raw secrets.
 */
export interface KeyDerivationResponse {
  success: boolean;
  algorithm: string;
  keyLength: number;
  memoryCostKib?: number;
  timeCostIterations?: number;
  parallelismThreads?: number;
}

/**
 * Structured Security Error.
 */
export interface SecurityServiceError {
  code: string;
  message: string;
  details?: string;
}

/**
 * Core interface for password handling, validation, and key derivation services.
 */
export interface SecurityService {
  /**
   * Validates a password and optional confirmation against application security policies.
   */
  validatePassword(request: PasswordValidationRequest): Promise<PasswordValidationResult>;

  /**
   * Prepares and tests key derivation using Argon2id with a secure random salt.
   * Returns only safe metadata about the derived key.
   */
  prepareKeyDerivation(request: KeyDerivationRequest): Promise<KeyDerivationResponse>;

  /**
   * Local client-side evaluation of password strength without sending passwords over IPC.
   */
  evaluatePasswordStrength(password: string): PasswordEvaluation;
}
