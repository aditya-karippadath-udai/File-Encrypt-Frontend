import { invoke } from '@tauri-apps/api/core';
import { PasswordEvaluation, evaluatePasswordStrength } from '../../utils/passwordStrength';
import {
  KeyDerivationRequest,
  KeyDerivationResponse,
  PasswordValidationRequest,
  PasswordValidationResult,
  SecurityService,
  SecurityServiceError,
} from './securityService';
import { mockSecurityService } from './mockSecurityService';

/**
 * Tauri desktop implementation of SecurityService.
 * Calls Rust Tauri commands `validate_password` and `prepare_key_derivation`.
 */
export class TauriSecurityService implements SecurityService {
  public async validatePassword(request: PasswordValidationRequest): Promise<PasswordValidationResult> {
    try {
      return await invoke<PasswordValidationResult>('validate_password', { request });
    } catch (err: unknown) {
      console.warn('Native validate_password invoke failed, using mock validator fallback:', err);
      return mockSecurityService.validatePassword(request);
    }
  }

  public async prepareKeyDerivation(request: KeyDerivationRequest): Promise<KeyDerivationResponse> {
    try {
      return await invoke<KeyDerivationResponse>('prepare_key_derivation', { request });
    } catch (err: unknown) {
      console.warn('Native prepare_key_derivation invoke failed, falling back to mock:', err);
      if (typeof err === 'object' && err !== null && 'code' in err && 'message' in err) {
        throw err as SecurityServiceError;
      }
      return mockSecurityService.prepareKeyDerivation(request);
    }
  }

  /**
   * Client-side evaluation for instant visual feedback without IPC roundtrip on every keystroke.
   */
  public evaluatePasswordStrength(password: string): PasswordEvaluation {
    return evaluatePasswordStrength(password);
  }
}

export const tauriSecurityService = new TauriSecurityService();
