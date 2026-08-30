import { PasswordEvaluation, evaluatePasswordStrength } from '../../utils/passwordStrength';
import {
  KeyDerivationRequest,
  KeyDerivationResponse,
  PasswordValidationRequest,
  PasswordValidationResult,
  SecurityService,
} from './securityService';

const MAX_PASSWORD_LENGTH = 1024;
const RECOMMENDED_MIN_PASSWORD_LENGTH = 8;

/**
 * Mock implementation of SecurityService for browser environment and UI testing.
 * Provides safe client-side simulation without exposing secrets or claiming fake encryption.
 */
export class MockSecurityService implements SecurityService {
  public async validatePassword(request: PasswordValidationRequest): Promise<PasswordValidationResult> {
    const password = request.password;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!password || password.length === 0) {
      errors.push('Password cannot be empty.');
    }

    if (password && password.length > MAX_PASSWORD_LENGTH) {
      errors.push(`Password exceeds maximum allowable length of ${MAX_PASSWORD_LENGTH} characters.`);
    }

    if (request.confirmPassword !== undefined && password !== request.confirmPassword) {
      errors.push('Passwords do not match.');
    }

    if (password && password.length > 0 && password.length < RECOMMENDED_MIN_PASSWORD_LENGTH) {
      warnings.push(
        `Password is short. We recommend at least ${RECOMMENDED_MIN_PASSWORD_LENGTH} characters for optimal security.`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  public async prepareKeyDerivation(request: KeyDerivationRequest): Promise<KeyDerivationResponse> {
    const validation = await this.validatePassword({ password: request.password });
    if (!validation.isValid) {
      const firstError = validation.errors[0] || 'Invalid password provided';
      throw {
        code: request.password ? 'INVALID_PASSWORD' : 'PASSWORD_REQUIRED',
        message: firstError,
      };
    }

    // Simulate safe metadata response
    return {
      success: true,
      algorithm: 'Argon2id',
      keyLength: 32,
      memoryCostKib: 65536,
      timeCostIterations: 3,
      parallelismThreads: 4,
    };
  }

  public evaluatePasswordStrength(password: string): PasswordEvaluation {
    return evaluatePasswordStrength(password);
  }
}

export const mockSecurityService = new MockSecurityService();
